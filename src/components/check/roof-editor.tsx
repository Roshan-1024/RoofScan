"use client";

import { useDeferredValue, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Dictionary } from "@/i18n";
import { MODULE_KW } from "@/lib/engine/assumptions";
import { fill, formatNumber, SQFT_PER_SQM } from "@/lib/format";
import type { Point, Polygon } from "@/lib/geometry/polygon";
import { ESRI_ATTRIBUTION, type RoofSnapshot } from "@/lib/imagery/esri";
import { layoutPanels } from "@/lib/layout/panels";
import type { Region, RoofState } from "./types";

type Mode = "roof" | "obstacle";

type DragTarget = { kind: "roof"; vertex: number } | { kind: "obstacle"; obstacle: number; vertex: number };

/** Taps within this many screen pixels of the first corner close the shape. */
const CLOSE_DISTANCE_SCREEN_PX = 22;

const toPoints = (polygon: Polygon) => polygon.map((p) => `${p.x},${p.y}`).join(" ");

function Area({ label, m2, dict }: { label: string; m2: number; dict: Dictionary["check"]["roof"] }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-xl font-semibold">
        {formatNumber(m2)} {dict.sqm}
        <span className="ml-2 text-sm font-normal text-muted">
          ({formatNumber(m2 * SQFT_PER_SQM)} {dict.sqft})
        </span>
      </dd>
    </div>
  );
}

