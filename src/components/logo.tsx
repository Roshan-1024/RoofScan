/** RoofScan mark: a roof outline with a sun above it. Decorative. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="22" cy="9" r="5" fill="var(--accent)" />
      <path
        d="M4 26 L16 14 L28 26"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 26 V22 M24 26 V22" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
