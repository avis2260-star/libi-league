// ── LIBI League 2025-2026 · Static season data ────────────────────────────────
// Source: HTML reference file + Excel schedule.
// When Supabase data is available, these are used as fallbacks / seed data.

export type Standing = {
  rank: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  pf: number;      // points for
  pa: number;      // points against
  diff: number;
  techni: number;  // game-forfeit count
  penalty: number; // point deduction (negative, or 0)
  pts: number;
};

export type GameResult = {
  round: number;
  date: string;   // DD.MM.YY display format
  home: string;
  away: string;
  sh: number;     // score home
  sa: number;     // score away
  techni: string; // e.g. 'טכני לגדרה' | ''
  division: 'North' | 'South';
};

export type UpcomingGame = {
  round: number;
  date: string;
  home: string;
  away: string;
  division: 'North' | 'South';
};

export type CupMatch = {
  home: string;
  sh: number | null;
  away: string;
  sa: number | null;
  techni?: boolean;
  upcoming?: boolean;
};

export type CupRound = {
  stage: string;
  date: string;
  matches: CupMatch[];
};

// ── Standings ─────────────────────────────────────────────────────────────────

export const NORTH_TABLE: Standing[] = [
  { rank: 1, name: 'ידרסל חדרה',        games: 7, wins: 6, losses: 1, pf: 416, pa: 310, diff: 106,  techni: 0, penalty: -1, pts: 12 },
  { rank: 2, name: 'חולון',              games: 7, wins: 5, losses: 2, pf: 423, pa: 382, diff: 41,   techni: 0, penalty: -1, pts: 11 },
  { rank: 3, name: 'בני נתניה',          games: 7, wins: 4, losses: 3, pf: 374, pa: 369, diff: 5,    techni: 0, penalty: -1, pts: 10 },
  { rank: 4, name: 'גוטלמן השרון',       games: 7, wins: 4, losses: 3, pf: 381, pa: 359, diff: 22,   techni: 0, penalty: -2, pts: 9  },
  { rank: 5, name: 'בני מוצקין',         games: 6, wins: 3, losses: 3, pf: 362, pa: 325, diff: 37,   techni: 0, penalty: -2, pts: 7  },
  { rank: 6, name: 'כ.ע. בת-ים',         games: 7, wins: 2, losses: 3, pf: 287, pa: 343, diff: -56,  techni: 2, penalty: -2, pts: 5  },
  { rank: 7, name: 'גלי בת-ים',          games: 7, wins: 0, losses: 5, pf: 212, pa: 367, diff: -155, techni: 2, penalty: -1, pts: 4  },
];

export const SOUTH_TABLE: Standing[] = [
  { rank: 1, name: 'ראשון "גפן" לציון',  games: 8, wins: 6, losses: 2, pf: 589, pa: 463, diff: 126,  techni: 0, penalty:  0, pts: 14 },
  { rank: 2, name: 'אחים קריית משה',     games: 8, wins: 5, losses: 3, pf: 497, pa: 491, diff: 6,    techni: 0, penalty:  0, pts: 13 },
  { rank: 3, name: 'קריית מלאכי',        games: 8, wins: 5, losses: 3, pf: 473, pa: 495, diff: -22,  techni: 0, penalty:  0, pts: 13 },
  { rank: 4, name: 'אוריה ירושלים',      games: 8, wins: 6, losses: 2, pf: 540, pa: 478, diff: 62,   techni: 0, penalty: -2, pts: 12 },
  { rank: 5, name: 'אופק רחובות',        games: 8, wins: 4, losses: 4, pf: 471, pa: 430, diff: 41,   techni: 0, penalty:  0, pts: 12 },
  { rank: 6, name: 'אריות קריית גת',     games: 8, wins: 4, losses: 4, pf: 451, pa: 442, diff: 9,    techni: 0, penalty:  0, pts: 12 },
  { rank: 7, name: 'אדיס אשדוד',         games: 8, wins: 2, losses: 6, pf: 508, pa: 515, diff: -7,   techni: 0, penalty: -1, pts: 9  },
  { rank: 8, name: "החבר'ה הטובים גדרה", games: 8, wins: 0, losses: 6, pf: 251, pa: 466, diff: -215, techni: 2, penalty: -1, pts: 5  },
];

