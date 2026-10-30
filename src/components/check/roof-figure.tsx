import type { Polygon } from "@/lib/geometry/polygon";
import type { RoofSnapshot } from "@/lib/imagery/esri";
import type { RoofState } from "./types";

const toPoints = (polygon: Polygon) => polygon.map((p) => `${p.x},${p.y}`).join(" ");

/** Square view box around the roof with some surroundings, kept inside the image. */
function roofViewBox(roof: Polygon, size: number): string {
  const xs = roof.map((p) => p.x);
  const ys = roof.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const side = Math.min(size, Math.max(span * 1.6, 60));
  const centerX = minX + (Math.max(...xs) - minX) / 2;
  const centerY = minY + (Math.max(...ys) - minY) / 2;
  const x = Math.min(Math.max(centerX - side / 2, 0), size - side);
  const y = Math.min(Math.max(centerY - side / 2, 0), size - side);
  return `${x} ${y} ${side} ${side}`;
}

/**
 * Read-only view of the roof with its outline, obstacles and the panels in
 * the chosen plan (the first `panelCount` positions of the layout), zoomed
 * to the roof.
 */
export function RoofFigure({
  snapshot,
  roofState,
  panelCount,
  label,
  className,
}: {
  snapshot: RoofSnapshot;
  roofState: RoofState;
  panelCount: number;
  label: string;
  className?: string;
}) {
  return (
    <svg viewBox={roofViewBox(roofState.roof, snapshot.size)} role="img" aria-label={label} className={className}>
      <image href={snapshot.dataUrl} x={0} y={0} width={snapshot.size} height={snapshot.size} />
      <polygon
        points={toPoints(roofState.roof)}
        fill="rgba(251, 191, 36, 0.12)"
        stroke="#f59e0b"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      {roofState.obstacles.map((obstacle, index) => (
        <polygon
          key={index}
          points={toPoints(obstacle)}
          fill="rgba(220, 38, 38, 0.28)"
          stroke="#dc2626"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {roofState.layout.panels.slice(0, panelCount).map((panel, index) => (
        <polygon
          key={index}
          points={toPoints(panel)}
          fill="rgba(37, 99, 235, 0.8)"
          stroke="#dbeafe"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
