"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

/** Used until the chart is measured, and while it is hidden. */
const DEFAULT_WIDTH = 640;
const HEIGHT = 240;
const MARGIN = { top: 20, right: 12, bottom: 28, left: 44 };
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const MAX_BAR = 24;
/** Each month label needs about this many pixels; narrower charts label every other month. */
const MIN_LABEL_BAND = 32;

/** Smallest "nice" step (1, 2 or 5 × 10ⁿ) giving at most `count` ticks up to `max`. */
function niceStep(max: number, count = 4): number {
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  return step ?? 10 * magnitude;
}

/**
 * Bars for units generated each month, with a reference line at the
 * household's monthly use. Every value is also in the table view.
 */
export function MonthlyChart({
  generation,
  monthlyUse,
  months,
  dict,
}: {
  generation: number[];
  monthlyUse: number;
  months: string[];
  dict: { title: string; use: string; showTable: string; monthHeader: string; unitsHeader: string };
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Drawn at its real width, so text stays legible on phones instead of being scaled down.
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry.contentRect.width);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const step = niceStep(Math.max(...generation, monthlyUse) * 1.05);
  const yMax = Math.ceil((Math.max(...generation, monthlyUse) * 1.05) / step) * step;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const y = (value: number) => MARGIN.top + PLOT_H - (value / yMax) * PLOT_H;
  const band = plotWidth / 12;
  const labelEvery = band < MIN_LABEL_BAND ? 2 : 1;
  const barWidth = Math.min(MAX_BAR, band * 0.6);
  const useY = y(monthlyUse);

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold">{dict.title}</span>
        <span className="flex items-center gap-1.5 text-muted">
          <svg width="16" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="16" y2="2" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {dict.use}
        </span>
      </figcaption>

      <div ref={frame}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="block w-full" role="img" aria-label={dict.title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--muted)" : "var(--border)"}
                strokeWidth={1}
              />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--muted)">
                {formatNumber(tick)}
              </text>
            </g>
          ))}

          {generation.map((value, month) => {
            const cx = MARGIN.left + band * month + band / 2;
            const top = y(value);
            const height = MARGIN.top + PLOT_H - top;
            return (
              <g
                key={month}
                onPointerEnter={() => setHovered(month)}
                onPointerLeave={() => setHovered(null)}
              >
                {/* Hit area wider than the bar. */}
                <rect x={cx - band / 2} y={MARGIN.top} width={band} height={PLOT_H} fill="transparent" />
                {/* Rounded data end, square at the baseline; plain for bars too short to round. */}
                <path
                  d={
                    height >= 8
                      ? `M${cx - barWidth / 2},${top + 4} a4,4 0 0 1 4,-4 h${barWidth - 8} a4,4 0 0 1 4,4 V${MARGIN.top + PLOT_H} H${cx - barWidth / 2} Z`
                      : `M${cx - barWidth / 2},${top} h${barWidth} V${MARGIN.top + PLOT_H} H${cx - barWidth / 2} Z`
                  }
                  fill="var(--panel)"
                  opacity={hovered === null || hovered === month ? 1 : 0.55}
                />
                {month % labelEvery === 0 && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                    {months[month]}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={useY}
            y2={useY}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />

          {hovered !== null && (
            <g pointerEvents="none">
              <text
                x={MARGIN.left + band * hovered + band / 2}
                y={y(generation[hovered]) - 8}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="var(--ink)"
              >
                {formatNumber(generation[hovered])}
              </text>
            </g>
          )}
        </svg>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{dict.showTable}</summary>
        <table className="mt-2 w-full max-w-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-1 font-medium">{dict.monthHeader}</th>
              <th className="py-1 text-right font-medium">{dict.unitsHeader}</th>
            </tr>
          </thead>
          <tbody>
            {generation.map((value, month) => (
              <tr key={month} className="border-b border-border">
                <td className="py-1">{months[month]}</td>
                <td className="py-1 text-right tabular-nums">{formatNumber(value)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1 text-muted">{dict.use}</td>
              <td className="py-1 text-right tabular-nums text-muted">{formatNumber(monthlyUse)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </figure>
  );
}
