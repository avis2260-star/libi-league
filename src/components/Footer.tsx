import Link from 'next/link';

const QUICK_LINKS = [
  { href: '/',          label: 'עמוד הבית'     },
  { href: '/games',     label: 'לוח משחקים'    },
  { href: '/standings', label: 'טבלת הליגה'    },
  { href: '/teams',     label: 'קבוצות'        },
  { href: '/results',   label: 'תוצאות'        },
  { href: '/playoff',   label: 'פלייאוף'       },
  { href: '/scoreboard',label: 'לוח תוצאות חי' },
  { href: '/submit',    label: 'הגשת תוצאות'  },
];

const LEGAL_LINKS = [
  { href: '/takanon', label: 'תקנון הליגה'              },
  { href: '/terms',   label: 'תנאי שימוש ומדיניות פרטיות' },
  { href: '/about',   label: 'אודות'                    },
  { href: '/about',   label: 'צור קשר'                  },
];

// Social icon SVGs
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.975-1.418A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
    </svg>
  );
}
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
      <polygon fill="#060810" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
    </svg>
  );
}

const MOBILE_LINKS = [
  { href: '/about',    label: 'אודות'       },
  { href: '/about',    label: 'צור קשר'     },
  { href: '/terms',    label: 'תנאי שימוש'  },
  { href: '/takanon',  label: 'תקנון'       },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
    {/* ── Mobile footer (sm:hidden) ── */}
    <footer
      dir="rtl"
      className="sm:hidden mt-8 pb-20 border-t border-white/[0.06] bg-[#080f1a]"
    >
      {/* Orange top accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

      {/* Disclaimer */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-2 text-[11px] text-[#4a6a8a] leading-relaxed">
        <span className="text-[#3a5a7a] mt-0.5 shrink-0">ⓘ</span>
        <p>
          הנתונים באתר הינם לידיעה בלבד. התמונות מועלות באישור השחקנים.{' '}
          נמצאה טעות?{' '}
          <Link href="/about" className="text-orange-400/70 hover:text-orange-400 underline underline-offset-2">
            פנו אלינו
          </Link>
          .
        </p>
      </div>

      {/* Links row */}
      <div className="px-4 pb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {MOBILE_LINKS.map(({ href, label }) => (
          <Link
            key={label}
            href={href}
            className="text-xs text-[#5a7a9a] hover:text-orange-400 transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Copyright */}
      <p className="pb-2 text-center text-[10px] text-[#2a4a6a]">
        © {year} ליגת ליבי · כל הזכויות שמורות
      </p>
    </footer>

    {/* ── Desktop footer (hidden on mobile) ── */}
    <footer
      dir="rtl"
      className="hidden sm:block mt-16 border-t border-white/[0.06] bg-[#080f1a]"
    >
      {/* ── Orange top accent line ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />

      {/* ── Main grid ── */}
      <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* ── Column 1: Brand ── */}
        <div className="flex flex-col gap-4">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            {/* Basketball emoji stand-in – replace with <img> if logo is available */}
            <span className="text-3xl">🏀</span>
            <div>
              <p className="text-lg font-black text-white leading-tight">ליגת ליבי</p>
              <p className="text-[11px] tracking-widest text-[#5a7a9a] uppercase">2025 – 2026</p>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-sm text-[#5a7a9a] leading-relaxed max-w-[240px]">
            ליגת כדורסל קהילתית — מביאים את המשחק לשכונה, עם לוח משחקים, טבלאות ותוצאות בזמן אמת.
          </p>

          {/* Social icons */}
          <div className="flex items-center gap-3 mt-1">
            {[
              { icon: <FacebookIcon />,  href: '#', label: 'פייסבוק'   },
              { icon: <InstagramIcon />, href: '#', label: 'אינסטגרם'  },
              { icon: <WhatsAppIcon />,  href: '#', label: 'וואטסאפ'   },
              { icon: <YoutubeIcon />,   href: '#', label: 'יוטיוב'    },
            ].map(({ icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#5a7a9a] transition-all hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* ── Column 2: Quick links ── */}
        <div>
          <p className="mb-4 text-[11px] font-black tracking-[0.15em] text-orange-500 uppercase">
            ניווט מהיר
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {QUICK_LINKS.map(({ href, label }) => (
              <li key={href + label}>
                <Link
                  href={href}
                  className="group flex items-center gap-1.5 text-sm text-[#5a7a9a] transition-colors hover:text-orange-400"
                >
                  <span className="h-px w-3 bg-current opacity-40 transition-all group-hover:w-5 group-hover:opacity-100" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Column 3: Legal + season info ── */}
        <div>
          <p className="mb-4 text-[11px] font-black tracking-[0.15em] text-orange-500 uppercase">
            מידע
          </p>
          <ul className="flex flex-col gap-2 mb-6">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="group flex items-center gap-1.5 text-sm text-[#5a7a9a] transition-colors hover:text-orange-400"
                >
                  <span className="h-px w-3 bg-current opacity-40 transition-all group-hover:w-5 group-hover:opacity-100" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Season badge */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2">
            <span className="text-lg">🏆</span>
            <div>
              <p className="text-xs font-black text-orange-400">עונה 2025–2026</p>
              <p className="text-[10px] text-[#4a6a8a]">ליגת ליבי · כדורסל קהילתי</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Disclaimer strip ── */}
      <div className="border-t border-white/[0.04] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-start gap-2 text-[11px] text-[#4a6a8a] leading-relaxed">
          <span className="text-[#3a5a7a] mt-0.5 shrink-0">ⓘ</span>
          <p>
            הנתונים באתר הינם לידיעה בלבד. התמונות מועלות באישור השחקנים.{' '}
            נמצאה טעות?{' '}
            <Link href="/about" className="text-orange-400/70 hover:text-orange-400 underline underline-offset-2 transition-colors">
              פנו אלינו
            </Link>
            .
          </p>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-2 py-4 text-[11px] text-[#3a5a7a]">
          <p>© {year} ליגת ליבי · כל הזכויות שמורות</p>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-orange-400 transition-colors">
              תנאי שימוש
            </Link>
            <span className="opacity-30">·</span>
            <p className="flex items-center gap-1">
              נבנה באהבה לקהילה
              <span className="text-orange-500">🧡</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