// ── Completed game results (rounds 1-8) ───────────────────────────────────────

export const GAME_RESULTS: GameResult[] = [
  // Round 1 — 01.11.25
  { round: 1, date: '01.11.25', home: 'ידרסל חדרה',          away: 'בני נתניה',           sh: 54, sa: 57, techni: '',               division: 'North' },
  { round: 1, date: '01.11.25', home: 'כ.ע. בת-ים',           away: 'גלי בת-ים',            sh: 49, sa: 46, techni: '',               division: 'North' },
  { round: 1, date: '01.11.25', home: 'גוטלמן השרון',         away: 'חולון',                sh: 51, sa: 59, techni: '',               division: 'North' },
  { round: 1, date: '01.11.25', home: 'אדיס אשדוד',           away: 'קריית מלאכי',          sh: 50, sa: 52, techni: '',               division: 'South' },
  { round: 1, date: '01.11.25', home: "החבר'ה הטובים גדרה",   away: 'אריות קריית גת',       sh: 0,  sa: 20, techni: 'טכני לגדרה',     division: 'South' },
  { round: 1, date: '01.11.25', home: 'אחים קריית משה',       away: 'ראשון "גפן" לציון',    sh: 64, sa: 72, techni: '',               division: 'South' },
  { round: 1, date: '01.11.25', home: 'אוריה ירושלים',        away: 'אופק רחובות',          sh: 64, sa: 47, techni: '',               division: 'South' },

  // Round 2 — 08.11.25
  { round: 2, date: '08.11.25', home: 'בני מוצקין',           away: 'ידרסל חדרה',           sh: 43, sa: 50, techni: '',               division: 'North' },
  { round: 2, date: '08.11.25', home: 'גלי בת-ים',            away: 'גוטלמן השרון',         sh: 54, sa: 61, techni: '',               division: 'North' },
  { round: 2, date: '08.11.25', home: 'כ.ע. בת-ים',           away: 'בני נתניה',            sh: 58, sa: 64, techni: '',               division: 'North' },
  { round: 2, date: '08.11.25', home: 'אוריה ירושלים',        away: 'אדיס אשדוד',           sh: 59, sa: 50, techni: '',               division: 'South' },
  { round: 2, date: '08.11.25', home: 'אופק רחובות',          away: 'קריית מלאכי',          sh: 39, sa: 57, techni: '',               division: 'South' },
  { round: 2, date: '08.11.25', home: "החבר'ה הטובים גדרה",   away: 'ראשון "גפן" לציון',    sh: 39, sa: 54, techni: '',               division: 'South' },
  { round: 2, date: '08.11.25', home: 'אריות קריית גת',       away: 'אחים קריית משה',       sh: 67, sa: 68, techni: '',               division: 'South' },

  // Round 3 — 29.11.25
  { round: 3, date: '29.11.25', home: 'בני נתניה',            away: 'בני מוצקין',           sh: 60, sa: 61, techni: '',               division: 'North' },
  { round: 3, date: '29.11.25', home: 'גלי בת-ים',            away: 'חולון',                sh: 0,  sa: 20, techni: 'טכני לגלי',      division: 'North' },
  { round: 3, date: '29.11.25', home: 'גוטלמן השרון',         away: 'כ.ע. בת-ים',           sh: 20, sa: 0,  techni: 'טכני לכח עולה', division: 'North' },
  { round: 3, date: '29.11.25', home: 'אדיס אשדוד',           away: "החבר'ה הטובים גדרה",   sh: 74, sa: 42, techni: '',               division: 'South' },
  { round: 3, date: '29.11.25', home: 'קריית מלאכי',          away: 'אוריה ירושלים',        sh: 65, sa: 64, techni: '',               division: 'South' },
  { round: 3, date: '29.11.25', home: 'ראשון "גפן" לציון',    away: 'אריות קריית גת',       sh: 64, sa: 53, techni: '',               division: 'South' },
  { round: 3, date: '29.11.25', home: 'אופק רחובות',          away: 'אחים קריית משה',       sh: 67, sa: 68, techni: '',               division: 'South' },

  // Round 4 — 20.12.25
  { round: 4, date: '20.12.25', home: 'חולון',                away: 'כ.ע. בת-ים',           sh: 75, sa: 57, techni: '',               division: 'North' },
  { round: 4, date: '20.12.25', home: 'בני מוצקין',           away: 'גוטלמן השרון',         sh: 53, sa: 63, techni: '',               division: 'North' },
  { round: 4, date: '20.12.25', home: 'ידרסל חדרה',           away: 'גלי בת-ים',            sh: 65, sa: 20, techni: '',               division: 'North' },
  { round: 4, date: '20.12.25', home: 'קריית מלאכי',          away: "החבר'ה הטובים גדרה",   sh: 76, sa: 49, techni: '',               division: 'South' },
  { round: 4, date: '20.12.25', home: 'אריות קריית גת',       away: 'אדיס אשדוד',           sh: 64, sa: 56, techni: '',               division: 'South' },
  { round: 4, date: '20.12.25', home: 'אחים קריית משה',       away: 'אוריה ירושלים',        sh: 78, sa: 80, techni: '',               division: 'South' },
  { round: 4, date: '20.12.25', home: 'ראשון "גפן" לציון',    away: 'אופק רחובות',          sh: 70, sa: 54, techni: '',               division: 'South' },

  // Round 5 — 10.01.26
  { round: 5, date: '10.01.26', home: 'חולון',                away: 'בני מוצקין',           sh: 57, sa: 55, techni: '',               division: 'North' },
  { round: 5, date: '10.01.26', home: 'גוטלמן השרון',         away: 'ידרסל חדרה',           sh: 64, sa: 72, techni: '',               division: 'North' },
  { round: 5, date: '10.01.26', home: 'בני נתניה',            away: 'גלי בת-ים',            sh: 20, sa: 0,  techni: 'טכני לגלי',      division: 'North' },
  { round: 5, date: '10.01.26', home: 'אדיס אשדוד',           away: 'אחים קריית משה',       sh: 74, sa: 76, techni: '',               division: 'South' },
  { round: 5, date: '10.01.26', home: 'אוריה ירושלים',        away: 'ראשון "גפן" לציון',    sh: 72, sa: 70, techni: '',               division: 'South' },
  { round: 5, date: '10.01.26', home: 'אופק רחובות',          away: "החבר'ה הטובים גדרה",   sh: 72, sa: 27, techni: '',               division: 'South' },
  { round: 5, date: '10.01.26', home: 'אריות קריית גת',       away: 'קריית מלאכי',          sh: 60, sa: 56, techni: '',               division: 'South' },

  // Round 6 — 24.01.26
  { round: 6, date: '24.01.26', home: 'חולון',                away: 'ידרסל חדרה',           sh: 66, sa: 85, techni: '',               division: 'North' },
  { round: 6, date: '24.01.26', home: 'גוטלמן השרון',         away: 'בני נתניה',            sh: 50, sa: 51, techni: '',               division: 'North' },
  { round: 6, date: '24.01.26', home: 'כ.ע. בת-ים',           away: 'בני מוצקין',           sh: 54, sa: 67, techni: '',               division: 'North' },
  { round: 6, date: '24.01.26', home: 'קריית מלאכי',          away: 'אחים קריית משה',       sh: 55, sa: 63, techni: '',               division: 'South' },
  { round: 6, date: '24.01.26', home: 'אופק רחובות',          away: 'אריות קריית גת',       sh: 76, sa: 51, techni: '',               division: 'South' },
  { round: 6, date: '24.01.26', home: 'ראשון "גפן" לציון',    away: 'אדיס אשדוד',           sh: 84, sa: 87, techni: '',               division: 'South' },
  { round: 6, date: '24.01.26', home: "החבר'ה הטובים גדרה",   away: 'אוריה ירושלים',        sh: 45, sa: 81, techni: '',               division: 'South' },

  // Round 7 — 25.01.26
  { round: 7, date: '25.01.26', home: 'חולון',                away: 'בני נתניה',            sh: 76, sa: 62, techni: '',               division: 'North' },
  { round: 7, date: '25.01.26', home: 'ידרסל חדרה',           away: 'כ.ע. בת-ים',           sh: 20, sa: 0,  techni: 'טכני לכ.ע.',     division: 'North' },
  { round: 7, date: '25.01.26', home: 'גלי בת-ים',            away: 'בני מוצקין',           sh: 41, sa: 83, techni: '',               division: 'North' },
  { round: 7, date: '25.01.26', home: 'אחים קריית משה',       away: "החבר'ה הטובים גדרה",   sh: 20, sa: 0,  techni: 'טכני לגדרה',     division: 'South' },
  { round: 7, date: '25.01.26', home: 'אדיס אשדוד',           away: 'אופק רחובות',          sh: 46, sa: 60, techni: '',               division: 'South' },
  { round: 7, date: '25.01.26', home: 'ראשון "גפן" לציון',    away: 'קריית מלאכי',          sh: 99, sa: 34, techni: '',               division: 'South' },
  { round: 7, date: '25.01.26', home: 'אוריה ירושלים',        away: 'אריות קריית גת',       sh: 73, sa: 67, techni: '',               division: 'South' },

  // Round 8 — 21.02.26
  { round: 8, date: '21.02.26', home: 'חולון',                away: 'גוטלמן השרון',         sh: 70, sa: 72, techni: '',               division: 'North' },
  { round: 8, date: '21.02.26', home: 'גלי בת-ים',            away: 'כ.ע. בת-ים',           sh: 51, sa: 69, techni: '',               division: 'North' },
  { round: 8, date: '21.02.26', home: 'בני נתניה',            away: 'ידרסל חדרה',           sh: 60, sa: 70, techni: '',               division: 'North' },
  { round: 8, date: '21.02.26', home: 'קריית מלאכי',          away: 'אדיס אשדוד',           sh: 78, sa: 71, techni: '',               division: 'South' },
  { round: 8, date: '21.02.26', home: 'ראשון "גפן" לציון',    away: 'אחים קריית משה',       sh: 76, sa: 60, techni: '',               division: 'South' },
  { round: 8, date: '21.02.26', home: 'אריות קריית גת',       away: "החבר'ה הטובים גדרה",   sh: 69, sa: 49, techni: '',               division: 'South' },
  { round: 8, date: '21.02.26', home: 'אופק רחובות',          away: 'אוריה ירושלים',        sh: 56, sa: 47, techni: '',               division: 'South' },
];

