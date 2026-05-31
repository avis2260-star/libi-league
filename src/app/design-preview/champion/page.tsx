// ── Design preview — Champion banner ─────────────────────────────────────────
// Renders all four banner states (cup × {hero, compact}, league × {hero, compact})
// with mock data so the design can be reviewed end-to-end in the actual app
// shell (real fonts, dark gradient backdrop, RTL flow). Lives under
// /design-preview/champion and uses no real DB data — safe to share.

import ChampionBanner, { type ChampionBannerProps } from '@/components/ChampionBanner';

const SEASON = '2025-2026';

const leagueHero: ChampionBannerProps = {
  type: 'league',
  variant: 'hero',
  teamName: 'ידרסל חדרה',
  teamLogoUrl: null,
  opponentName: 'חולון',
  homeIsChampion: true,
  homeScore: 84,
  awayScore: 71,
  decidedOnLabel: '16 במאי 2026',
  season: SEASON,
  finalGameHref: '/playoff/series/7',
  bracketHref: '/playoff',
  videoUrl: 'https://youtube.com/watch?v=demo',
  lang: 'he',
};

const cupHero: ChampionBannerProps = {
  type: 'cup',
  variant: 'hero',
  teamName: 'ראשון "גפן" לציון',
  teamLogoUrl: null,
  opponentName: 'גוטלמן השרון',
  homeIsChampion: true,
  homeScore: 69,
  awayScore: 65,
  decidedOnLabel: '29 במאי 2026',
  season: SEASON,
  finalGameHref: '/cup/game/demo',
  bracketHref: '/cup',
  videoUrl: 'https://youtube.com/watch?v=demo',
  lang: 'he',
  mvp: {
    name: 'יוסף סהלו',
    teamName: 'ראשון "גפן" לציון',
    points: 27,
    threePointers: 4,
    photoUrl: null,
  },
  finalRoster: {
    teamName: 'ראשון "גפן" לציון',
    players: [
      { name: 'יוסף סהלו',  points: 27, threePointers: 4, fouls: 2 },
      { name: 'איתן תהלו',  points: 16, threePointers: 0, fouls: 3 },
      { name: 'יוסף למלם',  points: 12, threePointers: 1, fouls: 1 },
      { name: 'יעקב זמנה',  points: 9,  threePointers: 1, fouls: 4 },
      { name: 'עמית יונס',  points: 5,  threePointers: 0, fouls: 2 },
    ],
  },
};

const leagueCompact: ChampionBannerProps = { ...leagueHero, variant: 'compact' };
const cupCompact:    ChampionBannerProps = { ...cupHero,    variant: 'compact' };

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#8aaac8]">
      {children}
    </div>
  );
}

export default function ChampionBannerPreview() {
  return (
    <div dir="rtl" className="space-y-10">
      <header className="text-center">
        <h1 className="text-2xl font-black text-white">🏆 תצוגה מקדימה — באנר אלוף</h1>
        <p className="mt-2 text-sm font-bold text-[#8aaac8]">
          הרכיב האמיתי מתוך src/components/ChampionBanner.tsx · 4 מצבים
        </p>
      </header>

      <section>
        <Label>A · אלופת הליגה (פלייאוף) · גרסת hero · 30 הימים הראשונים</Label>
        <ChampionBanner {...leagueHero} />
      </section>

      <section>
        <Label>B · מחזיקת הגביע · גרסת hero · 30 הימים הראשונים</Label>
        <ChampionBanner {...cupHero} />
      </section>

      <section>
        <Label>C · אלופת הליגה · גרסה קומפקטית · יום 31 ואילך</Label>
        <ChampionBanner {...leagueCompact} />
      </section>

      <section>
        <Label>D · מחזיקת הגביע · גרסה קומפקטית · יום 31 ואילך</Label>
        <ChampionBanner {...cupCompact} />
      </section>

      <p className="mt-4 text-center text-xs text-[#5a7a9a]">
        שניהם נעלמים מדף הבית ברגע שמתחילים עונה חדשה (בלחיצת &ldquo;התחל עונה חדשה&rdquo; באדמין).
      </p>
    </div>
  );
}
