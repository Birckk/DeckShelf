/** Open outlines keep the three-card silhouette legible at navigation sizes. */
export function CardFanIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m8 19-4.7-1.7a1.5 1.5 0 0 1-.9-1.9L6.1 5.2A1.5 1.5 0 0 1 8 4.3l2 .7" />
      <path d="m11 20-3.4-.6a1.5 1.5 0 0 1-1.2-1.8L8.5 5.8a1.5 1.5 0 0 1 1.7-1.2l2.3.4" />
      <rect x="11" y="5" width="10" height="16" rx="1.5" />
      <path d="m16 10 2 3-2 3-2-3Z" />
    </svg>
  );
}