// ── Upcoming games ─────────────────────────────────────────────────────────────

export const UPCOMING_GAMES: UpcomingGame[] = [
  { round: 9, date: '28.02.26', home: 'ידרסל חדרה',           away: 'בני מוצקין',           division: 'North' },
  { round: 9, date: '28.02.26', home: 'גוטלמן השרון',         away: 'גלי בת-ים',            division: 'North' },
  { round: 9, date: '28.02.26', home: 'בני נתניה',            away: 'כ.ע. בת-ים',           division: 'North' },
  { round: 9, date: '28.02.26', home: 'אדיס אשדוד',           away: 'אוריה ירושלים',        division: 'South' },
  { round: 9, date: '28.02.26', home: 'קריית מלאכי',          away: 'אופק רחובות',          division: 'South' },
  { round: 9, date: '28.02.26', home: 'ראשון "גפן" לציון',    away: "החבר'ה הטובים גדרה",   division: 'South' },
  { round: 9, date: '28.02.26', home: 'אחים קריית משה',       away: 'אריות קריית גת',       division: 'South' },
];

// ── Cup ───────────────────────────────────────────────────────────────────────

export const CUP_ROUNDS: CupRound[] = [
  {
    stage: 'שמינית גמר', date: '22.11.25',
    matches: [
      { home: 'גלי בת-ים',            sh: 66, away: 'גוטלמן השרון',      sa: 75 },
      { home: 'ידרסל חדרה',           sh: 65, away: 'ה.ה. גדרה',         sa: 40 },
      { home: 'אוריה ירושלים',        sh: 56, away: 'א.ט. ק. גת',        sa: 55 },
      { home: 'חולון',                sh: 61, away: 'אופק רחובות',        sa: 54 },
      { home: 'בני נתניה',            sh: 63, away: 'אדיס אשדוד',         sa: 49 },
      { home: 'קריית מלאכי',          sh: 20, away: 'בני מוצקין',         sa: 0,  techni: true },
      { home: 'ראשון "גפן" לציון',    sh: 20, away: 'כ.ע. בת-ים',         sa: 0,  techni: true },
    ],
  },
  {
    stage: 'רבע גמר', date: '13.12.25',
    matches: [
      { home: 'ראשון "גפן" לציון',    sh: 73, away: 'אחים ק. משה',        sa: 65 },
      { home: 'ק. מלאכי',             sh: 67, away: 'אוריה ירושלים',      sa: 77 },
      { home: 'חולון',                sh: 43, away: 'בני נתניה',           sa: 64 },
      { home: 'ידרסל חדרה',           sh: 38, away: 'גוטלמן השרון',       sa: 57 },
    ],
  },
  {
    stage: 'חצי גמר', date: '03.01.26',
    matches: [
      { home: 'אוריה ירושלים',        sh: 67, away: 'גוטלמן השרון',       sa: 79 },
      { home: 'בני נתניה',            sh: 55, away: 'ראשון "גפן" לציון',  sa: 68 },
    ],
  },
  {
    stage: 'גמר', date: '21.03.26',
    matches: [
      { home: 'ראשון "גפן" לציון', sh: null, away: 'גוטלמן השרון', sa: null, upcoming: true },
    ],
  },
];

