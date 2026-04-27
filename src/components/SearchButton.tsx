'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLang } from './TranslationProvider';

type TeamHit = {
  kind: 'team';
  id: string;
  name: string;
  logo_url: string | null;
};

type PlayerHit = {
  kind: 'player';
  id: string;
  name: string;
  jersey_number: number | null;
  photo_url: string | null;
  team_name: string | null;
  is_active: boolean;
};

type PageHit = {
  kind: 'page';
  id: string;
  name: string;
  path: string;
  icon: string;
  keywords: string;
};

type Hit = TeamHit | PlayerHit | PageHit;

const PAGES: PageHit[] = [
  { kind: 'page', id: 'home',         name: 'דף הבית',           path: '/',             icon: '🏠', keywords: 'home overview dashboard סקירה ראשי' },
  { kind: 'page', id: 'standings',    name: 'טבלאות ליגה',       path: '/standings',    icon: '📊', keywords: 'standings table טבלה דירוג' },
  { kind: 'page', id: 'teams',        name: 'קבוצות',             path: '/teams',        icon: '🏀', keywords: 'teams כל הקבוצות' },
  { kind: 'page', id: 'players',      name: 'כרטיסי שחקן',       path: '/players',      icon: '👤', keywords: 'players שחקנים roster סגל' },
  { kind: 'page', id: 'scorers',      name: 'קלעי הליגה',        path: '/scorers',      icon: '🏅', keywords: 'scorers top points leaders מובילי נקודות' },
  { kind: 'page', id: 'playoff',      name: 'פלייאוף',            path: '/playoff',      icon: '🏆', keywords: 'playoff series גמר' },
  { kind: 'page', id: 'cup',          name: 'גביע',               path: '/cup',          icon: '🥇', keywords: 'cup גביע' },
  { kind: 'page', id: 'hall-of-fame', name: 'היכל התהילה',       path: '/hall-of-fame', icon: '🏛', keywords: 'hall of fame champions hall תהילה אלופות' },
  { kind: 'page', id: 'games',        name: 'משחקים',             path: '/games',        icon: '📅', keywords: 'games schedule לוח' },
  { kind: 'page', id: 'results',      name: 'תוצאות',             path: '/results',      icon: '📋', keywords: 'results תוצאות' },
  { kind: 'page', id: 'scoreboard',   name: 'לוח ניקוד',          path: '/scoreboard',   icon: '📟', keywords: 'scoreboard live score' },
  { kind: 'page', id: 'live',         name: 'שידור חי',           path: '/live',         icon: '🔴', keywords: 'live broadcast חי' },
  { kind: 'page', id: 'about',        name: 'אודות',              path: '/about',        icon: 'ℹ️', keywords: 'about contact אודות צור קשר' },
];

