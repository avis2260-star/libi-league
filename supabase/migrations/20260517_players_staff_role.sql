-- Add a separate `staff_role` column so a player can have BOTH a playing
-- position (PG/SG/SF/PF/C) and a coaching/staff role at the same time
-- (e.g. a SG who is also assistant coach).
--
-- The existing `position` column keeps its strict CHECK so any code that
-- filters on on-court positions continues to work unchanged.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS staff_role TEXT
    CHECK (staff_role IS NULL OR staff_role IN ('COACH', 'ASST_COACH', 'MANAGER'));

COMMENT ON COLUMN players.staff_role IS
  'Optional coaching / staff role. Independent from `position` so a player can be both.';