// ── Season-wide computed facts ─────────────────────────────────────────────────
// Pre-computed so server components don't need to re-derive them.

const realGames = GAME_RESULTS.filter((g) => g.sh > 20 || g.sa > 20);

function winner(g: GameResult) {
  return g.sh > g.sa
    ? { team: g.home, score: g.sh, oppScore: g.sa, opp: g.away }
    : { team: g.away, score: g.sa, oppScore: g.sh, opp: g.home };
}

const allTeamScores = realGames.flatMap((g) => [
  { score: g.sh, team: g.home, opp: g.away, date: g.date, round: g.round },
  { score: g.sa, team: g.away, opp: g.home, date: g.date, round: g.round },
]);

export const SEASON_RECORDS = {
  highScore:   allTeamScores.reduce((a, b) => b.score > a.score ? b : a),
  highCombined: realGames.reduce((a, b) => (b.sh + b.sa) > (a.sh + a.sa) ? b : a),
  biggestWin:  realGames.reduce((a, b) => Math.abs(b.sh - b.sa) > Math.abs(a.sh - a.sa) ? b : a),
  closestCount: realGames.filter((g) => Math.abs(g.sh - g.sa) === 1).length,
};

export const CURRENT_ROUND = 8;
export const TOTAL_ROUNDS  = 14;
export const TOTAL_TEAMS   = 15;
export const GAMES_PLAYED  = GAME_RESULTS.length;
