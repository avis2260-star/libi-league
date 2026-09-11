-- ─────────────────────────────────────────────────────────────────────────────
-- Add a `division` column to the teams table.
--
-- Until now, which teams belong to the North ('North') vs South ('South')
-- standings table was hard-coded in two TypeScript arrays
-- (NORTH_NAMES / SOUTH_NAMES). That meant adding a new team required a code
-- change before its standings row would ever sync from the Excel file.
--
-- This column moves that membership into the database so the admin "Add Team"
-- form can set it, and the Excel sync reads it at runtime. The hard-coded
-- arrays are kept in code as a fallback base (merged with this column) so the
-- original teams can never drop out of the standings even if this backfill
-- misses a renamed row.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS division text
  CHECK (division IN ('North', 'South'));

-- Backfill the existing rosters by canonical name. Best-effort: any team whose
-- stored name differs from the canonical string stays NULL here and is still
-- covered at runtime by the hard-coded fallback arrays.
UPDATE teams SET division = 'North'
WHERE division IS NULL AND name IN (
  'ידרסל חדרה', 'חולון', 'בני נתניה', 'גוטלמן השרון',
  'בני מוצקין', 'כ.ע. בת-ים', 'גלי בת-ים'
);

UPDATE teams SET division = 'South'
WHERE division IS NULL AND name IN (
  'ראשון "גפן" לציון', 'אחים קריית משה', 'קריית מלאכי',
  'אוריה ירושלים', 'אופק רחובות', 'אריות קריית גת',
  'שועלי אדיס אשדוד', 'החבר''ה הטובים גדרה'
);
