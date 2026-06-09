-- Settings-persistence fixes (iOS settings-bug batch, June 2026)
--
-- Three nullable columns so a joining participant reads the creator's
-- setting immediately instead of only at finish-time (or never at all).
-- All additive and non-breaking: legacy rows stay NULL and the iOS clients
-- fall back to sensible defaults (mulligans -> none, mulligans_enabled ->
-- false) via decodeIfPresent / "?? ".
--
-- DEPLOY THIS BEFORE shipping the matching iOS build: the new clients
-- WRITE these columns on round/game creation, so creating a Stroke Play,
-- Copenhagen, or Nine Points round against a DB without these columns
-- would fail the insert.

-- #6 Stroke Play: mulligan allowance (cap) on the round row.
-- MulliganOption.rawValue (0 = none). Read by the participant-join path in
-- StrokePlayViewModel so a 2nd device gets the creator's shared limit
-- immediately; previously this only lived in the finish-time scorecard
-- snapshot, so a joining participant had no shared cap mid-round.
alter table public.rounds
    add column if not exists mulligans integer;

-- #7 Copenhagen: whether mulligans are enabled for the game.
-- Previously had no column, so a joining participant always saw
-- "Mulligans: Disabled" and the creator's own setting reset on reload.
alter table public.copenhagen_games
    add column if not exists mulligans_enabled boolean;

-- #7 Nine Points: same as Copenhagen.
alter table public.nine_points_games
    add column if not exists mulligans_enabled boolean;