/** Hebrew-aware normalization: strip common quotes/punctuation and diacritics, lowercase. */
function norm(s: string) {
  return s
    .replace(/["״׳'`,.·\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default function SearchButton() {
  const router = useRouter();
  const { t, lang } = useLang();
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<TeamHit[]>([]);
  const [players, setPlayers] = useState<PlayerHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // "/" keyboard shortcut to open, Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && !open) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lazy-load teams + players on first open
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      const [{ data: teamsData }, { data: playersData }] = await Promise.all([
        supabase.from('teams').select('id, name, logo_url').order('name'),
        supabase.from('players').select('id, name, jersey_number, photo_url, is_active, team:teams(name)').order('name'),
      ]);
      if (cancelled) return;
      setTeams(
        (teamsData ?? []).map((t) => ({
          kind: 'team' as const,
          id: t.id as string,
          name: t.name as string,
          logo_url: (t.logo_url as string | null) ?? null,
        })),
      );
      setPlayers(
        (playersData ?? []).map((p: { id: string; name: string; jersey_number: number | null; photo_url: string | null; is_active: boolean; team: { name: string } | { name: string }[] | null }) => ({
          kind: 'player' as const,
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          photo_url: p.photo_url,
          is_active: p.is_active,
          team_name: Array.isArray(p.team) ? p.team[0]?.name ?? null : p.team?.name ?? null,
        })),
      );
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, loaded]);

  // Focus the input when opening
  useEffect(() => {
    if (open) {
      // Reset query + cursor on open
      setQuery('');
      setCursor(0);
      // Focus after paint
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      return () => {
        window.clearTimeout(id);
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  const q = norm(query);

  const { pageHits, teamHits, playerHits, allFlat } = useMemo(() => {
    if (!q) {
      // Show a short default: top pages + a few teams (if loaded)
      const defPages = PAGES.slice(0, 6);
      const defTeams = teams.slice(0, 6);
      return {
        pageHits: defPages,
        teamHits: defTeams,
        playerHits: [] as PlayerHit[],
        allFlat: [...defPages, ...defTeams] as Hit[],
      };
    }
    const matchPage = (p: PageHit) => norm(p.name).includes(q) || norm(p.keywords).includes(q);
    const matchTeam = (t: TeamHit) => norm(t.name).includes(q);
    const matchPlayer = (p: PlayerHit) => {
      const n = norm(p.name);
      if (n.includes(q)) return true;
      if (p.jersey_number !== null && String(p.jersey_number) === q) return true;
      if (p.team_name && norm(p.team_name).includes(q)) return true;
      return false;
    };
    const ph = PAGES.filter(matchPage);
    const th = teams.filter(matchTeam);
    const pl = players.filter(matchPlayer).slice(0, 30);
    return {
      pageHits: ph,
      teamHits: th,
      playerHits: pl,
      allFlat: [...ph, ...th, ...pl] as Hit[],
    };
  }, [q, teams, players]);

  // Clamp cursor when results change
  useEffect(() => {
    if (cursor >= allFlat.length) setCursor(Math.max(0, allFlat.length - 1));
  }, [allFlat.length, cursor]);

  function go(hit: Hit) {
    let path: string;
    if (hit.kind === 'page') path = hit.path;
    else if (hit.kind === 'team') path = `/team/${encodeURIComponent(hit.name)}`;
    else path = `/players/${hit.id}`;
    setOpen(false);
    router.push(path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(allFlat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = allFlat[cursor];
      if (hit) go(hit);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('חיפוש')}
        title={t('חיפוש (/)')}
        className="flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1.5 text-[#8aaac8] transition hover:border-orange-500/40 hover:bg-orange-500/[0.08] hover:text-orange-400"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l3 3" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm px-3 pt-16 sm:pt-24"
          onClick={() => setOpen(false)}
          dir={dir}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f1e30] shadow-2xl shadow-black/60"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-[#8aaac8] shrink-0">
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l3 3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
                placeholder={t('חפש קבוצה, שחקן או דף…')}
                className="flex-1 bg-transparent text-base font-bold text-white placeholder:text-[#8aaac8] placeholder:font-semibold focus:outline-none"
              />
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs font-black text-[#8aaac8] hover:text-white"
              >
                Esc
              </button>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[70vh] overflow-y-auto divide-y divide-white/[0.04]">
              {!loaded && (
                <div className="px-5 py-10 text-center text-sm font-bold text-[#8aaac8]">{t('טוען…')}</div>
              )}

              {loaded && allFlat.length === 0 && (
                <div className="px-5 py-10 text-center text-sm font-bold text-[#8aaac8]">
                  {t('לא נמצאו תוצאות')} &ldquo;{query}&rdquo;
                </div>
              )}

              {pageHits.length > 0 && (
                <Section title={t('דפים')} icon="🧭">
                  {pageHits.map((p) => {
                    const idx = allFlat.indexOf(p);
                    return (
                      <Row key={`page-${p.id}`} active={idx === cursor} onClick={() => go(p)}>
                        <span className="text-xl shrink-0">{p.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-white">{t(p.name)}</p>
                          <p className="truncate text-xs font-semibold text-[#8aaac8]">{p.path}</p>
                        </div>
                      </Row>
                    );
                  })}
                </Section>
              )}

              {teamHits.length > 0 && (
                <Section title={t('קבוצות')} icon="🏀">
                  {teamHits.map((tm) => {
                    const idx = allFlat.indexOf(tm);
                    return (
                      <Row key={`team-${tm.id}`} active={idx === cursor} onClick={() => go(tm)}>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-[#1a2e45] flex items-center justify-center">
                          {tm.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tm.logo_url} alt={tm.name} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-xs font-black text-[#8aaac8]">{tm.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-white">{tm.name}</p>
                          <p className="truncate text-xs font-semibold text-[#8aaac8]">{t('קבוצה')}</p>
                        </div>
                      </Row>
                    );
                  })}
                </Section>
              )}

              {playerHits.length > 0 && (
                <Section title={t('שחקנים')} icon="👤">
                  {playerHits.map((p) => {
                    const idx = allFlat.indexOf(p);
                    return (
                      <Row key={`player-${p.id}`} active={idx === cursor} onClick={() => go(p)}>
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-[#1a2e45] flex items-center justify-center">
                          {p.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-black text-[#8aaac8]">{p.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-bold text-white flex items-center gap-1.5">
                            {p.jersey_number !== null && (
                              <span className="text-[10px] font-black text-orange-400 font-stats">#{p.jersey_number}</span>
                            )}
                            <span className="truncate">{p.name}</span>
                            {!p.is_active && (
                              <span className="text-[10px] font-bold text-[#8aaac8] shrink-0">{t('· לא פעיל')}</span>
                            )}
                          </p>
                          <p className="truncate text-xs font-semibold text-[#8aaac8]">{p.team_name ?? t('שחקן')}</p>
                        </div>
                      </Row>
                    );
                  })}
                </Section>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between border-t border-white/[0.06] bg-black/20 px-4 py-2 text-[10px] font-bold text-[#8aaac8]">
              <span className="flex items-center gap-3">
                <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-stats">↑↓</kbd> {t('לניווט')}
                <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-stats">↵</kbd> {t('לפתיחה')}
                <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-stats">Esc</kbd> {t('לסגירה')}
              </span>
              <span className="hidden sm:inline">{t('ליגת ליבי · חיפוש')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="sticky top-0 z-10 bg-[#0f1e30]/95 backdrop-blur-sm px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#8aaac8]">
        {icon} {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-right transition-colors ${
        active
          ? 'bg-orange-500/15 text-white'
          : 'hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}