export function RoofEditor({
  snapshot,
  region,
  initial,
  dict,
  onBack,
  onContinue,
}: {
  snapshot: RoofSnapshot;
  region?: Region;
  /** A previously finished outline, when the household comes back to this step. */
  initial?: Pick<RoofState, "roof" | "obstacles">;
  dict: Dictionary["check"]["roof"];
  onBack: () => void;
  onContinue: (state: RoofState) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<Mode>(initial ? "obstacle" : "roof");
  const [roof, setRoof] = useState<Polygon>(initial?.roof ?? []);
  const [roofClosed, setRoofClosed] = useState(Boolean(initial));
  const [obstacles, setObstacles] = useState<Polygon[]>(initial?.obstacles ?? []);
  const [draft, setDraft] = useState<Polygon>([]);
  const [drag, setDrag] = useState<DragTarget | null>(null);

  const layoutInput = useDeferredValue(roofClosed ? { roof, obstacles } : null);
  const layout = useMemo(
    () =>
      layoutInput &&
      layoutPanels({
        roof: layoutInput.roof,
        obstacles: layoutInput.obstacles,
        metersPerPixel: snapshot.metersPerPixel,
        latitude: snapshot.center.lat,
      }),
    [layoutInput, snapshot.metersPerPixel, snapshot.center.lat],
  );

  /** Converts a pointer position to image pixels, plus how many image pixels one screen pixel spans. */
  function toImage(event: PointerEvent): { point: Point; scale: number } | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const point = {
      x: Math.min(Math.max(local.x, 0), snapshot.size),
      y: Math.min(Math.max(local.y, 0), snapshot.size),
    };
    return { point, scale: snapshot.size / svg.getBoundingClientRect().width };
  }

  const near = (a: Point, b: Point, scale: number) =>
    Math.hypot(a.x - b.x, a.y - b.y) <= CLOSE_DISTANCE_SCREEN_PX * scale;

  function handleImagePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (drag) return;
    const hit = toImage(event);
    if (!hit) return;
    const { point, scale } = hit;

    if (mode === "roof") {
      if (roofClosed) return;
      if (roof.length >= 3 && near(point, roof[0], scale)) {
        setRoofClosed(true);
        setMode("obstacle");
      } else {
        setRoof((current) => [...current, point]);
      }
      return;
    }

    if (draft.length >= 3 && near(point, draft[0], scale)) {
      setObstacles((current) => [...current, draft]);
      setDraft([]);
    } else {
      setDraft((current) => [...current, point]);
    }
  }

  function startDrag(event: PointerEvent<SVGCircleElement>, target: DragTarget) {
    event.stopPropagation();
    // While the roof is still open, tapping its first corner closes it.
    if (target.kind === "roof" && !roofClosed && target.vertex === 0 && roof.length >= 3) {
      setRoofClosed(true);
      setMode("obstacle");
      return;
    }
    svgRef.current?.setPointerCapture(event.pointerId);
    setDrag(target);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const hit = toImage(event);
    if (!hit) return;
    const replace = (polygon: Polygon, index: number) => polygon.map((p, i) => (i === index ? hit.point : p));
    if (drag.kind === "roof") {
      setRoof((current) => replace(current, drag.vertex));
    } else {
      setObstacles((current) => current.map((o, i) => (i === drag.obstacle ? replace(o, drag.vertex) : o)));
    }
  }

  function endDrag() {
    setDrag(null);
  }

  function undo() {
    if (mode === "obstacle") {
      if (draft.length) setDraft((current) => current.slice(0, -1));
      else if (obstacles.length) setObstacles((current) => current.slice(0, -1));
      else {
        setRoofClosed(false);
        setMode("roof");
      }
      return;
    }
    if (roofClosed) setRoofClosed(false);
    else setRoof((current) => current.slice(0, -1));
  }

  function clear() {
    setRoof([]);
    setRoofClosed(false);
    setObstacles([]);
    setDraft([]);
    setMode("roof");
  }

  function finish() {
    // Lay out from the current outline rather than the deferred copy, which can lag a drag.
    const finalLayout = layoutPanels({
      roof,
      obstacles,
      metersPerPixel: snapshot.metersPerPixel,
      latitude: snapshot.center.lat,
    });
    onContinue({ roof, obstacles, layout: finalLayout });
  }

  const instructions = mode === "roof" ? (roofClosed ? dict.instructionsDone : dict.instructionsRoof) : dict.instructionsObstacle;
  const canUndo = roof.length > 0 || obstacles.length > 0 || draft.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        {region && <p className="font-medium">{[region.district, region.state].filter(Boolean).join(", ")}</p>}

        <div className="flex flex-wrap gap-2" role="group">
          {(["roof", "obstacle"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={value === "obstacle" && !roofClosed}
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 ${
                mode === value ? "bg-ink text-bg" : "border border-border bg-surface"
              }`}
            >
              {value === "roof" ? dict.modeRoof : dict.modeObstacle}
            </button>
          ))}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {dict.undo}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!canUndo}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {dict.clear}
          </button>
        </div>

        <p aria-live="polite" className="text-sm text-muted">
          {instructions}
        </p>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${snapshot.size} ${snapshot.size}`}
          role="img"
          aria-label={dict.editorLabel}
          className="w-full max-w-[640px] touch-none select-none rounded-2xl border border-border"
          onPointerDown={handleImagePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <image href={snapshot.dataUrl} x={0} y={0} width={snapshot.size} height={snapshot.size} />

          {layout?.panels.map((panel, index) => (
            <polygon
              key={index}
              points={toPoints(panel)}
              fill="rgba(37, 99, 235, 0.72)"
              stroke="#dbeafe"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {roof.length > 0 &&
            (roofClosed ? (
              <polygon
                points={toPoints(roof)}
                fill="rgba(251, 191, 36, 0.12)"
                stroke="#f59e0b"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <polyline
                points={toPoints(roof)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

          {obstacles.map((obstacle, index) => (
            <polygon
              key={index}
              points={toPoints(obstacle)}
              fill="rgba(220, 38, 38, 0.28)"
              stroke="#dc2626"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {draft.length > 0 && (
            <polyline
              points={toPoints(draft)}
              fill="none"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {roof.map((p, vertex) => (
            <circle
              key={`r${vertex}`}
              cx={p.x}
              cy={p.y}
              r={7}
              fill={vertex === 0 && !roofClosed ? "#f59e0b" : "#ffffff"}
              stroke="#b45309"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="cursor-grab"
              onPointerDown={(event) => startDrag(event, { kind: "roof", vertex })}
            />
          ))}
          {obstacles.map((obstacle, index) =>
            obstacle.map((p, vertex) => (
              <circle
                key={`o${index}-${vertex}`}
                cx={p.x}
                cy={p.y}
                r={5}
                fill="#ffffff"
                stroke="#dc2626"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className="cursor-grab"
                onPointerDown={(event) => startDrag(event, { kind: "obstacle", obstacle: index, vertex })}
              />
            )),
          )}
          {draft.map((p, vertex) => (
            <circle key={`d${vertex}`} cx={p.x} cy={p.y} r={5} fill={vertex === 0 ? "#dc2626" : "#ffffff"} stroke="#dc2626" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <p className="text-xs text-muted">
          {ESRI_ATTRIBUTION}. {fill(dict.imageDetail, { value: formatNumber(snapshot.metersPerPixel, 2) })}
        </p>
        <button type="button" onClick={onBack} className="text-sm font-medium text-primary underline">
          {dict.back}
        </button>
      </div>

      <aside aria-live="polite" className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5">
        {layout ? (
          <>
            <dl className="space-y-4">
              <Area label={dict.roofArea} m2={layout.roofAreaM2} dict={dict} />
              <Area label={dict.usableArea} m2={layout.usableAreaM2} dict={dict} />
              <div>
                <dt className="text-sm text-muted">{dict.panels}</dt>
                <dd className="text-xl font-semibold">{layout.panelCount}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">{dict.maxCapacity}</dt>
                <dd className="text-3xl font-bold text-primary">
                  {formatNumber(layout.panelCount * MODULE_KW, 2)} {dict.kw}
                </dd>
              </div>
            </dl>
            {layout.panelCount === 0 ? (
              <p className="text-danger">{dict.noPanels}</p>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="w-full rounded-full bg-primary px-5 py-3 font-semibold text-primary-ink"
              >
                {dict.continue}
              </button>
            )}
          </>
        ) : (
          <p className="text-muted">{dict.drawFirst}</p>
        )}
      </aside>
    </div>
  );
}
