// Full LIBI League 2026-2027 season schedule — both divisions, 14 rounds.
//
// Extracted from the official libi.xlsx "תוצאות" sheet (dates, rounds,
// divisions and fixtures). This is a FALLBACK: getSeasonSchedule() prefers the
// live games rows in the database for this season, and only falls back to this
// list when none have been imported yet — so the לוח המשחקים / scoreboard /
// upcoming strips show the real fixtures immediately, and any later Excel
// upload (which creates games rows with scores) automatically takes over.
//
// homeTeam / awayTeam match the names in the teams table so logos resolve.

import type { ScheduleEntry } from "./libi-schedule";

export const SCHEDULE_2026_2027: ScheduleEntry[] = [
  // Round 1 — 2026-10-24
  { round: 1, date: "2026-10-24", homeTeam: "ידרסל חדרה", awayTeam: "בני נתניה", division: "North" },
  { round: 1, date: "2026-10-24", homeTeam: "כ.ע. בת-ים", awayTeam: "גלי בת-ים", division: "North" },
  { round: 1, date: "2026-10-24", homeTeam: "גוטלמן השרון", awayTeam: "חולון", division: "North" },
  { round: 1, date: "2026-10-24", homeTeam: "שועלי אדיס אשדוד", awayTeam: "קריית מלאכי", division: "South" },
  { round: 1, date: "2026-10-24", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "אריות קריית גת", division: "South" },
  { round: 1, date: "2026-10-24", homeTeam: "אחים קריית משה", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 1, date: "2026-10-24", homeTeam: "אוריה ירושלים", awayTeam: "אופק רחובות", division: "South" },

  // Round 2 — 2026-10-31
  { round: 2, date: "2026-10-31", homeTeam: "בני מוצקין", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 2, date: "2026-10-31", homeTeam: "גלי בת-ים", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 2, date: "2026-10-31", homeTeam: "כ.ע. בת-ים", awayTeam: "בני נתניה", division: "North" },
  { round: 2, date: "2026-10-31", homeTeam: "אוריה ירושלים", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 2, date: "2026-10-31", homeTeam: "אופק רחובות", awayTeam: "קריית מלאכי", division: "South" },
  { round: 2, date: "2026-10-31", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 2, date: "2026-10-31", homeTeam: "אריות קריית גת", awayTeam: "אחים קריית משה", division: "South" },

  // Round 3 — 2026-11-21
  { round: 3, date: "2026-11-21", homeTeam: "בני נתניה", awayTeam: "בני מוצקין", division: "North" },
  { round: 3, date: "2026-11-21", homeTeam: "גלי בת-ים", awayTeam: "חולון", division: "North" },
  { round: 3, date: "2026-11-21", homeTeam: "גוטלמן השרון", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 3, date: "2026-11-21", homeTeam: "שועלי אדיס אשדוד", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 3, date: "2026-11-21", homeTeam: "קריית מלאכי", awayTeam: "אוריה ירושלים", division: "South" },
  { round: 3, date: "2026-11-21", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "אריות קריית גת", division: "South" },
  { round: 3, date: "2026-11-21", homeTeam: "אופק רחובות", awayTeam: "אחים קריית משה", division: "South" },

  // Round 4 — 2026-11-28
  { round: 4, date: "2026-11-28", homeTeam: "חולון", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 4, date: "2026-11-28", homeTeam: "בני מוצקין", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 4, date: "2026-11-28", homeTeam: "ידרסל חדרה", awayTeam: "גלי בת-ים", division: "North" },
  { round: 4, date: "2026-11-28", homeTeam: "קריית מלאכי", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 4, date: "2026-11-28", homeTeam: "אריות קריית גת", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 4, date: "2026-11-28", homeTeam: "אחים קריית משה", awayTeam: "אוריה ירושלים", division: "South" },
  { round: 4, date: "2026-11-28", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "אופק רחובות", division: "South" },

  // Round 5 — 2026-12-19
  { round: 5, date: "2026-12-19", homeTeam: "חולון", awayTeam: "בני מוצקין", division: "North" },
  { round: 5, date: "2026-12-19", homeTeam: "גוטלמן השרון", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 5, date: "2026-12-19", homeTeam: "בני נתניה", awayTeam: "גלי בת-ים", division: "North" },
  { round: 5, date: "2026-12-19", homeTeam: "שועלי אדיס אשדוד", awayTeam: "אחים קריית משה", division: "South" },
  { round: 5, date: "2026-12-19", homeTeam: "אוריה ירושלים", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 5, date: "2026-12-19", homeTeam: "אופק רחובות", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 5, date: "2026-12-19", homeTeam: "אריות קריית גת", awayTeam: "קריית מלאכי", division: "South" },

  // Round 6 — 2026-12-26
  { round: 6, date: "2026-12-26", homeTeam: "חולון", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 6, date: "2026-12-26", homeTeam: "גוטלמן השרון", awayTeam: "בני נתניה", division: "North" },
  { round: 6, date: "2026-12-26", homeTeam: "כ.ע. בת-ים", awayTeam: "בני מוצקין", division: "North" },
  { round: 6, date: "2026-12-26", homeTeam: "קריית מלאכי", awayTeam: "אחים קריית משה", division: "South" },
  { round: 6, date: "2026-12-26", homeTeam: "אופק רחובות", awayTeam: "אריות קריית גת", division: "South" },
  { round: 6, date: "2026-12-26", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 6, date: "2026-12-26", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "אוריה ירושלים", division: "South" },

  // Round 7 — 2027-01-16
  { round: 7, date: "2027-01-16", homeTeam: "חולון", awayTeam: "בני נתניה", division: "North" },
  { round: 7, date: "2027-01-16", homeTeam: "ידרסל חדרה", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 7, date: "2027-01-16", homeTeam: "גלי בת-ים", awayTeam: "בני מוצקין", division: "North" },
  { round: 7, date: "2027-01-16", homeTeam: "אחים קריית משה", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 7, date: "2027-01-16", homeTeam: "שועלי אדיס אשדוד", awayTeam: "אופק רחובות", division: "South" },
  { round: 7, date: "2027-01-16", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "קריית מלאכי", division: "South" },
  { round: 7, date: "2027-01-16", homeTeam: "אוריה ירושלים", awayTeam: "אריות קריית גת", division: "South" },

  // Round 8 — 2027-02-06
  { round: 8, date: "2027-02-06", homeTeam: "חולון", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 8, date: "2027-02-06", homeTeam: "גלי בת-ים", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 8, date: "2027-02-06", homeTeam: "בני נתניה", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 8, date: "2027-02-06", homeTeam: "קריית מלאכי", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 8, date: "2027-02-06", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "אחים קריית משה", division: "South" },
  { round: 8, date: "2027-02-06", homeTeam: "אריות קריית גת", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 8, date: "2027-02-06", homeTeam: "אופק רחובות", awayTeam: "אוריה ירושלים", division: "South" },

  // Round 9 — 2027-02-13
  { round: 9, date: "2027-02-13", homeTeam: "ידרסל חדרה", awayTeam: "בני מוצקין", division: "North" },
  { round: 9, date: "2027-02-13", homeTeam: "גוטלמן השרון", awayTeam: "גלי בת-ים", division: "North" },
  { round: 9, date: "2027-02-13", homeTeam: "בני נתניה", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 9, date: "2027-02-13", homeTeam: "שועלי אדיס אשדוד", awayTeam: "אוריה ירושלים", division: "South" },
  { round: 9, date: "2027-02-13", homeTeam: "קריית מלאכי", awayTeam: "אופק רחובות", division: "South" },
  { round: 9, date: "2027-02-13", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "החבר'ה הטובים גדרה", division: "South" },
  { round: 9, date: "2027-02-13", homeTeam: "אחים קריית משה", awayTeam: "אריות קריית גת", division: "South" },

  // Round 10 — 2027-02-27
  { round: 10, date: "2027-02-27", homeTeam: "בני מוצקין", awayTeam: "בני נתניה", division: "North" },
  { round: 10, date: "2027-02-27", homeTeam: "חולון", awayTeam: "גלי בת-ים", division: "North" },
  { round: 10, date: "2027-02-27", homeTeam: "כ.ע. בת-ים", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 10, date: "2027-02-27", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 10, date: "2027-02-27", homeTeam: "אוריה ירושלים", awayTeam: "קריית מלאכי", division: "South" },
  { round: 10, date: "2027-02-27", homeTeam: "אריות קריית גת", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 10, date: "2027-02-27", homeTeam: "אחים קריית משה", awayTeam: "אופק רחובות", division: "South" },

  // Round 11 — 2027-03-06
  { round: 11, date: "2027-03-06", homeTeam: "כ.ע. בת-ים", awayTeam: "חולון", division: "North" },
  { round: 11, date: "2027-03-06", homeTeam: "גוטלמן השרון", awayTeam: "בני מוצקין", division: "North" },
  { round: 11, date: "2027-03-06", homeTeam: "גלי בת-ים", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 11, date: "2027-03-06", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "קריית מלאכי", division: "South" },
  { round: 11, date: "2027-03-06", homeTeam: "שועלי אדיס אשדוד", awayTeam: "אריות קריית גת", division: "South" },
  { round: 11, date: "2027-03-06", homeTeam: "אוריה ירושלים", awayTeam: "אחים קריית משה", division: "South" },
  { round: 11, date: "2027-03-06", homeTeam: "אופק רחובות", awayTeam: "ראשון \"גפן\" לציון", division: "South" },

  // Round 12 — 2027-03-20
  { round: 12, date: "2027-03-20", homeTeam: "בני מוצקין", awayTeam: "חולון", division: "North" },
  { round: 12, date: "2027-03-20", homeTeam: "ידרסל חדרה", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 12, date: "2027-03-20", homeTeam: "גלי בת-ים", awayTeam: "בני נתניה", division: "North" },
  { round: 12, date: "2027-03-20", homeTeam: "אחים קריית משה", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 12, date: "2027-03-20", homeTeam: "ראשון \"גפן\" לציון", awayTeam: "אוריה ירושלים", division: "South" },
  { round: 12, date: "2027-03-20", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "אופק רחובות", division: "South" },
  { round: 12, date: "2027-03-20", homeTeam: "קריית מלאכי", awayTeam: "אריות קריית גת", division: "South" },

  // Round 13 — 2027-03-26
  { round: 13, date: "2027-03-26", homeTeam: "ידרסל חדרה", awayTeam: "חולון", division: "North" },
  { round: 13, date: "2027-03-26", homeTeam: "בני נתניה", awayTeam: "גוטלמן השרון", division: "North" },
  { round: 13, date: "2027-03-26", homeTeam: "בני מוצקין", awayTeam: "כ.ע. בת-ים", division: "North" },
  { round: 13, date: "2027-03-26", homeTeam: "אחים קריית משה", awayTeam: "קריית מלאכי", division: "South" },
  { round: 13, date: "2027-03-26", homeTeam: "אריות קריית גת", awayTeam: "אופק רחובות", division: "South" },
  { round: 13, date: "2027-03-26", homeTeam: "שועלי אדיס אשדוד", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 13, date: "2027-03-26", homeTeam: "אוריה ירושלים", awayTeam: "החבר'ה הטובים גדרה", division: "South" },

  // Round 14 — 2027-03-09
  { round: 14, date: "2027-03-09", homeTeam: "בני נתניה", awayTeam: "חולון", division: "North" },
  { round: 14, date: "2027-03-09", homeTeam: "כ.ע. בת-ים", awayTeam: "ידרסל חדרה", division: "North" },
  { round: 14, date: "2027-03-09", homeTeam: "בני מוצקין", awayTeam: "גלי בת-ים", division: "North" },
  { round: 14, date: "2027-03-09", homeTeam: "החבר'ה הטובים גדרה", awayTeam: "אחים קריית משה", division: "South" },
  { round: 14, date: "2027-03-09", homeTeam: "אופק רחובות", awayTeam: "שועלי אדיס אשדוד", division: "South" },
  { round: 14, date: "2027-03-09", homeTeam: "קריית מלאכי", awayTeam: "ראשון \"גפן\" לציון", division: "South" },
  { round: 14, date: "2027-03-09", homeTeam: "אריות קריית גת", awayTeam: "אוריה ירושלים", division: "South" },
];
