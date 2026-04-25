// Full LIBI League 2025-2026 season schedule — both divisions, 14 rounds each.
// homeTeam / awayTeam strings must exactly match the names in the teams table.

export type ScheduleEntry = {
  round: number;
  date: string;      // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  division: 'South' | 'North';
  location?: string; // venue name
  time?: string;     // HH:MM (24h)
};

export const LIBI_SCHEDULE: ScheduleEntry[] = [
  // ── SOUTH DIVISION ─────────────────────────────────────────────────────────

  // Round 1 — 2025-11-01
  { round: 1, date: '2025-11-01', homeTeam: 'אדיס אשדוד',             awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 1, date: '2025-11-01', homeTeam: 'אחים קריית משה',          awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 1, date: '2025-11-01', homeTeam: 'החברה הטובים גדרה',       awayTeam: 'אריות קריית גת',           division: 'South' },
  { round: 1, date: '2025-11-01', homeTeam: 'אוריה ירושלים',           awayTeam: 'אופק רחובות',              division: 'South' },

  // Round 2 — 2025-11-08
  { round: 2, date: '2025-11-08', homeTeam: 'אוריה ירושלים',           awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 2, date: '2025-11-08', homeTeam: 'אופק רחובות',             awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 2, date: '2025-11-08', homeTeam: 'החברה הטובים גדרה',       awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 2, date: '2025-11-08', homeTeam: 'אריות קריית גת',          awayTeam: 'אחים קריית משה',           division: 'South' },

  // Round 3 — 2025-11-29
  { round: 3, date: '2025-11-29', homeTeam: 'אדיס אשדוד',             awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 3, date: '2025-11-29', homeTeam: 'קריית מלאכי',            awayTeam: 'אוריה ירושלים',            division: 'South' },
  { round: 3, date: '2025-11-29', homeTeam: 'ראשון גפן לציון',         awayTeam: 'אריות קריית גת',           division: 'South' },
  { round: 3, date: '2025-11-29', homeTeam: 'אופק רחובות',             awayTeam: 'אחים קריית משה',           division: 'South' },

  // Round 4 — 2025-12-20
  { round: 4, date: '2025-12-20', homeTeam: 'קריית מלאכי',            awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 4, date: '2025-12-20', homeTeam: 'אריות קריית גת',          awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 4, date: '2025-12-20', homeTeam: 'אחים קריית משה',          awayTeam: 'אוריה ירושלים',            division: 'South' },
  { round: 4, date: '2025-12-20', homeTeam: 'ראשון גפן לציון',         awayTeam: 'אופק רחובות',              division: 'South' },

  // Round 5 — 2026-01-10
  { round: 5, date: '2026-01-10', homeTeam: 'אדיס אשדוד',             awayTeam: 'אחים קריית משה',           division: 'South' },
  { round: 5, date: '2026-01-10', homeTeam: 'אוריה ירושלים',           awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 5, date: '2026-01-10', homeTeam: 'אופק רחובות',             awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 5, date: '2026-01-10', homeTeam: 'אריות קריית גת',          awayTeam: 'קריית מלאכי',             division: 'South' },

  // Round 6 — 2026-01-24
  { round: 6, date: '2026-01-24', homeTeam: 'קריית מלאכי',            awayTeam: 'אחים קריית משה',           division: 'South' },
  { round: 6, date: '2026-01-24', homeTeam: 'החברה הטובים גדרה',       awayTeam: 'אוריה ירושלים',            division: 'South' },
  { round: 6, date: '2026-01-24', homeTeam: 'ראשון גפן לציון',         awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 6, date: '2026-01-24', homeTeam: 'אופק רחובות',             awayTeam: 'אריות קריית גת',           division: 'South' },

  // Round 7 — 2026-01-31
  { round: 7, date: '2026-01-31', homeTeam: 'אחים קריית משה',          awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 7, date: '2026-01-31', homeTeam: 'אדיס אשדוד',             awayTeam: 'אופק רחובות',              division: 'South' },
  { round: 7, date: '2026-01-31', homeTeam: 'ראשון גפן לציון',         awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 7, date: '2026-01-31', homeTeam: 'אוריה ירושלים',           awayTeam: 'אריות קריית גת',           division: 'South' },

  // Round 8 — 2026-02-21
  { round: 8, date: '2026-02-21', homeTeam: 'קריית מלאכי',            awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 8, date: '2026-02-21', homeTeam: 'ראשון גפן לציון',         awayTeam: 'אחים קריית משה',           division: 'South' },
  { round: 8, date: '2026-02-21', homeTeam: 'אריות קריית גת',          awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 8, date: '2026-02-21', homeTeam: 'אופק רחובות',             awayTeam: 'אוריה ירושלים',            division: 'South' },

  // Round 9 — 2026-04-24
  { round: 9, date: '2026-04-24', homeTeam: 'אדיס אשדוד',             awayTeam: 'אוריה ירושלים',            division: 'South' },
  { round: 9, date: '2026-04-24', homeTeam: 'קריית מלאכי',            awayTeam: 'אופק רחובות',              division: 'South' },
  { round: 9, date: '2026-04-24', homeTeam: 'ראשון גפן לציון',         awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 9, date: '2026-04-24', homeTeam: 'אחים קריית משה',          awayTeam: 'אריות קריית גת',           division: 'South' },

  // Round 10 — 2026-05-01
  { round: 10, date: '2026-05-01', homeTeam: 'החברה הטובים גדרה',      awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 10, date: '2026-05-01', homeTeam: 'אוריה ירושלים',          awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 10, date: '2026-05-01', homeTeam: 'אריות קריית גת',         awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 10, date: '2026-05-01', homeTeam: 'אחים קריית משה',         awayTeam: 'אופק רחובות',              division: 'South' },

  // Round 11 — 2026-05-08
  { round: 11, date: '2026-05-08', homeTeam: 'החברה הטובים גדרה',      awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 11, date: '2026-05-08', homeTeam: 'אדיס אשדוד',            awayTeam: 'אריות קריית גת',           division: 'South' },
  { round: 11, date: '2026-05-08', homeTeam: 'אוריה ירושלים',          awayTeam: 'אחים קריית משה',           division: 'South' },
  { round: 11, date: '2026-05-08', homeTeam: 'אופק רחובות',            awayTeam: 'ראשון גפן לציון',          division: 'South' },

  // Round 12 — 2026-06-05
  { round: 12, date: '2026-06-05', homeTeam: 'אחים קריית משה',         awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 12, date: '2026-06-05', homeTeam: 'ראשון גפן לציון',        awayTeam: 'אוריה ירושלים',            division: 'South' },
  { round: 12, date: '2026-06-05', homeTeam: 'החברה הטובים גדרה',      awayTeam: 'אופק רחובות',              division: 'South' },
  { round: 12, date: '2026-06-05', homeTeam: 'קריית מלאכי',           awayTeam: 'אריות קריית גת',           division: 'South' },

  // Round 13 — 2026-06-12
  { round: 13, date: '2026-06-12', homeTeam: 'אחים קריית משה',         awayTeam: 'קריית מלאכי',             division: 'South' },
  { round: 13, date: '2026-06-12', homeTeam: 'אוריה ירושלים',          awayTeam: 'החברה הטובים גדרה',        division: 'South' },
  { round: 13, date: '2026-06-12', homeTeam: 'אדיס אשדוד',            awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 13, date: '2026-06-12', homeTeam: 'אריות קריית גת',         awayTeam: 'אופק רחובות',              division: 'South' },

  // Round 14 — 2026-06-19
  { round: 14, date: '2026-06-19', homeTeam: 'החברה הטובים גדרה',      awayTeam: 'אחים קריית משה',           division: 'South' },
  { round: 14, date: '2026-06-19', homeTeam: 'אופק רחובות',            awayTeam: 'אדיס אשדוד',              division: 'South' },
  { round: 14, date: '2026-06-19', homeTeam: 'קריית מלאכי',           awayTeam: 'ראשון גפן לציון',          division: 'South' },
  { round: 14, date: '2026-06-19', homeTeam: 'אריות קריית גת',         awayTeam: 'אוריה ירושלים',            division: 'South' },

  // ── NORTH DIVISION ─────────────────────────────────────────────────────────

  // Round 1 — 2025-11-01
  { round: 1, date: '2025-11-01', homeTeam: 'גוטלמן השרון',           awayTeam: 'חולון',                   division: 'North' },
  { round: 1, date: '2025-11-01', homeTeam: 'כ.ע. בת-ים',             awayTeam: 'גלי בת-ים',               division: 'North' },
  { round: 1, date: '2025-11-01', homeTeam: 'ידרסל חדרה',             awayTeam: 'בני נתניה',               division: 'North' },

  // Round 2 — 2025-11-08
  { round: 2, date: '2025-11-08', homeTeam: 'בני מוצקין',             awayTeam: 'ידרסל חדרה',              division: 'North' },
  { round: 2, date: '2025-11-08', homeTeam: 'גלי בת-ים',              awayTeam: 'גוטלמן השרון',            division: 'North' },
  { round: 2, date: '2025-11-08', homeTeam: 'כ.ע. בת-ים',             awayTeam: 'בני נתניה',               division: 'North' },

  // Round 3 — 2025-11-29
  { round: 3, date: '2025-11-29', homeTeam: 'בני נתניה',              awayTeam: 'בני מוצקין',              division: 'North' },
  { round: 3, date: '2025-11-29', homeTeam: 'גלי בת-ים',              awayTeam: 'חולון',                   division: 'North' },
  { round: 3, date: '2025-11-29', homeTeam: 'גוטלמן השרון',           awayTeam: 'כ.ע. בת-ים',              division: 'North' },

  // Round 4 — 2025-12-20
  { round: 4, date: '2025-12-20', homeTeam: 'חולון',                  awayTeam: 'כ.ע. בת-ים',              division: 'North' },
  { round: 4, date: '2025-12-20', homeTeam: 'בני מוצקין',             awayTeam: 'גוטלמן השרון',            division: 'North' },
  { round: 4, date: '2025-12-20', homeTeam: 'ידרסל חדרה',             awayTeam: 'גלי בת-ים',               division: 'North' },

  // Round 5 — 2026-01-10
  { round: 5, date: '2026-01-10', homeTeam: 'חולון',                  awayTeam: 'בני מוצקין',              division: 'North' },
  { round: 5, date: '2026-01-10', homeTeam: 'גוטלמן השרון',           awayTeam: 'ידרסל חדרה',              division: 'North' },
  { round: 5, date: '2026-01-10', homeTeam: 'בני נתניה',              awayTeam: 'גלי בת-ים',               division: 'North' },

  // Round 6 — 2026-01-24
  { round: 6, date: '2026-01-24', homeTeam: 'חולון',                  awayTeam: 'ידרסל חדרה',              division: 'North' },
  { round: 6, date: '2026-01-24', homeTeam: 'גוטלמן השרון',           awayTeam: 'בני נתניה',               division: 'North' },
  { round: 6, date: '2026-01-24', homeTeam: 'כ.ע. בת-ים',             awayTeam: 'בני מוצקין',              division: 'North' },

  // Round 7 — 2026-01-31
  { round: 7, date: '2026-01-31', homeTeam: 'גלי בת-ים',              awayTeam: 'בני מוצקין',              division: 'North' },
  { round: 7, date: '2026-01-31', homeTeam: 'ידרסל חדרה',             awayTeam: 'כ.ע. בת-ים',              division: 'North' },
  { round: 7, date: '2026-01-31', homeTeam: 'חולון',                  awayTeam: 'בני נתניה',               division: 'North' },

  // Round 8 — 2026-02-21
  { round: 8, date: '2026-02-21', homeTeam: 'חולון',                  awayTeam: 'גוטלמן השרון',            division: 'North' },
  { round: 8, date: '2026-02-21', homeTeam: 'גלי בת-ים',              awayTeam: 'כ.ע. בת-ים',              division: 'North' },
  { round: 8, date: '2026-02-21', homeTeam: 'בני נתניה',              awayTeam: 'ידרסל חדרה',              division: 'North' },

  // Round 9 — 2026-04-24
  { round: 9, date: '2026-04-24', homeTeam: 'ידרסל חדרה',             awayTeam: 'בני מוצקין',              division: 'North' },
  { round: 9, date: '2026-04-24', homeTeam: 'גוטלמן השרון',           awayTeam: 'גלי בת-ים',               division: 'North' },
  { round: 9, date: '2026-04-24', homeTeam: 'בני נתניה',              awayTeam: 'כ.ע. בת-ים',              division: 'North' },

  // Round 10 — 2026-05-01
  { round: 10, date: '2026-05-01', homeTeam: 'בני מוצקין',            awayTeam: 'בני נתניה',               division: 'North' },
  { round: 10, date: '2026-05-01', homeTeam: 'חולון',                 awayTeam: 'גלי בת-ים',               division: 'North' },
  { round: 10, date: '2026-05-01', homeTeam: 'כ.ע. בת-ים',            awayTeam: 'גוטלמן השרון',            division: 'North' },

  // Round 11 — 2026-05-08
  { round: 11, date: '2026-05-08', homeTeam: 'כ.ע. בת-ים',            awayTeam: 'חולון',                   division: 'North' },
  { round: 11, date: '2026-05-08', homeTeam: 'גוטלמן השרון',          awayTeam: 'בני מוצקין',              division: 'North' },
  { round: 11, date: '2026-05-08', homeTeam: 'גלי בת-ים',             awayTeam: 'ידרסל חדרה',              division: 'North' },

  // Round 12 — 2026-06-05
  { round: 12, date: '2026-06-05', homeTeam: 'בני מוצקין',            awayTeam: 'חולון',                   division: 'North' },
  { round: 12, date: '2026-06-05', homeTeam: 'ידרסל חדרה',            awayTeam: 'גוטלמן השרון',            division: 'North' },
  { round: 12, date: '2026-06-05', homeTeam: 'גלי בת-ים',             awayTeam: 'בני נתניה',               division: 'North' },

  // Round 13 — 2026-06-12
  { round: 13, date: '2026-06-12', homeTeam: 'ידרסל חדרה',            awayTeam: 'חולון',                   division: 'North' },
  { round: 13, date: '2026-06-12', homeTeam: 'בני נתניה',             awayTeam: 'גוטלמן השרון',            division: 'North' },
  { round: 13, date: '2026-06-12', homeTeam: 'בני מוצקין',            awayTeam: 'כ.ע. בת-ים',              division: 'North' },

  // Round 14 — 2026-06-19
  { round: 14, date: '2026-06-19', homeTeam: 'בני מוצקין',            awayTeam: 'גלי בת-ים',               division: 'North' },
  { round: 14, date: '2026-06-19', homeTeam: 'כ.ע. בת-ים',            awayTeam: 'ידרסל חדרה',              division: 'North' },
  { round: 14, date: '2026-06-19', homeTeam: 'בני נתניה',             awayTeam: 'חולון',                   division: 'North' },
];
