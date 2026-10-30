"use client";

import { useId, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import type { Dictionary } from "@/i18n";
import { fill, formatNumber } from "@/lib/format";
import type { Point } from "@/lib/geometry/polygon";
import type { RoofSnapshot } from "@/lib/imagery/esri";
import { loadUploadedPhoto, metersPerPixelFromLine, toMetres, UploadError, uploadSnapshot } from "@/lib/imagery/upload";
import type { LatLon } from "./types";

/**
 * The household's own top-down photo, for places where satellite imagery is
 * too coarse. They mark a line of known length to set the scale; the photo
 * stays in the browser.
 */
export function RoofUpload({
  point,
  dict,
  imageDetail,
  onReady,
  onCancel,
}: {
  point: LatLon;
  dict: Dictionary["check"]["upload"];
  imageDetail: string;
  onReady: (snapshot: RoofSnapshot) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const lengthId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [photo, setPhoto] = useState<{ dataUrl: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState<Point[]>([]);
  const [lengthText, setLengthText] = useState("");
  const [unit, setUnit] = useState<"m" | "ft">("m");

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setLine([]);
    try {
      setPhoto(await loadUploadedPhoto(file));
    } catch (reason) {
      setPhoto(null);
      setError(reason instanceof UploadError && reason.reason === "tooLarge" ? dict.tooLarge : dict.notImage);
    }
  }

  function mark(event: PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || !photo) return;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const next = { x: local.x, y: local.y };
    setLine((current) => (current.length >= 2 ? [next] : [...current, next]));
  }

  const length = Number(lengthText.replace(/,/g, ""));
  const metersPerPixel =
    line.length === 2 && lengthText.trim() !== "" ? metersPerPixelFromLine(line[0], line[1], toMetres(length, unit)) : null;
  const showScaleError = line.length === 2 && lengthText.trim() !== "" && metersPerPixel === null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{dict.title}</h2>
      <p className="text-muted">{dict.intro}</p>

      <div>
        <label className="inline-flex cursor-pointer rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-ink">
          {dict.choose}
          <input id={inputId} type="file" accept="image/*" onChange={choose} className="sr-only" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      {photo && (
        <>
          <p aria-live="polite" className="text-sm text-muted">
            {dict.calibrate}
          </p>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${photo.size} ${photo.size}`}
            role="img"
            aria-label={dict.imageLabel}
            onPointerDown={mark}
            className="w-full max-w-[640px] touch-none select-none rounded-2xl border border-border"
          >
            <image href={photo.dataUrl} x={0} y={0} width={photo.size} height={photo.size} />
            {line.length === 2 && (
              <line
                x1={line[0].x}
                y1={line[0].y}
                x2={line[1].x}
                y2={line[1].y}
                stroke="#f59e0b"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {line.map((p, index) => (
              <circle key={index} cx={p.x} cy={p.y} r={6} fill="#ffffff" stroke="#b45309" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor={lengthId} className="block text-sm font-medium">
                {dict.length}
              </label>
              <input
                id={lengthId}
                inputMode="decimal"
                value={lengthText}
                onChange={(event) => setLengthText(event.target.value)}
                className="w-32 rounded-xl border border-border bg-surface px-4 py-2"
              />
            </div>
            <select
              aria-label={dict.length}
              value={unit}
              onChange={(event) => setUnit(event.target.value as "m" | "ft")}
              className="rounded-xl border border-border bg-surface px-3 py-2"
            >
              <option value="m">{dict.metres}</option>
              <option value="ft">{dict.feet}</option>
            </select>
            {line.length > 0 && (
              <button type="button" onClick={() => setLine([])} className="text-sm font-medium text-primary underline">
                {dict.markAgain}
              </button>
            )}
          </div>

          {showScaleError && <p className="text-sm text-danger">{dict.scaleError}</p>}
          {metersPerPixel !== null && (
            <p className="text-sm text-muted">{fill(imageDetail, { value: formatNumber(metersPerPixel, 3) })}</p>
          )}

          <button
            type="button"
            disabled={metersPerPixel === null}
            onClick={() => metersPerPixel !== null && onReady(uploadSnapshot(photo, metersPerPixel, point))}
            className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-ink disabled:opacity-50"
          >
            {dict.usePhoto}
          </button>
        </>
      )}

      <div>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-primary underline">
          {dict.cancel}
        </button>
      </div>
    </div>
  );
}
