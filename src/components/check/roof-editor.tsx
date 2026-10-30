"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Dictionary } from "@/i18n";
import { MODULE_KW } from "@/lib/engine/assumptions";
import { fill, formatNumber, SQFT_PER_SQM } from "@/lib/format";
import { polygonArea, type Point, type Polygon } from "@/lib/geometry/polygon";
import { ESRI_ATTRIBUTION, type RoofSnapshot } from "@/lib/imagery/esri";
import { layoutPanels } from "@/lib/layout/panels";
import type { Region, RoofState } from "./types";

/** "auto": tap the roof and Meta SAM 3.1 outlines it; "roof": tap its corners by hand. */
type Mode = "auto" | "roof" | "obstacle";

/** Progress of an automatic outline. */
type AutoState =
  | { status: "idle" }
  | { status: "working"; point: Point }
  | { status: "found"; large: boolean }
  | { status: "notFound" }
  | { status: "notHome" }
  | { status: "busy" }
  | { status: "error" };

interface OutlineResponse {
  outline: { polygon: Polygon; confidence: number | null } | null;
}

/** Outlines bigger than this are rarely one home's roof, so the household is asked to check. */
const LARGE_ROOF_M2 = 1000;
/** Bigger still is open ground or a large building, such as a school field, so it isn't used. */
const MAX_HOME_ROOF_M2 = 3000;

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
  initial?: Pick<RoofState, "roof" | "obstacles" | "outlinedBy">;
  dict: Dictionary["check"]["roof"];
  onBack: () => void;
  onContinue: (state: RoofState) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // The household tapped their roof on the map, and a satellite snapshot is
  // centred on that spot, so it can be outlined straight away. An uploaded
  // photo waits for a tap, because outlining sends it to Meta.
  const outlineOnOpen = !initial && snapshot.source === "esri";
  const centre = { x: snapshot.size / 2, y: snapshot.size / 2 };
  const [mode, setMode] = useState<Mode>(initial ? "obstacle" : "auto");
  const [roof, setRoof] = useState<Polygon>(initial?.roof ?? []);
  const [roofClosed, setRoofClosed] = useState(Boolean(initial));
  const [outlinedBy, setOutlinedBy] = useState<RoofState["outlinedBy"]>(initial?.outlinedBy);
  const [obstacles, setObstacles] = useState<Polygon[]>(initial?.obstacles ?? []);
  const [draft, setDraft] = useState<Polygon>([]);
  const [drag, setDrag] = useState<DragTarget | null>(null);
  const [auto, setAuto] = useState<AutoState>(outlineOnOpen ? { status: "working", point: centre } : { status: "idle" });
  // Answers to superseded outline requests are ignored.
  const latestAuto = useRef(0);
  const openedRef = useRef(false);

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

  async function requestOutline(point: Point, request: number) {
    try {
      const response = await fetch("/api/roof/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: snapshot.dataUrl, size: snapshot.size, point }),
      });
      if (request !== latestAuto.current) return;
      if (response.status === 429) {
        setAuto({ status: "busy" });
        setMode("roof");
        return;
      }
      if (!response.ok) throw new Error(`Outline request returned ${response.status}`);
      const { outline } = (await response.json()) as OutlineResponse;
      if (request !== latestAuto.current) return;
      if (!outline) {
        setAuto({ status: "notFound" });
        return;
      }
      const areaM2 = polygonArea(outline.polygon) * snapshot.metersPerPixel ** 2;
      if (areaM2 > MAX_HOME_ROOF_M2) {
        setAuto({ status: "notHome" });
        return;
      }
      setRoof(outline.polygon);
      setRoofClosed(true);
      setObstacles([]);
      setDraft([]);
      setOutlinedBy("sam");
      setMode("obstacle");
      setAuto({ status: "found", large: areaM2 > LARGE_ROOF_M2 });
    } catch {
      if (request !== latestAuto.current) return;
      setAuto({ status: "error" });
      setMode("roof");
    }
  }

  function findRoof(point: Point) {
    const request = ++latestAuto.current;
    setAuto({ status: "working", point });
    void requestOutline(point, request);
  }

  /** Stops waiting for an outline, so it can't replace what the household does next. */
  function cancelAuto() {
    latestAuto.current++;
    if (auto.status === "working") setAuto({ status: "idle" });
  }

  useEffect(() => {
    // Once per snapshot: the editor is remounted whenever the snapshot changes.
    if (!outlineOnOpen || openedRef.current) return;
    openedRef.current = true;
    void requestOutline(centre, ++latestAuto.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    if (mode === "auto") {
      if (auto.status !== "working") findRoof(point);
      return;
    }

    if (mode === "roof") {
      if (roofClosed) return;
      if (roof.length >= 3 && near(point, roof[0], scale)) {
        setRoofClosed(true);
        setOutlinedBy("hand");
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
      setOutlinedBy("hand");
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

  function chooseMode(next: Mode) {
    if (next !== "auto") cancelAuto();
    setMode(next);
  }

  function undo() {
    cancelAuto();
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
    cancelAuto();
    setAuto({ status: "idle" });
    setRoof([]);
    setRoofClosed(false);
    setOutlinedBy(undefined);
    setObstacles([]);
    setDraft([]);
    setMode("auto");
  }

  function finish() {
    // Lay out from the current outline rather than the deferred copy, which can lag a drag.
    const finalLayout = layoutPanels({
      roof,
      obstacles,
      metersPerPixel: snapshot.metersPerPixel,
      latitude: snapshot.center.lat,
    });
    onContinue({ roof, obstacles, layout: finalLayout, outlinedBy });
  }

  const instructions =
    mode === "auto"
      ? snapshot.source === "upload"
        ? dict.instructionsAutoPhoto
        : dict.instructionsAuto
      : mode === "roof"
        ? roofClosed
          ? dict.instructionsDone
          : dict.instructionsRoof
        : dict.instructionsObstacle;
  const autoMessage = {
    idle: null,
    working: dict.autoWorking,
    found: auto.status === "found" && auto.large ? `${dict.autoFound} ${dict.autoLarge}` : dict.autoFound,
    notFound: dict.autoNotFound,
    notHome: dict.autoNotHome,
    busy: dict.autoBusy,
    error: dict.autoError,
  }[auto.status];
  const canUndo = roof.length > 0 || obstacles.length > 0 || draft.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        {region && <p className="font-medium">{[region.district, region.state].filter(Boolean).join(", ")}</p>}

        <div className="flex flex-wrap gap-2" role="group">
          {(["auto", "roof", "obstacle"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={value === "obstacle" && !roofClosed}
              onClick={() => chooseMode(value)}
              className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 ${
                mode === value ? "bg-ink text-bg" : "border border-border bg-surface"
              }`}
            >
              {{ auto: dict.modeAuto, roof: dict.modeRoof, obstacle: dict.modeObstacle }[value]}
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

        <div aria-live="polite" className="space-y-2">
          {autoMessage && (
            <p
              className={`rounded-xl p-3 text-sm ${
                auto.status === "error" || auto.status === "busy" ? "bg-surface-muted text-danger" : "bg-primary-soft"
              }`}
            >
              {autoMessage}
            </p>
          )}
          <p className="text-sm text-muted">{instructions}</p>
        </div>

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

          {auto.status === "working" && (
            <g pointerEvents="none">
              <circle
                cx={auto.point.x}
                cy={auto.point.y}
                r={14}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                className="origin-center animate-ping [transform-box:fill-box] motion-reduce:animate-none"
              />
              <circle cx={auto.point.x} cy={auto.point.y} r={6} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </svg>

        <p className="text-xs text-muted">
          {snapshot.source === "esri" ? ESRI_ATTRIBUTION : dict.ownPhoto}.{" "}
          {fill(dict.imageDetail, { value: formatNumber(snapshot.metersPerPixel, snapshot.source === "esri" ? 2 : 3) })}
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
