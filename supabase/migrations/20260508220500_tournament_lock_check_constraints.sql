-- PR 4 follow-up — defense-in-depth CHECK constraints on the lockable
-- rules. iOS already validates these in TournamentRulesDraft + the
-- save-button gate, but the DB had no safety net. A bug in any future
-- iOS path or a hand-edit could land an inconsistent row (e.g.
-- course_locked = true with default_course_id = NULL) and break the
-- wizard's tournament-link flow.
--
-- The cleanup pass before the CHECK additions relaxes the lock to false
-- on any existing inconsistent rows. "Locked to nothing" is meaningless;
-- "unlocked" is the safe interpretation that keeps the row valid and
-- doesn't surprise the creator (the form still shows the value, just
-- without the lock indicator).
--
-- Constraint logic uses (NOT lock_flag OR value_present) which evaluates
-- as: "if the lock is on, the value must be there." The reverse — "if
-- the value is set, the lock must be on" — is NOT enforced (a creator
-- might set a default value as a suggestion without locking it).

BEGIN;

-- Cleanup: relax inconsistent locks
UPDATE tournaments
SET course_locked = false
WHERE course_locked AND default_course_id IS NULL;

UPDATE tournaments
SET tee_locked = false
WHERE tee_locked
  AND (default_tee_column_key IS NULL OR default_tee_column_key = '');

UPDATE tournaments
SET date_window_locked = false
WHERE date_window_locked
  AND (date_window_start IS NULL OR date_window_end IS NULL);

UPDATE tournaments
SET formats_locked = false
WHERE formats_locked
  AND (allowed_formats IS NULL OR array_length(allowed_formats, 1) IS NULL);

-- CHECK constraints
ALTER TABLE tournaments
    ADD CONSTRAINT course_lock_requires_course
    CHECK (NOT course_locked OR default_course_id IS NOT NULL);

ALTER TABLE tournaments
    ADD CONSTRAINT tee_lock_requires_tee
    CHECK (
        NOT tee_locked
        OR (default_tee_column_key IS NOT NULL AND default_tee_column_key != '')
    );

ALTER TABLE tournaments
    ADD CONSTRAINT date_window_lock_requires_endpoints
    CHECK (
        NOT date_window_locked
        OR (date_window_start IS NOT NULL AND date_window_end IS NOT NULL)
    );

ALTER TABLE tournaments
    ADD CONSTRAINT formats_lock_requires_format
    CHECK (
        NOT formats_locked
        OR (allowed_formats IS NOT NULL AND array_length(allowed_formats, 1) >= 1)
    );

-- Date window sanity (also enforced by iOS): end >= start when both set.
-- Independent of the lock — even unlocked suggestion windows shouldn't
-- have end < start.
ALTER TABLE tournaments
    ADD CONSTRAINT date_window_end_after_start
    CHECK (
        date_window_start IS NULL
        OR date_window_end IS NULL
        OR date_window_end >= date_window_start
    );

COMMIT;

-- Manual verification queries:
--
-- 1. Confirm no rows violate the new constraints (pre-deploy):
--    SELECT id, course_locked, default_course_id, tee_locked, default_tee_column_key,
--           date_window_locked, date_window_start, date_window_end,
--           formats_locked, allowed_formats
--    FROM tournaments
--    WHERE (course_locked AND default_course_id IS NULL)
--       OR (tee_locked AND (default_tee_column_key IS NULL OR default_tee_column_key = ''))
--       OR (date_window_locked AND (date_window_start IS NULL OR date_window_end IS NULL))
--       OR (formats_locked AND (allowed_formats IS NULL OR array_length(allowed_formats, 1) IS NULL))
--       OR (date_window_start IS NOT NULL AND date_window_end IS NOT NULL AND date_window_end < date_window_start);
--    -- Expect: 0 rows after the cleanup UPDATEs above run.
--
-- 2. Try to write a violating row (post-deploy):
--    UPDATE tournaments SET course_locked = true, default_course_id = NULL
--    WHERE id = '<some-id>';
--    -- Expect: ERROR: new row for relation "tournaments" violates check
--    -- constraint "course_lock_requires_course"
--
-- 3. Confirm valid combos still work:
--    UPDATE tournaments SET course_locked = false, default_course_id = NULL
--    WHERE id = '<some-id>';  -- unlocked + no value → OK
--    UPDATE tournaments SET course_locked = true, default_course_id = '<course-uuid>'
--    WHERE id = '<some-id>';  -- locked + value → OK
