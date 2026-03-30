export default function CourtBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#060810]" />
      <div className="absolute" style={{ inset: 0, background: "radial-gradient(ellipse 55% 65% at 10% -5%, rgba(255,160,32,0.22) 0%, transparent 70%)" }} />
      <div className="absolute" style={{ inset: 0, background: "radial-gradient(ellipse 55% 65% at 90% -5%, rgba(255,160,32,0.22) 0%, transparent 70%)" }} />
      <div className="absolute" style={{ inset: 0, background: "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(255,210,100,0.07) 0%, transparent 65%)" }} />
      {/* Dark mode court — white strokes */}
      <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMax slice" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full opacity-[0.07] hidden dark:block" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="776" height="456" stroke="white" strokeWidth="1.5" />
        <path d="M 12 80 Q 260 240 12 400" stroke="white" strokeWidth="1.5" />
        <path d="M 788 80 Q 540 240 788 400" stroke="white" strokeWidth="1.5" />
        <rect x="12" y="168" width="130" height="144" stroke="white" strokeWidth="1.2" />
        <rect x="658" y="168" width="130" height="144" stroke="white" strokeWidth="1.2" />
        <path d="M 12 185 Q 108 240 12 295" stroke="white" strokeWidth="1.2" />
        <path d="M 12 185 Q -84 240 12 295" stroke="white" strokeWidth="1.2" strokeDasharray="7 5" />
        <path d="M 788 185 Q 692 240 788 295" stroke="white" strokeWidth="1.2" />
        <path d="M 788 185 Q 884 240 788 295" stroke="white" strokeWidth="1.2" strokeDasharray="7 5" />
      </svg>
      {/* Light mode court — dark strokes */}
      <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMax slice" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full opacity-[0.12] block dark:hidden" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="12" width="776" height="456" stroke="black" strokeWidth="1.5" />
        <path d="M 12 80 Q 260 240 12 400" stroke="black" strokeWidth="1.5" />
        <path d="M 788 80 Q 540 240 788 400" stroke="black" strokeWidth="1.5" />
        <rect x="12" y="168" width="130" height="144" stroke="black" strokeWidth="1.2" />
        <rect x="658" y="168" width="130" height="144" stroke="black" strokeWidth="1.2" />
        <path d="M 12 185 Q 108 240 12 295" stroke="black" strokeWidth="1.2" />
        <path d="M 12 185 Q -84 240 12 295" stroke="black" strokeWidth="1.2" strokeDasharray="7 5" />
        <path d="M 788 185 Q 692 240 788 295" stroke="black" strokeWidth="1.2" />
        <path d="M 788 185 Q 884 240 788 295" stroke="black" strokeWidth="1.2" strokeDasharray="7 5" />
      </svg>
      <div className="absolute" style={{ inset: 0, background: "radial-gradient(ellipse 80% 30% at 50% 105%, rgba(200,88,12,0.14) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-[28px] overflow-hidden">
        <svg viewBox="0 0 800 28" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="28" fill="rgba(0,0,0,0.75)" />
          {[30,60,88,116,148,178,208,238,270,300,328,356,386,416,448,476,506,534,562,592,622,650,678,708,738,768].map((x, i) => (
            <ellipse key={i} cx={x} cy={28} rx={i % 3 === 0 ? 13 : i % 2 === 0 ? 11 : 9} ry={i % 3 === 0 ? 9 : 7} fill="#060810" />
          ))}
        </svg>
      </div>
      <div className="absolute top-0 left-[8%] w-[3px] h-[20px] bg-[rgba(255,200,80,0.5)]" />
      <div className="absolute top-[18px] left-[calc(8%-4px)] w-[11px] h-[4px] rounded-sm bg-[rgba(255,220,100,0.7)]" />
      <div className="absolute top-0 right-[8%] w-[3px] h-[20px] bg-[rgba(255,200,80,0.5)]" />
      <div className="absolute top-[18px] right-[calc(8%-4px)] w-[11px] h-[4px] rounded-sm bg-[rgba(255,220,100,0.7)]" />
      <div className="absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(to bottom, rgba(6,8,16,0.6) 0%, transparent 100%)" }} />
    </div>
  );
}
