/**
 * Top-down sketch of what RoofScan produces: a traced roof outline, an
 * excluded water tank and the panel layout that fits around it. Decorative.
 */
export function RoofIllustration({ className }: { className?: string }) {
  const panels: Array<[number, number]> = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      // Leave the corner under the water tank empty.
      if (row === 0 && col === 3) continue;
      panels.push([62 + col * 38, 70 + row * 26]);
    }
  }

  return (
    <svg viewBox="0 0 280 220" className={className} aria-hidden="true">
      <rect x="0" y="0" width="280" height="220" rx="16" fill="var(--surface-muted)" />
      <path d="M40 40 H240 V180 H40 Z" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
      <path
        d="M40 40 H240 V180 H40 Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray="8 6"
      />
      {panels.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="34" height="22" rx="2" fill="var(--panel)" opacity="0.85" />
      ))}
      <circle cx="205" cy="70" r="16" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeDasharray="4 4" />
      <circle cx="205" cy="70" r="11" fill="var(--border)" />
      <rect x="62" y="150" width="60" height="20" rx="3" fill="var(--border)" />
    </svg>
  );
}
