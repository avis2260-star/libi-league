'use client';

export default function ChampionshipPlate({ year = '2025–2026' }: { year?: string }) {
  return (
    <div className="flex items-center justify-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 'min(340px, 90vw)', height: 'min(340px, 90vw)' }}
      >
        {/* Outer gold ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #b8860b, #ffd700, #ffe066, #ffd700, #b8860b, #ffd700, #b8860b)',
            padding: '6px',
          }}
        >
          {/* Silver inner ring */}
          <div
            className="w-full h-full rounded-full"
            style={{
              background: 'conic-gradient(from 45deg, #888, #ddd, #fff, #ddd, #888, #ddd, #888)',
              padding: '6px',
            }}
          >
            {/* Main plate surface */}
            <div
              className="w-full h-full rounded-full flex flex-col items-center justify-center gap-2 relative overflow-hidden"
              style={{
                background: 'radial-gradient(ellipse at 35% 35%, #e8e8e8 0%, #c0c0c0 25%, #a0a0a0 50%, #808080 75%, #606060 100%)',
                boxShadow: 'inset 0 4px 24px rgba(0,0,0,0.5), inset 0 -2px 8px rgba(255,255,255,0.15)',
              }}
            >
              {/* Inner recessed circle */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: '14%',
                  background: 'radial-gradient(ellipse at 40% 40%, #d8d8d8, #909090)',
                  boxShadow: 'inset 0 6px 20px rgba(0,0,0,0.6), inset 0 -3px 10px rgba(255,255,255,0.1)',
                }}
              />

              {/* Sheen highlight */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: '14%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%)',
                }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center gap-1 px-4 text-center">
                <p
                  className="font-black uppercase tracking-[3px] leading-tight font-heading"
                  style={{
                    fontSize: 'clamp(9px, 2.2vw, 13px)',
                    color: '#3a2a00',
                    textShadow: '0 1px 2px rgba(255,220,100,0.4)',
                    letterSpacing: '0.2em',
                  }}
                >
                  LEAGUE
                </p>
                <p
                  className="font-black uppercase leading-tight font-heading"
                  style={{
                    fontSize: 'clamp(14px, 4vw, 22px)',
                    color: '#2a1a00',
                    textShadow: '0 1px 3px rgba(255,220,100,0.5)',
                    letterSpacing: '0.08em',
                  }}
                >
                  CHAMPIONS
                </p>

                {/* Basketball icon */}
                <div
                  className="my-1 flex items-center justify-center rounded-full border-2"
                  style={{
                    width: 'clamp(32px, 8vw, 48px)',
                    height: 'clamp(32px, 8vw, 48px)',
                    borderColor: '#b8860b',
                    background: 'radial-gradient(circle at 40% 35%, #f97316, #c2410c)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5"
                    style={{ width: '65%', height: '65%' }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
                    <path d="M2 12h20" />
                  </svg>
                </div>

                <p
                  className="font-black font-stats"
                  style={{
                    fontSize: 'clamp(11px, 2.8vw, 16px)',
                    color: '#3a2a00',
                    textShadow: '0 1px 2px rgba(255,220,100,0.4)',
                    letterSpacing: '0.12em',
                  }}
                >
                  {year}
                </p>

                <p
                  className="font-bold uppercase tracking-widest font-body"
                  style={{
                    fontSize: 'clamp(7px, 1.6vw, 10px)',
                    color: '#5a4500',
                    letterSpacing: '0.25em',
                    marginTop: 2,
                  }}
                >
                  ליגת ליבי
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: '0 0 40px rgba(255,215,0,0.25), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}
