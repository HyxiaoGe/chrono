export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className="shrink-0">
      <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="3.5" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="9" cy="9" r="2.5" fill="currentColor" />
      <circle cx="9" cy="14.5" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
