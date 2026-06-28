// Silver championship salver/plate — the playoff award mark (replaces the 🏆).
// Pure inline SVG so it works in both server and client components.

export default function PlayoffPlate({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Playoff plate"
      style={{ verticalAlign: '-0.18em' }}
    >
      <defs>
        <radialGradient id="playoffPlateSilver" cx="40%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#f7f7f7" />
          <stop offset="50%" stopColor="#d2d2d2" />
          <stop offset="100%" stopColor="#9a9a9a" />
        </radialGradient>
      </defs>
      {/* side handles → reads as a salver/tray, not a coin */}
      <ellipse cx="2.7" cy="12" rx="2.3" ry="1.2" fill="#b7b7b7" />
      <ellipse cx="21.3" cy="12" rx="2.3" ry="1.2" fill="#b7b7b7" />
      {/* polished plate */}
      <circle cx="12" cy="12" r="9.3" fill="url(#playoffPlateSilver)" stroke="#7d7d7d" strokeWidth="0.6" />
      <circle cx="12" cy="12" r="6.6" fill="none" stroke="#8c8c8c" strokeWidth="0.7" opacity="0.55" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#8c8c8c" strokeWidth="0.6" opacity="0.4" />
      {/* highlight */}
      <path d="M7 7.6 Q10 5.6 14 6.5" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
