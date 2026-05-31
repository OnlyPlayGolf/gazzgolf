-- Squashed baseline schema, captured from prod (public) by scripts/squash-baseline.sh.
-- Pre-existing migrations were archived to supabase/migrations_archive/ (history only, not replayed).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."approach_bucket" AS ENUM (
    '<40m',
    '40-80m',
    '80-120m',
    '120-160',
    '160-200',
    '200+'
);


ALTER TYPE "public"."approach_bucket" OWNER TO "postgres";


CREATE TYPE "public"."approach_result" AS ENUM (
    'GIR',
    'MissL',
    'MissR',
    'Short',
    'Long',
    'Penalty'
);


ALTER TYPE "public"."approach_result" OWNER TO "postgres";


CREATE TYPE "public"."first_putt_band" AS ENUM (
    '0-2',
    '2-7',
    '7+'
);


ALTER TYPE "public"."first_putt_band" OWNER TO "postgres";


CREATE TYPE "public"."friend_status" AS ENUM (
    'pending',
    'accepted',
    'blocked'
);


ALTER TYPE "public"."friend_status" OWNER TO "postgres";


CREATE TYPE "public"."group_role" AS ENUM (
    'member',
    'admin',
    'owner',
    'coach'
);


ALTER TYPE "public"."group_role" OWNER TO "postgres";


CREATE TYPE "public"."tee_result" AS ENUM (
    'FIR',
    'MissL',
    'MissR',
    'Water',
    'OOB'
);


ALTER TYPE "public"."tee_result" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_debug_log_round_status_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_app TEXT;
    v_addr TEXT;
    v_query TEXT;
    v_backend TIMESTAMPTZ;
BEGIN
    SELECT application_name, client_addr::text, query, backend_start
    INTO v_app, v_addr, v_query, v_backend
    FROM pg_stat_activity
    WHERE pid = pg_backend_pid()
    LIMIT 1;
    
    INSERT INTO public._debug_round_status_deletes
        (deleted_row_user_id, deleted_row_round_id, auth_uid, db_role,
         application_name, client_addr, current_query, backend_start)
    VALUES
        (OLD.user_id, OLD.round_id::text, auth.uid(), current_user,
         v_app, v_addr, v_query, v_backend);
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."_debug_log_round_status_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_group_invite"("invite_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_group record;
  v_user_id uuid;
  v_already_member boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Look up invite
  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE code = invite_code;

  -- Validate invite exists
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite'
    );
  END IF;

  -- Check if revoked
  IF v_invite.revoked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite has been revoked'
    );
  END IF;

  -- Check expiration
  IF v_invite.expires_at IS NOT NULL AND now() > v_invite.expires_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite has expired'
    );
  END IF;

  -- Check max uses
  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Maximum uses reached'
    );
  END IF;

  -- Get group info
  SELECT * INTO v_group
  FROM public.groups
  WHERE id = v_invite.group_id;

  IF v_group IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Group not found'
    );
  END IF;

  -- Check if already a member (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = v_invite.group_id
    AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'group_id', v_group.id,
      'group_name', v_group.name
    );
  END IF;

  -- Add user to group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_invite.group_id, v_user_id, 'member');

  -- Increment uses count
  UPDATE public.group_invites
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group.id,
    'group_name', v_group.name,
    'already_member', false
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."accept_group_invite"("invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_tournament_invite"("invite_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_tournament record;
  v_user_id uuid;
  v_already_member boolean;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Look up invite
  SELECT * INTO v_invite
  FROM public.tournament_invites
  WHERE code = invite_code AND revoked = false;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Get tournament
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = v_invite.tournament_id;

  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is not active');
  END IF;

  -- Check if already member
  SELECT EXISTS(
    SELECT 1 FROM public.tournament_members
    WHERE tournament_id = v_invite.tournament_id AND user_id = v_user_id
  ) INTO v_already_member;

  IF v_already_member THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'tournament_id', v_tournament.id,
      'tournament_name', v_tournament.name
    );
  END IF;

  -- Add as member
  INSERT INTO public.tournament_members (tournament_id, user_id, added_by)
  VALUES (v_invite.tournament_id, v_user_id, v_invite.created_by);

  RETURN jsonb_build_object(
    'success', true,
    'already_member', false,
    'tournament_id', v_tournament.id,
    'tournament_name', v_tournament.name
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."accept_tournament_invite"("invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_remove_played_from_bucket"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_finished IS TRUE
     AND COALESCE(OLD.is_finished, false) IS FALSE
     AND NEW.course_id IS NOT NULL THEN
    DELETE FROM public.user_bucket_courses ubc
    WHERE ubc.course_id = NEW.course_id
      AND ubc.user_id IN (
        SELECT rp.user_id
        FROM public.round_players rp
        WHERE rp.round_id = NEW.id
          AND rp.user_id IS NOT NULL
      );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_remove_played_from_bucket"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."best_ball_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_team_idx int;
  v_player_idx int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select (team_i - 1)::int, (player_i - 1)::int
    into v_team_idx, v_player_idx
  from best_ball_games g,
       jsonb_array_elements(g.teams) with ordinality as t(team, team_i),
       jsonb_array_elements(team->'players') with ordinality as p(player, player_i)
  where g.id = p_game_id and lower(player->>'odId') = lower(v_uid::text)
  limit 1;

  if v_team_idx is null then return; end if;

  update best_ball_games
  set teams = jsonb_set(
        jsonb_set(teams,
          array[v_team_idx::text, 'players', v_player_idx::text, 'trackBasicStats'],
          to_jsonb(p_track_basic), true),
        array[v_team_idx::text, 'players', v_player_idx::text, 'trackStrokesGained'],
        to_jsonb(p_track_sg), true
      ),
      stats_mode = p_stats_mode
  where id = p_game_id;
end;
$$;


ALTER FUNCTION "public"."best_ball_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_user"("other_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF other_user_id IS NULL OR other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid target' USING ERRCODE = '22023';
  END IF;

  -- 1. Drop any friendship/pending request in either direction.
  DELETE FROM public.friendships
  WHERE (requester = v_me AND addressee = other_user_id)
     OR (requester = other_user_id AND addressee = v_me);

  -- 2. Drop friend-request notifications between us. Other notification
  --    types stay so the user retains their history; only the
  --    interactive friend-request prompt would be misleading.
  DELETE FROM public.notifications
  WHERE type = 'friend_request'
    AND (
      (user_id = v_me           AND related_user_id = other_user_id)
      OR
      (user_id = other_user_id  AND related_user_id = v_me)
    );

  -- 3. Insert the block row, idempotent.
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_me, other_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."block_user"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_post_scorecard_snapshot"("p_round_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_snapshot JSONB;
  v_players JSONB := '[]'::jsonb;
  v_player_data JSONB;
  v_scores JSONB;
  v_total INTEGER;
  v_thru INTEGER := 0;
  v_player_record RECORD;
  v_holes_array JSONB := '[]'::jsonb;
  v_holes_played INTEGER;
  v_score INTEGER;
BEGIN
  -- Get holes_played for the round
  SELECT holes_played INTO v_holes_played
  FROM rounds
  WHERE id = p_round_id;
  
  IF v_holes_played IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Build holes array (1-18 or 1-9)
  FOR i IN 1..LEAST(v_holes_played, 18) LOOP
    v_holes_array := v_holes_array || to_jsonb(i);
  END LOOP;
  
  -- Build players array with their scores
  FOR v_player_record IN
    SELECT 
      rp.id as player_id,
      rp.user_id,
      rp.guest_name,
      rp.is_guest,
      COALESCE(p.display_name, p.username, rp.guest_name, 'Player') as display_name
    FROM round_players rp
    LEFT JOIN profiles p ON p.id = rp.user_id
    WHERE rp.round_id = p_round_id
    ORDER BY rp.created_at
  LOOP
    -- Build scores array for this player (1-18, nulls allowed)
    v_scores := '[]'::jsonb;
    v_total := 0;
    v_thru := 0;
    
    -- Initialize array with nulls for all holes
    FOR i IN 1..v_holes_played LOOP
      v_scores := v_scores || jsonb_build_array(NULL);
    END LOOP;
    
    -- Fill in actual scores
    FOR i IN 1..v_holes_played LOOP
      SELECT score INTO v_score
      FROM holes
      WHERE round_id = p_round_id
        AND hole_number = i
        AND player_id = v_player_record.player_id
      LIMIT 1;
      
      IF v_score IS NOT NULL AND v_score > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[(i-1)::text], to_jsonb(v_score));
        v_total := v_total + v_score;
        v_thru := i;
      END IF;
    END LOOP;
    
    -- Build player object
    v_player_data := jsonb_build_object(
      'user_id', v_player_record.user_id,
      'player_id', v_player_record.player_id,
      'display_name', v_player_record.display_name,
      'guest_name', v_player_record.guest_name,
      'is_guest', COALESCE(v_player_record.is_guest, false),
      'scores', v_scores,
      'total', COALESCE(v_total, 0)
    );
    
    v_players := v_players || v_player_data;
  END LOOP;
  
  -- If no round_players exist, check for single-player round (holes without player_id)
  IF jsonb_array_length(v_players) = 0 THEN
    -- Check if there are any holes for this round
    SELECT COUNT(*) INTO v_total
    FROM holes
    WHERE round_id = p_round_id
    LIMIT 1;
    
    IF v_total > 0 THEN
      -- Single player round - get owner info
      SELECT 
        r.user_id,
        COALESCE(p.display_name, p.username, 'Player') as display_name
      INTO v_player_record
      FROM rounds r
      LEFT JOIN profiles p ON p.id = r.user_id
      WHERE r.id = p_round_id;
      
      -- Build scores array
      v_scores := '[]'::jsonb;
      v_total := 0;
      v_thru := 0;
      
      FOR i IN 1..v_holes_played LOOP
        v_scores := v_scores || jsonb_build_array(NULL);
      END LOOP;
      
      FOR i IN 1..v_holes_played LOOP
        SELECT score INTO v_score
        FROM holes
        WHERE round_id = p_round_id
          AND hole_number = i
          AND player_id IS NULL
        LIMIT 1;
        
        IF v_score IS NOT NULL AND v_score > 0 THEN
          v_scores := jsonb_set(v_scores, ARRAY[(i-1)::text], to_jsonb(v_score));
          v_total := v_total + v_score;
          v_thru := i;
        END IF;
      END LOOP;
      
      SELECT COALESCE(SUM(score), 0) INTO v_total
      FROM holes
      WHERE round_id = p_round_id
        AND player_id IS NULL
        AND score > 0;
      
      v_player_data := jsonb_build_object(
        'user_id', v_player_record.user_id,
        'player_id', NULL,
        'display_name', v_player_record.display_name,
        'guest_name', NULL,
        'is_guest', false,
        'scores', v_scores,
        'total', COALESCE(v_total, 0)
      );
      
      v_players := v_players || v_player_data;
    END IF;
  END IF;
  
  -- Build final snapshot
  v_snapshot := jsonb_build_object(
    'holes', v_holes_array,
    'players', v_players,
    'thru', v_thru,
    'updated_at', now()
  );
  
  RETURN v_snapshot;
END;
$$;


ALTER FUNCTION "public"."build_post_scorecard_snapshot"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_game"("_game_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.round_status
    WHERE round_id::text = _game_id
    AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."can_access_game"("_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_game_hole"("_game_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- User is a participant in this game (owner, player, or observer)
  SELECT EXISTS (
    SELECT 1 FROM public.round_status
    WHERE round_id::text = _game_id
    AND user_id = auth.uid()
  )
  OR
  -- User is friends with a participant
  EXISTS (
    SELECT 1 FROM public.round_status rs
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = rs.user_id)
        OR (f.addressee = auth.uid() AND f.requester = rs.user_id)
      )
    WHERE rs.round_id::text = _game_id
  );
$$;


ALTER FUNCTION "public"."can_read_game_hole"("_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_hole"("_round_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- User is a participant in this round
  SELECT EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = _round_id AND rp.user_id = auth.uid()
  )
  OR
  -- User owns the round
  EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = _round_id AND r.user_id = auth.uid()
  )
  OR
  -- User is friends with a participant
  EXISTS (
    SELECT 1 FROM public.round_players rp
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = rp.user_id)
        OR
        (f.addressee = auth.uid() AND f.requester = rp.user_id)
      )
    WHERE rp.round_id = _round_id
  );
$$;


ALTER FUNCTION "public"."can_read_hole"("_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_round"("_round_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Owner
  SELECT EXISTS (
    SELECT 1 FROM public.rounds WHERE id = _round_id AND user_id = auth.uid()
  )
  -- Participant
  OR EXISTS (
    SELECT 1 FROM public.round_players rp
    WHERE rp.round_id = _round_id AND rp.user_id = auth.uid()
  )
  -- Friend of round OWNER
  OR EXISTS (
    SELECT 1 FROM public.rounds r
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = r.user_id)
        OR (f.addressee = auth.uid() AND f.requester = r.user_id)
      )
    WHERE r.id = _round_id
  )
  -- Friend of any participant
  OR EXISTS (
    SELECT 1 FROM public.round_players rp
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = rp.user_id)
        OR (f.addressee = auth.uid() AND f.requester = rp.user_id)
      )
    WHERE rp.round_id = _round_id
  );
$$;


ALTER FUNCTION "public"."can_read_round"("_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_round_status"("_round_id" "uuid", "_row_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Rule 1: own row
  SELECT _row_user_id = auth.uid()
  -- Rule 2: co-participant (you have your own row for this round)
  OR EXISTS (
    SELECT 1 FROM public.round_status rs
    WHERE rs.round_id = _round_id
      AND rs.user_id = auth.uid()
  )
  -- Rule 3: friends with the row author (for Friends on Course)
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = _row_user_id)
        OR (f.addressee = auth.uid() AND f.requester = _row_user_id)
      )
  );
$$;


ALTER FUNCTION "public"."can_read_round_status"("_round_id" "uuid", "_row_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_user_level_progress"("p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    auth.uid() = p_owner_id
    OR EXISTS (
      SELECT 1 FROM public.friends_pairs fp
      WHERE fp.a = LEAST(auth.uid(), p_owner_id)
        AND fp.b = GREATEST(auth.uid(), p_owner_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = p_owner_id
    );
$$;


ALTER FUNCTION "public"."can_read_user_level_progress"("p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_write_hole"("_round_id" "uuid", "_player_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    -- User owns the round
    SELECT 1 FROM public.rounds WHERE id = _round_id AND user_id = auth.uid()
  ) OR EXISTS (
    -- User is the player for this hole entry
    SELECT 1 FROM public.round_players WHERE id = _player_id AND user_id = auth.uid()
  ) OR EXISTS (
    -- User is any participant in this round (scorekeeper entering for others)
    SELECT 1 FROM public.round_status
    WHERE round_id::uuid = _round_id
      AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."can_write_hole"("_round_id" "uuid", "_player_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_favourite_groups_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF array_length(NEW.favourite_group_ids, 1) > 3 THEN
    RAISE EXCEPTION 'Cannot have more than 3 favourite groups';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_favourite_groups_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_device_token_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    DELETE FROM device_tokens WHERE token = NEW.token AND user_id != NEW.user_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clean_device_token_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_notification_log"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM notification_log WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION "public"."cleanup_notification_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER := 0;
  prefs RECORD;
BEGIN
  -- Process each user's preferences
  FOR prefs IN 
    SELECT user_id, auto_delete_read_after_days, auto_delete_unread_after_days
    FROM public.notification_preferences
    WHERE auto_delete_read_after_days IS NOT NULL 
       OR auto_delete_unread_after_days IS NOT NULL
  LOOP
    -- Delete read notifications older than threshold
    IF prefs.auto_delete_read_after_days IS NOT NULL THEN
      WITH deleted AS (
        DELETE FROM public.notifications
        WHERE user_id = prefs.user_id
          AND is_read = true
          AND created_at < NOW() - (prefs.auto_delete_read_after_days || ' days')::INTERVAL
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted;
    END IF;

    -- Delete unread notifications older than threshold
    IF prefs.auto_delete_unread_after_days IS NOT NULL THEN
      WITH deleted AS (
        DELETE FROM public.notifications
        WHERE user_id = prefs.user_id
          AND is_read = false
          AND created_at < NOW() - (prefs.auto_delete_unread_after_days || ' days')::INTERVAL
        RETURNING id
      )
      SELECT COUNT(*) INTO deleted_count FROM deleted;
    END IF;
  END LOOP;

  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_expired_battles"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    rec record;
    p_rec record;
    v_new_status text;
begin
    for rec in
        select id, name, winner_user_id
          from public.map_battles
         where status = 'active'
           and time_limit_seconds is not null
           and started_at + (time_limit_seconds * interval '1 second') < now()
    loop
        v_new_status := case
            when rec.winner_user_id is not null then 'finished'
            else 'cancelled'
        end;

        update public.map_battles
           set status        = v_new_status,
               ended_at      = now(),
               ended_reason  = 'time_expired'
         where id = rec.id;

        for p_rec in
            select user_id
              from public.map_battle_participants
             where battle_id = rec.id
               and left_at is null
               and (rec.winner_user_id is null or user_id <> rec.winner_user_id)
        loop
            insert into public.notifications (
                user_id,
                type,
                title,
                message,
                related_id,
                related_user_id,
                metadata
            ) values (
                p_rec.user_id,
                'battle_finished',
                'Battle ended',
                case
                    when rec.winner_user_id is not null
                        then 'Time ran out on "' || rec.name || '" — someone took the crown'
                    else 'Time ran out on "' || rec.name || '"'
                end,
                rec.id,
                coalesce(rec.winner_user_id, p_rec.user_id),
                jsonb_build_object(
                    'sub_type',  'battle_expired',
                    'battle_id', rec.id::text,
                    'map_name',  rec.name
                )
            );
        end loop;
    end loop;
end;
$$;


ALTER FUNCTION "public"."close_expired_battles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."conversations_overview"() RETURNS TABLE("id" "uuid", "type" "text", "name" "text", "group_id" "uuid", "other_user_id" "uuid", "last_message" "text", "last_message_time" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH my_conversations AS (
    SELECT c.id, c.type, c.group_id, c.updated_at, c.name AS conv_name
    FROM public.conversations c
    WHERE EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = c.group_id AND gm.user_id = auth.uid()
    )
  ),
  friend_meta AS (
    SELECT mc.id AS conversation_id,
           cp_other.user_id AS other_user_id
    FROM my_conversations mc
    JOIN public.conversation_participants cp_me
      ON cp_me.conversation_id = mc.id AND cp_me.user_id = auth.uid()
    JOIN public.conversation_participants cp_other
      ON cp_other.conversation_id = mc.id AND cp_other.user_id <> auth.uid()
    WHERE mc.type = 'friend'
  ),
  -- For non-golf group chats, build a participant name list
  group_chat_names AS (
    SELECT mc.id AS conversation_id,
           string_agg(
             COALESCE(p.display_name, p.username, 'Unknown'),
             ', ' ORDER BY p.display_name, p.username
           ) AS participant_names
    FROM my_conversations mc
    JOIN public.conversation_participants cp
      ON cp.conversation_id = mc.id AND cp.user_id <> auth.uid()
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE mc.type = 'group' AND mc.group_id IS NULL
    GROUP BY mc.id
  ),
  last_msg AS (
    SELECT m.conversation_id, m.content, m.created_at,
           ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM my_conversations)
      AND m.deleted_at IS NULL
  )
  SELECT
    mc.id,
    mc.type,
    CASE
      WHEN mc.type = 'group' AND mc.group_id IS NOT NULL THEN g.name
      WHEN mc.type = 'group' AND mc.group_id IS NULL THEN COALESCE(mc.conv_name, gcn.participant_names, 'Group Chat')
      ELSE COALESCE(p.display_name, p.username, 'Unknown')
    END AS name,
    mc.group_id,
    fm.other_user_id,
    lm.content AS last_message,
    lm.created_at AS last_message_time,
    mc.updated_at
  FROM my_conversations mc
  LEFT JOIN public.groups g ON g.id = mc.group_id
  LEFT JOIN friend_meta fm ON fm.conversation_id = mc.id
  LEFT JOIN group_chat_names gcn ON gcn.conversation_id = mc.id
  LEFT JOIN public.profiles p ON p.id = fm.other_user_id
  LEFT JOIN last_msg lm ON lm.conversation_id = mc.id AND lm.rn = 1
  ORDER BY mc.updated_at DESC;
$$;


ALTER FUNCTION "public"."conversations_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_21_points_participant_rows"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_drill_title text;
  v_players jsonb;
  v_elem jsonb;
  v_od_id text;
  v_total_pts bigint;
  v_game_id text;
  v_count int;
BEGIN
  SELECT title INTO v_drill_title FROM public.drills WHERE id = NEW.drill_id;
  IF v_drill_title IS NULL OR v_drill_title != '21 Points' THEN
    RETURN NEW;
  END IF;

  v_players := (NEW.attempts_json::jsonb -> 'players');
  IF v_players IS NULL OR jsonb_typeof(v_players) != 'array' THEN
    RETURN NEW;
  END IF;

  -- Only create participant rows for the primary insert (from the client).
  -- Trigger-created rows would fire this again; skip to avoid duplicates/recursion.
  v_game_id := NEW.attempts_json::jsonb ->> 'gameId';
  IF v_game_id IS NOT NULL AND v_game_id != '' THEN
    SELECT count(*) INTO v_count FROM public.drill_results
    WHERE (attempts_json::jsonb ->> 'gameId') = v_game_id;
    IF v_count > 1 THEN
      RETURN NEW;
    END IF;
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_players) AS elem
  LOOP
    v_od_id := v_elem ->> 'odId';
    IF v_od_id IS NULL OR v_od_id = '' OR v_od_id LIKE 'temp_%' OR v_od_id = (NEW.user_id)::text THEN
      CONTINUE;
    END IF;
    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
    VALUES (v_od_id::uuid, NEW.drill_id, v_total_pts, NEW.attempts_json);
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_21_points_participant_rows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_21_points_participant_rows_rpc"("p_drill_id" "uuid", "p_attempts_json" "jsonb", "p_exclude_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_players jsonb;
  v_elem jsonb;
  v_od_id text;
  v_total_pts bigint;
BEGIN
  v_players := p_attempts_json -> 'players';
  IF v_players IS NULL OR jsonb_typeof(v_players) != 'array' THEN
    RETURN;
  END IF;

  FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_players) AS elem
  LOOP
    v_od_id := v_elem ->> 'odId';
    IF v_od_id IS NULL OR v_od_id = '' OR v_od_id LIKE 'temp_%' OR v_od_id = (p_exclude_user_id)::text THEN
      CONTINUE;
    END IF;
    v_total_pts := COALESCE((v_elem ->> 'totalPoints')::bigint, 0);
    INSERT INTO public.drill_results (user_id, drill_id, total_points, attempts_json)
    VALUES (v_od_id::uuid, p_drill_id, v_total_pts, p_attempts_json);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."create_21_points_participant_rows_rpc"("p_drill_id" "uuid", "p_attempts_json" "jsonb", "p_exclude_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_drill_high_score_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_drill_title       text;
  v_lower_is_better   boolean;
  v_user_name         text;
  v_is_pb             boolean;
  v_has_prior_score   boolean;
  v_prev_holder_id    uuid;
  v_prev_holder_name  text;
  v_prev_score        integer;
  v_title             text;
  v_subtitle          text;
BEGIN
  -- All work goes inside a BEGIN/EXCEPTION block so any error here —
  -- schema drift, NOT NULL violations, RLS surprises, etc. — does
  -- NOT roll back the user's drill_results INSERT.
  BEGIN
    -- 1. Resolve drill metadata.
    SELECT title, COALESCE(lower_is_better, false)
    INTO v_drill_title, v_lower_is_better
    FROM public.drills
    WHERE id = NEW.drill_id;

    IF v_drill_title IS NULL THEN
      RETURN NEW;
    END IF;

    -- 2. Resolve the player's display name. COALESCE inside the
    --    SELECT handles per-column NULL but NOT the "no rows
    --    matched" case. Apply a second COALESCE outside as a hard
    --    fallback so v_user_name is always non-NULL — the
    --    activity_posts.title column has a NOT NULL constraint and
    --    a NULL concat would otherwise fail the trigger.
    SELECT COALESCE(display_name, username, 'Someone')
    INTO v_user_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    v_user_name := COALESCE(v_user_name, 'Someone');

    -- 3. Determine whether the just-inserted row is a personal best.
    SELECT EXISTS (
      SELECT 1 FROM public.drill_results
      WHERE drill_id = NEW.drill_id
        AND user_id  = NEW.user_id
        AND id       != NEW.id
    )
    INTO v_has_prior_score;

    IF NOT v_has_prior_score THEN
      v_is_pb := true;
    ELSIF v_lower_is_better THEN
      SELECT NEW.total_points < MIN(total_points)
      INTO v_is_pb
      FROM public.drill_results
      WHERE drill_id = NEW.drill_id
        AND user_id  = NEW.user_id
        AND id       != NEW.id;
    ELSE
      SELECT NEW.total_points > MAX(total_points)
      INTO v_is_pb
      FROM public.drill_results
      WHERE drill_id = NEW.drill_id
        AND user_id  = NEW.user_id
        AND id       != NEW.id;
    END IF;

    IF NOT COALESCE(v_is_pb, false) THEN
      RETURN NEW;
    END IF;

    -- 4. Find the previous overall record holder on this drill.
    IF v_lower_is_better THEN
      SELECT user_id, total_points
      INTO v_prev_holder_id, v_prev_score
      FROM public.drill_results
      WHERE drill_id = NEW.drill_id
        AND id != NEW.id
      ORDER BY total_points ASC, created_at ASC
      LIMIT 1;
    ELSE
      SELECT user_id, total_points
      INTO v_prev_holder_id, v_prev_score
      FROM public.drill_results
      WHERE drill_id = NEW.drill_id
        AND id != NEW.id
      ORDER BY total_points DESC, created_at ASC
      LIMIT 1;
    END IF;

    IF v_prev_holder_id IS NOT NULL THEN
      SELECT COALESCE(display_name, username, 'Someone')
      INTO v_prev_holder_name
      FROM public.profiles
      WHERE id = v_prev_holder_id;
      v_prev_holder_name := COALESCE(v_prev_holder_name, 'Someone');
    END IF;

    -- 5. Build title + subtitle.
    v_title := v_user_name || ' set a new high score on ' || v_drill_title;
    v_subtitle := 'Score: ' || NEW.total_points::text;

    IF v_prev_holder_id IS NOT NULL THEN
      IF v_prev_holder_id = NEW.user_id THEN
        v_subtitle := v_subtitle || ' · New personal best';
      ELSIF (v_lower_is_better     AND NEW.total_points <  v_prev_score)
         OR (NOT v_lower_is_better AND NEW.total_points >  v_prev_score) THEN
        v_subtitle := v_subtitle
                   || ' · Beat '
                   || v_prev_holder_name
                   || '''s record of '
                   || v_prev_score::text;
      ELSE
        v_subtitle := v_subtitle || ' · New personal best';
      END IF;
    END IF;

    -- 6. Insert the activity_post.
    INSERT INTO public.activity_posts (user_id, post_type, title, subtitle, metadata)
    VALUES (
      NEW.user_id,
      'drill_high_score',
      v_title,
      v_subtitle,
      jsonb_build_object(
        'drill_name', v_drill_title,
        'drill_id',   NEW.drill_id::text,
        'score',      NEW.total_points,
        'previous_high_score', v_prev_score
      )
    )
    ON CONFLICT DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    -- Anything goes wrong → log and continue. The parent drill_results
    -- INSERT must succeed regardless of activity_post side-effect
    -- failures.
    RAISE WARNING 'create_drill_high_score_post failed for drill_results.id=%: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_drill_high_score_post"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_drill_high_score_post"() IS 'Creates a drill_high_score activity_posts row on PBs. Fires from on_drill_result_create_high_score_post AFTER INSERT trigger. Companion to notify_drill_leaderboard (which handles bell + push for the same event).';



CREATE OR REPLACE FUNCTION "public"."create_group_chat"("p_name" "text" DEFAULT NULL::"text", "p_participant_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_my_id UUID := auth.uid();
  v_conv_id UUID;
  v_pid UUID;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF array_length(p_participant_ids, 1) IS NULL OR array_length(p_participant_ids, 1) < 1 THEN
    RAISE EXCEPTION 'At least one participant is required';
  END IF;

  -- Create the conversation
  INSERT INTO public.conversations (type, name)
  VALUES ('group', NULLIF(TRIM(p_name), ''))
  RETURNING id INTO v_conv_id;

  -- Add the creator as participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_my_id);

  -- Add each friend as participant (skip creator if included)
  FOREACH v_pid IN ARRAY p_participant_ids LOOP
    IF v_pid <> v_my_id THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id)
      VALUES (v_conv_id, v_pid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$;


ALTER FUNCTION "public"."create_group_chat"("p_name" "text", "p_participant_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Social / feed
  DELETE FROM public.post_comment_replies WHERE user_id = uid;
  DELETE FROM public.post_comment_likes   WHERE user_id = uid;
  DELETE FROM public.post_comments        WHERE user_id = uid;
  DELETE FROM public.post_likes           WHERE user_id = uid;
  DELETE FROM public.posts                WHERE user_id = uid;

  -- Activity feed posts
  DELETE FROM public.activity_posts WHERE user_id = uid;

  -- Round comments
  DELETE FROM public.round_comment_likes   WHERE user_id = uid;
  DELETE FROM public.round_comment_replies WHERE user_id = uid;
  DELETE FROM public.round_comments        WHERE user_id = uid;

  -- Games (user-owned rounds and participation)
  DELETE FROM public.holes         WHERE round_id IN (SELECT id FROM public.rounds WHERE user_id = uid);
  DELETE FROM public.round_players WHERE user_id = uid;
  DELETE FROM public.rounds        WHERE user_id = uid;

  -- Strokes-gained rounds
  DELETE FROM public.sg_rounds WHERE user_id = uid;

  -- Game format tables
  DELETE FROM public.match_play_holes WHERE game_id IN (SELECT id FROM public.match_play_games WHERE user_id = uid);
  DELETE FROM public.match_play_games WHERE user_id = uid;
  DELETE FROM public.best_ball_holes  WHERE game_id IN (SELECT id FROM public.best_ball_games  WHERE user_id = uid);
  DELETE FROM public.best_ball_games  WHERE user_id = uid;
  DELETE FROM public.skins_holes      WHERE game_id IN (SELECT id FROM public.skins_games      WHERE user_id = uid);
  DELETE FROM public.skins_games      WHERE user_id = uid;
  DELETE FROM public.wolf_holes       WHERE game_id IN (SELECT id FROM public.wolf_games       WHERE user_id = uid);
  DELETE FROM public.wolf_games       WHERE user_id = uid;
  DELETE FROM public.scramble_holes   WHERE game_id IN (SELECT id FROM public.scramble_games   WHERE user_id = uid);
  DELETE FROM public.scramble_games   WHERE user_id = uid;
  DELETE FROM public.copenhagen_holes WHERE game_id IN (SELECT id FROM public.copenhagen_games WHERE user_id = uid);
  DELETE FROM public.copenhagen_games WHERE user_id = uid;
  DELETE FROM public.umbriago_holes   WHERE game_id IN (SELECT id FROM public.umbriago_games   WHERE user_id = uid);
  DELETE FROM public.umbriago_games   WHERE user_id = uid;

  -- Pro stats
  DELETE FROM public.pro_stats_holes  WHERE pro_round_id IN (SELECT id FROM public.pro_stats_rounds WHERE user_id = uid);
  DELETE FROM public.pro_stats_rounds WHERE user_id = uid;

  -- Practice / drills / LEVELS (new table)
  DELETE FROM public.drill_results      WHERE user_id = uid;
  DELETE FROM public.user_level_progress WHERE user_id = uid;
  DELETE FROM public.coach_drills       WHERE coach_id = uid;
  DELETE FROM public.coach_ai_feedback  WHERE user_id = uid;

  -- Friends (requester/addressee are uuid columns).
  -- `friends_pairs` is a view over this table — no explicit delete.
  DELETE FROM public.friendships WHERE requester = uid OR addressee = uid;

  -- Notifications & preferences
  DELETE FROM public.notifications            WHERE user_id = uid;
  DELETE FROM public.notification_preferences WHERE user_id = uid;

  -- Notification log
  DELETE FROM public.notification_log WHERE recipient_user_id = uid;

  -- Device tokens for push notifications
  DELETE FROM public.device_tokens WHERE user_id = uid;

  -- Messages
  DELETE FROM public.messages                  WHERE sender_id = uid;
  DELETE FROM public.conversation_participants WHERE user_id = uid;

  -- Conversation-level preferences per user
  DELETE FROM public.user_conversation_settings WHERE user_id = uid;

  -- Groups
  DELETE FROM public.group_activity_likes    WHERE user_id = uid;
  DELETE FROM public.group_activity_comments WHERE user_id = uid;
  DELETE FROM public.group_activity          WHERE user_id = uid;
  DELETE FROM public.group_challenges        WHERE created_by = uid;
  DELETE FROM public.group_invites           WHERE created_by = uid;
  BEGIN DELETE FROM public.session_scores     WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_responses  WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_attendance WHERE user_id = uid;       EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.session_coaches    WHERE coach_user_id = uid; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Session invites
  DELETE FROM public.session_invites WHERE invited_user_id = uid OR invited_by = uid;

  -- Favourites & misc
  DELETE FROM public.user_favorites          WHERE user_id = uid;
  DELETE FROM public.favorite_courses        WHERE user_id = uid;
  DELETE FROM public.game_likes              WHERE user_id = uid;
  DELETE FROM public.player_game_stats_mode  WHERE user_id = uid;

  -- Profile (must be after all FK references)
  DELETE FROM public.profiles WHERE id = uid;

  -- Finally delete the auth user
  DELETE FROM auth.users WHERE id = uid;
END;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_round"("p_round_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Verify caller owns the round
  IF NOT EXISTS (
    SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Only the round owner can delete this round';
  END IF;

  -- Delete in dependency order
  DELETE FROM holes WHERE round_id = p_round_id;
  DELETE FROM round_players WHERE round_id = p_round_id;
  DELETE FROM round_status WHERE round_id::uuid = p_round_id;
  DELETE FROM rounds WHERE id = p_round_id;
END;
$$;


ALTER FUNCTION "public"."delete_round"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_round_activity_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.activity_posts
  WHERE post_type = 'round_finished'
    AND metadata->>'round_id' = OLD.id::text;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_round_activity_post"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_round_activity_post"() IS 'Removes the round_finished activity_posts row tied to a deleted round. Invoked by trg_delete_round_activity_post on rounds AFTER DELETE.';



CREATE OR REPLACE FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_tournament_id uuid;
    v_round_id uuid;
BEGIN
    SELECT tournament_id, round_id INTO v_tournament_id, v_round_id
    FROM public.tournament_rounds
    WHERE id = p_tr_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament round not found: %', p_tr_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF NOT public.can_manage_tournament(v_tournament_id::text, auth.uid()::text) THEN
        RAISE EXCEPTION 'Not authorized to delete tournament round'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    DELETE FROM public.rounds WHERE id = v_round_id;
END;
$$;


ALTER FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_friend_conversation"("friend_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_my_id uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF friend_id IS NULL OR friend_id = v_my_id THEN
    RAISE EXCEPTION 'Invalid friend id';
  END IF;
  IF public.is_blocked_either_way(friend_id) THEN
    RAISE EXCEPTION 'Conversation not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = v_my_id
  JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = friend_id
  WHERE c.type = 'friend'
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (type)
    VALUES ('friend')
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_my_id);

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, friend_id);
  END IF;

  RETURN v_conv_id;
END;
$$;


ALTER FUNCTION "public"."ensure_friend_conversation"("friend_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_friendship"("u1" "uuid", "u2" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  insert into public.friendships(user_a, user_b)
  values (least(u1,u2), greatest(u1,u2))
  on conflict do nothing;
$$;


ALTER FUNCTION "public"."ensure_friendship"("u1" "uuid", "u2" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_friendship_by_pair"("u1" "uuid", "u2" "uuid", "ts" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  a uuid := least(u1, u2);
  b uuid := greatest(u1, u2);
begin
  if a is null or b is null or a = b then
    return;
  end if;
  insert into public.friendships(user_a, user_b, created_at)
  values (a, b, coalesce(ts, now()))
  on conflict (user_a, user_b) do nothing;
end;
$$;


ALTER FUNCTION "public"."ensure_friendship_by_pair"("u1" "uuid", "u2" "uuid", "ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_group_conversation"("p_group_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_my_id uuid := auth.uid();
  v_conv_id uuid;
BEGIN
  IF v_my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid group id';
  END IF;

  -- Ensure the user is a member of the group
  IF NOT public.is_group_member(v_my_id, p_group_id) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Look for existing conversation
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE type = 'group' AND group_id = p_group_id
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    -- Create new group conversation
    INSERT INTO public.conversations (type, group_id)
    VALUES ('group', p_group_id)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;


ALTER FUNCTION "public"."ensure_group_conversation"("p_group_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "friend_request_enabled" boolean DEFAULT true NOT NULL,
    "group_invite_enabled" boolean DEFAULT true NOT NULL,
    "high_score_enabled" boolean DEFAULT true NOT NULL,
    "message_enabled" boolean DEFAULT true NOT NULL,
    "round_completed_enabled" boolean DEFAULT true NOT NULL,
    "achievement_unlocked_enabled" boolean DEFAULT true NOT NULL,
    "group_activity_enabled" boolean DEFAULT true NOT NULL,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "auto_delete_read_after_days" integer DEFAULT 30,
    "auto_delete_unread_after_days" integer DEFAULT 90,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "friend_started_round_enabled" boolean DEFAULT true,
    "scorecard_reactions_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") RETURNS SETOF "public"."notification_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT * FROM public.notification_preferences
  WHERE user_id = _user_id;
END;
$$;


ALTER FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile"("p_user_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_display_name" "text" DEFAULT NULL::"text", "p_handicap" "text" DEFAULT NULL::"text", "p_home_club" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Only allow users to ensure their own profile
  if p_user_id <> auth.uid() then
    raise exception 'unauthorized: p_user_id must match authenticated user';
  end if;

  insert into public.profiles (id, email, display_name, handicap, home_club, country)
  values (
    p_user_id,
    p_email,
    nullif(btrim(p_display_name), ''),
    nullif(btrim(p_handicap), ''),
    nullif(btrim(p_home_club), ''),
    nullif(btrim(p_country), '')
  )
  on conflict (id) do update
  set
    email      = coalesce(excluded.email, profiles.email),
    display_name = case when nullif(profiles.display_name, '') is null
                        then excluded.display_name
                        else profiles.display_name end,
    handicap   = case when nullif(profiles.handicap, '') is null
                      then excluded.handicap
                      else profiles.handicap end,
    home_club  = case when nullif(profiles.home_club, '') is null
                      then excluded.home_club
                      else profiles.home_club end,
    country    = case when nullif(profiles.country, '') is null
                      then excluded.country
                      else profiles.country end;
end;
$$;


ALTER FUNCTION "public"."ensure_profile"("p_user_id" "uuid", "p_email" "text", "p_display_name" "text", "p_handicap" "text", "p_home_club" "text", "p_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."favourite_group_leaderboard_for_drill_by_title"("p_drill_title" "text") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  fav AS (
    SELECT UNNEST(favourite_group_ids) as favourite_group_id 
    FROM public.user_settings 
    WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT DISTINCT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id IN (SELECT favourite_group_id FROM fav)
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT user_id FROM members)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$$;


ALTER FUNCTION "public"."favourite_group_leaderboard_for_drill_by_title"("p_drill_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."favourite_groups_level_leaderboard"() RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "category" "text", "tier" "text", "completed_in_tier" integer, "total_completed" integer, "total_xp" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH fav_groups AS (
    SELECT unnest(favourite_group_ids) AS group_id
    FROM public.user_settings
    WHERE user_id = auth.uid()
  ),
  visible_users AS (
    SELECT DISTINCT gm.user_id AS uid
    FROM public.group_members gm
    WHERE gm.group_id IN (SELECT group_id FROM fav_groups)
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT  AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;


ALTER FUNCTION "public"."favourite_groups_level_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."friends_leaderboard_for_drill_by_title"("p_drill_title" "text") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END as friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  friends_and_me AS (
    SELECT friend_id as user_id FROM my_friends
    UNION
    SELECT auth.uid() as user_id
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT user_id FROM friends_and_me)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, p.avatar_url, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC;
$$;


ALTER FUNCTION "public"."friends_leaderboard_for_drill_by_title"("p_drill_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."friends_level_leaderboard"() RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "category" "text", "tier" "text", "completed_in_tier" integer, "total_completed" integer, "total_xp" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH visible_users AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END AS uid
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
    UNION
    SELECT auth.uid() AS uid
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;


ALTER FUNCTION "public"."friends_level_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_hole_averages"("p_user_id" "uuid", "p_course_id" "uuid") RETURNS TABLE("hole_number" integer, "par" integer, "avg_score" numeric, "delta" numeric, "times_played" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT h.hole_number,
         MAX(h.par)::int AS par,
         AVG(h.score)::numeric    AS avg_score,
         (AVG(h.score) - MAX(h.par))::numeric AS delta,
         COUNT(*)::bigint AS times_played
  FROM holes h
  JOIN round_players rp ON rp.id = h.player_id
  JOIN rounds r ON r.id = h.round_id
  JOIN courses c ON c.id = r.course_id
  WHERE rp.user_id = p_user_id
    AND rp.track_strokes_gained = true
    AND r.course_id = p_course_id
    AND r.is_finished = true
    AND c.external_source = 'golfapi.io'
    AND (r.is_private = false OR r.user_id = p_user_id)
    AND h.score IS NOT NULL
    AND h.score > 0
  GROUP BY h.hole_number
  ORDER BY h.hole_number;
$$;


ALTER FUNCTION "public"."get_course_hole_averages"("p_user_id" "uuid", "p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_score_distribution"("p_user_id" "uuid", "p_course_id" "uuid") RETURNS TABLE("eagles" bigint, "birdies" bigint, "pars" bigint, "bogeys" bigint, "doubles" bigint, "triples" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH user_holes AS (
    SELECT h.par, h.score
    FROM holes h
    JOIN round_players rp ON rp.id = h.player_id
    JOIN rounds r ON r.id = h.round_id
    JOIN courses c ON c.id = r.course_id
    WHERE rp.user_id = p_user_id
      AND rp.track_strokes_gained = true
      AND r.course_id = p_course_id
      AND r.is_finished = true
      AND c.external_source = 'golfapi.io'
      AND (r.is_private = false OR r.user_id = p_user_id)
      AND h.score IS NOT NULL
      AND h.score > 0
  )
  SELECT
    COUNT(*) FILTER (WHERE (score - par) <= -2) AS eagles,
    COUNT(*) FILTER (WHERE (score - par) = -1)  AS birdies,
    COUNT(*) FILTER (WHERE (score - par) = 0)   AS pars,
    COUNT(*) FILTER (WHERE (score - par) = 1)   AS bogeys,
    COUNT(*) FILTER (WHERE (score - par) = 2)   AS doubles,
    COUNT(*) FILTER (WHERE (score - par) >= 3)  AS triples
  FROM user_holes;
$$;


ALTER FUNCTION "public"."get_course_score_distribution"("p_user_id" "uuid", "p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_scoring_overview"("p_user_id" "uuid", "p_course_id" "uuid") RETURNS TABLE("rounds" bigint, "total_holes" bigint, "scoring_avg" numeric, "avg_to_par" numeric, "par3_avg" numeric, "par4_avg" numeric, "par5_avg" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH user_holes AS (
    SELECT h.par, h.score, r.id AS round_id, r.holes_played
    FROM holes h
    JOIN round_players rp ON rp.id = h.player_id
    JOIN rounds r ON r.id = h.round_id
    JOIN courses c ON c.id = r.course_id
    WHERE rp.user_id = p_user_id
      AND rp.track_strokes_gained = true
      AND r.course_id = p_course_id
      AND r.is_finished = true
      AND c.external_source = 'golfapi.io'
      AND (r.is_private = false OR r.user_id = p_user_id)
      AND h.score IS NOT NULL
      AND h.score > 0
  ),
  per_round_18 AS (
    SELECT round_id, SUM(score)::numeric AS gross
    FROM user_holes
    WHERE holes_played = 18
    GROUP BY round_id
    HAVING COUNT(*) = 18
  )
  SELECT
    (SELECT COUNT(*) FROM per_round_18)                                 AS rounds,
    (SELECT COUNT(*) FROM user_holes)::bigint                           AS total_holes,
    (SELECT AVG(gross) FROM per_round_18)                               AS scoring_avg,
    (SELECT AVG(gross - (SELECT SUM(par) FROM user_holes uh2
                          WHERE uh2.round_id = per_round_18.round_id))
       FROM per_round_18)                                               AS avg_to_par,
    (SELECT AVG(score) FROM user_holes WHERE par = 3)                   AS par3_avg,
    (SELECT AVG(score) FROM user_holes WHERE par = 4)                   AS par4_avg,
    (SELECT AVG(score) FROM user_holes WHERE par = 5)                   AS par5_avg;
$$;


ALTER FUNCTION "public"."get_course_scoring_overview"("p_user_id" "uuid", "p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_tees_with_distances"("p_course_id" "uuid") RETURNS TABLE("tee_id" "uuid", "tee_name" "text", "tee_color" "text", "display_order" integer, "par_men" integer, "course_rating_men" numeric, "slope_men" integer, "total_distance" integer, "hole_number" integer, "hole_par" integer, "hole_stroke_index" integer, "distance" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    t.id, t.tee_name, t.tee_color, t.display_order,
    t.par_men, t.course_rating_men, t.slope_men, t.total_distance,
    h.hole_number, h.par AS hole_par, h.stroke_index AS hole_stroke_index,
    chd.distance
  FROM course_tees t
  JOIN course_holes h ON h.course_id = t.course_id
  LEFT JOIN course_hole_distances chd
       ON chd.course_hole_id = h.id AND chd.course_tee_id = t.id
  WHERE t.course_id = p_course_id
  ORDER BY t.display_order ASC NULLS LAST, t.tee_name ASC, h.hole_number ASC;
$$;


ALTER FUNCTION "public"."get_course_tees_with_distances"("p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dream_round"("p_user_id" "uuid", "p_course_id" "uuid") RETURNS TABLE("hole_number" integer, "par" integer, "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT h.hole_number,
         MIN(h.par)::int   AS par,
         MIN(h.score)::int AS best_score
  FROM holes h
  JOIN round_players rp ON rp.id = h.player_id
  JOIN rounds r ON r.id = h.round_id
  JOIN courses c ON c.id = r.course_id
  WHERE rp.user_id = p_user_id
    AND rp.track_strokes_gained = true
    AND r.course_id = p_course_id
    AND r.is_finished = true
    AND c.external_source = 'golfapi.io'
    AND (r.is_private = false OR r.user_id = p_user_id)
    AND h.score IS NOT NULL
    AND h.score > 0
  GROUP BY h.hole_number
  ORDER BY h.hole_number;
$$;


ALTER FUNCTION "public"."get_dream_round"("p_user_id" "uuid", "p_course_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friend_stats_aggregate"("p_user_id" "uuid", "p_min_rounds" integer DEFAULT 1, "p_group_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("user_id" "uuid", "display_name" "text", "avatar_url" "text", "sg_round_count" integer, "basic_stats_round_count" integer, "avg_sg_ott" numeric, "avg_sg_app" numeric, "avg_sg_arg" numeric, "avg_sg_putt" numeric, "fairway_pct" numeric, "gir_pct" numeric, "putts_per_hole" numeric, "up_down_pct" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH
    caller AS (
        SELECT p_user_id AS uid
        WHERE p_user_id = auth.uid()
    ),

    -- Target users: friends + self when p_group_id IS NULL,
    -- group members + self when p_group_id IS NOT NULL.
    -- Caller must themselves be in the group (EXISTS check) to
    -- prevent scoping at arbitrary group UUIDs.
    target_users AS (
        SELECT uid FROM caller
        UNION
        SELECT CASE WHEN fp.a = c.uid THEN fp.b ELSE fp.a END
        FROM public.friends_pairs fp
        CROSS JOIN caller c
        WHERE p_group_id IS NULL
          AND (fp.a = c.uid OR fp.b = c.uid)
        UNION
        SELECT gm.user_id
        FROM public.group_members gm
        CROSS JOIN caller c
        WHERE p_group_id IS NOT NULL
          AND gm.group_id = p_group_id
          AND EXISTS (
              SELECT 1 FROM public.group_members caller_member
              WHERE caller_member.group_id = p_group_id
                AND caller_member.user_id  = c.uid
          )
    ),

    sg_round_keys AS (
        SELECT DISTINCT rp.user_id, r.date_played, r.course_name
        FROM public.round_players rp
        JOIN public.rounds r ON r.id = rp.round_id
        JOIN target_users t  ON t.uid = rp.user_id
        WHERE rp.track_strokes_gained = true
          AND r.is_finished = true
    ),

    sg_rounds_ranked AS (
        SELECT
            sr.user_id,
            sr.sg_off_the_tee,
            sr.sg_approach,
            sr.sg_around_the_green,
            sr.sg_putting,
            ROW_NUMBER() OVER (
                PARTITION BY sr.user_id, sr.date_played, sr.course_name
                ORDER BY sr.holes_played DESC, sr.created_at DESC
            ) AS rn
        FROM public.sg_rounds sr
        JOIN sg_round_keys sk
          ON sk.user_id     = sr.user_id
         AND sk.date_played = sr.date_played
         AND sk.course_name = sr.course_name
    ),

    sg_agg AS (
        SELECT
            user_id AS uid,
            COUNT(*)::int AS sg_round_count,
            AVG(sg_off_the_tee)      AS avg_sg_ott,
            AVG(sg_approach)         AS avg_sg_app,
            AVG(sg_around_the_green) AS avg_sg_arg,
            AVG(sg_putting)          AS avg_sg_putt
        FROM sg_rounds_ranked
        WHERE rn = 1
        GROUP BY user_id
    ),

    basic_holes AS (
        SELECT h.round_id AS game_id, rp.user_id AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.holes h
        JOIN public.round_players rp ON rp.id = h.player_id
        WHERE h.player_id IS NOT NULL
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.match_play_holes h
        JOIN public.match_play_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.copenhagen_holes h
        JOIN public.copenhagen_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.nine_points_holes h
        JOIN public.nine_points_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.skins_holes h
        JOIN public.skins_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.umbriago_holes h
        JOIN public.umbriago_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT h.game_id, COALESCE(h.stats_player_id, g.user_id) AS stats_player_id,
               h.par, h.fairway, h.gir, h.short_game_shots, h.putts
        FROM public.wolf_holes h
        JOIN public.wolf_games g ON g.id = h.game_id
        WHERE g.stats_mode = 'basic'
          AND (h.fairway IS NOT NULL OR h.gir IS NOT NULL OR h.putts IS NOT NULL)

        UNION ALL
        SELECT s.game_id, g.created_by AS stats_player_id,
               COALESCE(ch.par, 4) AS par,
               s.fairway, s.gir, s.short_game_shots, s.putts
        FROM public.banker_hole_scores s
        JOIN public.banker_games g ON g.id = s.game_id
        LEFT JOIN public.course_holes ch ON ch.course_id = g.course_id
                                         AND ch.hole_number = s.hole_number
        WHERE g.stats_mode = 'basic'
          AND s.player_order = 1
          AND (s.fairway IS NOT NULL OR s.gir IS NOT NULL OR s.putts IS NOT NULL)
    ),

    basic_agg AS (
        SELECT
            bh.stats_player_id AS uid,
            COUNT(DISTINCT bh.game_id)::int AS basic_stats_round_count,

            100.0 * COUNT(*) FILTER (WHERE bh.par >= 4 AND bh.fairway = 'fairway')
                  / NULLIF(COUNT(*) FILTER (WHERE bh.par >= 4 AND bh.fairway IS NOT NULL), 0)
                AS fairway_pct,

            100.0 * COUNT(*) FILTER (WHERE bh.gir = true)
                  / NULLIF(COUNT(*) FILTER (WHERE bh.gir IS NOT NULL), 0)
                AS gir_pct,

            SUM(bh.putts)::numeric
                  / NULLIF(COUNT(*) FILTER (WHERE bh.putts IS NOT NULL), 0)
                AS putts_per_hole,

            100.0 * COUNT(*) FILTER (
                        WHERE bh.gir = false
                          AND bh.short_game_shots = 1
                          AND COALESCE(bh.putts, 2) <= 1
                    )
                  / NULLIF(SUM(bh.short_game_shots) FILTER (
                        WHERE bh.gir = false
                          AND bh.short_game_shots > 0
                    ), 0)
                AS up_down_pct
        FROM basic_holes bh
        JOIN target_users t ON t.uid = bh.stats_player_id
        GROUP BY bh.stats_player_id
    )

    SELECT
        p.id AS user_id,
        p.display_name,
        p.avatar_url,
        COALESCE(sa.sg_round_count, 0)::int          AS sg_round_count,
        COALESCE(ba.basic_stats_round_count, 0)::int AS basic_stats_round_count,

        CASE WHEN COALESCE(sa.sg_round_count, 0) >= p_min_rounds
             THEN sa.avg_sg_ott  END AS avg_sg_ott,
        CASE WHEN COALESCE(sa.sg_round_count, 0) >= p_min_rounds
             THEN sa.avg_sg_app  END AS avg_sg_app,
        CASE WHEN COALESCE(sa.sg_round_count, 0) >= p_min_rounds
             THEN sa.avg_sg_arg  END AS avg_sg_arg,
        CASE WHEN COALESCE(sa.sg_round_count, 0) >= p_min_rounds
             THEN sa.avg_sg_putt END AS avg_sg_putt,

        CASE WHEN COALESCE(ba.basic_stats_round_count, 0) >= p_min_rounds
             THEN ba.fairway_pct    END AS fairway_pct,
        CASE WHEN COALESCE(ba.basic_stats_round_count, 0) >= p_min_rounds
             THEN ba.gir_pct        END AS gir_pct,
        CASE WHEN COALESCE(ba.basic_stats_round_count, 0) >= p_min_rounds
             THEN ba.putts_per_hole END AS putts_per_hole,
        CASE WHEN COALESCE(ba.basic_stats_round_count, 0) >= p_min_rounds
             THEN ba.up_down_pct    END AS up_down_pct

    FROM target_users t
    JOIN public.profiles p   ON p.id  = t.uid
    LEFT JOIN sg_agg sa      ON sa.uid = t.uid
    LEFT JOIN basic_agg ba   ON ba.uid = t.uid;
$$;


ALTER FUNCTION "public"."get_friend_stats_aggregate"("p_user_id" "uuid", "p_min_rounds" integer, "p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friends_for_user"("target_user_id" "uuid") RETURNS TABLE("friend_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT CASE 
    WHEN user_a = target_user_id THEN user_b 
    ELSE user_a 
  END as friend_id
  FROM friendships
  WHERE (user_a = target_user_id OR user_b = target_user_id)
    AND status = 'accepted'
  UNION
  SELECT b AS friend_id FROM friends_pairs WHERE a = target_user_id
  UNION
  SELECT a AS friend_id FROM friends_pairs WHERE b = target_user_id;
$$;


ALTER FUNCTION "public"."get_friends_for_user"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_courses"("p_user_id" "uuid") RETURNS TABLE("course_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    -- Played: rounds I was a player in
    SELECT DISTINCT r.course_id
    FROM round_players rp
    INNER JOIN rounds r ON r.id = rp.round_id
    WHERE rp.user_id = p_user_id
      AND r.course_id IS NOT NULL
  UNION
    -- Favorited
    SELECT fc.course_id
    FROM favorite_courses fc
    WHERE fc.user_id = p_user_id
  UNION
    -- Imported
    SELECT c.id
    FROM courses c
    WHERE c.imported_by = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_my_courses"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_played_courses_with_stats"("p_user_id" "uuid") RETURNS TABLE("course_id" "uuid", "course_name" "text", "country_code" "text", "latitude" numeric, "longitude" numeric, "played_count" bigint, "best_score" integer, "best_score_par" integer, "best_score_date" "date", "last_played" "date")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH user_rounds AS (
    -- Every round (across all formats) where p_user_id was a participant,
    -- on a golfapi.io course, respecting privacy.
    SELECT upc.course_id, upc.date_played
    FROM user_played_courses_v1 upc
    JOIN courses c ON c.id = upc.course_id
    WHERE upc.user_id = p_user_id
      AND c.external_source = 'golfapi.io'
      AND (upc.is_private = false OR upc.round_owner = p_user_id)
  ),
  -- Best 18-hole round from Stroke Play / Tournament rounds only (via holes).
  round_scores AS (
    SELECT r.id AS round_id, r.course_id, r.date_played::date AS date_played,
           SUM(h.score)::int AS gross,
           SUM(h.par)::int AS par_total
    FROM rounds r
    JOIN round_players rp ON rp.round_id = r.id
    JOIN holes h ON h.player_id = rp.id
    JOIN courses c ON c.id = r.course_id
    WHERE rp.user_id = p_user_id
      AND rp.track_strokes_gained = true
      AND r.is_finished = true
      AND r.holes_played = 18
      AND c.external_source = 'golfapi.io'
      AND (r.is_private = false OR r.user_id = p_user_id)
    GROUP BY r.id, r.course_id, r.date_played
  ),
  best AS (
    SELECT DISTINCT ON (course_id)
      course_id, gross AS best_score, par_total AS best_score_par, date_played AS best_score_date
    FROM round_scores
    ORDER BY course_id, gross ASC, date_played DESC
  ),
  agg AS (
    SELECT course_id,
           COUNT(*)::bigint AS played_count,
           MAX(date_played) AS last_played
    FROM user_rounds
    GROUP BY course_id
  )
  SELECT
    c.id, c.name, c.country_code, c.latitude, c.longitude,
    agg.played_count,
    best.best_score, best.best_score_par, best.best_score_date,
    agg.last_played
  FROM agg
  JOIN courses c ON c.id = agg.course_id
  LEFT JOIN best ON best.course_id = agg.course_id
  ORDER BY agg.played_count DESC, c.name ASC;
$$;


ALTER FUNCTION "public"."get_my_played_courses_with_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notification_preferences"("_user_id" "uuid") RETURNS TABLE("enabled" boolean, "friend_request_enabled" boolean, "group_invite_enabled" boolean, "high_score_enabled" boolean, "message_enabled" boolean, "round_completed_enabled" boolean, "achievement_unlocked_enabled" boolean, "group_activity_enabled" boolean, "quiet_hours_start" time without time zone, "quiet_hours_end" time without time zone, "quiet_hours_enabled" boolean, "auto_delete_read_after_days" integer, "auto_delete_unread_after_days" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  prefs RECORD;
BEGIN
  -- Get existing preferences or return defaults
  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  IF prefs IS NULL THEN
    -- Return defaults
    RETURN QUERY SELECT
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      true::BOOLEAN,
      NULL::TIME,
      NULL::TIME,
      false::BOOLEAN,
      30::INTEGER,
      90::INTEGER;
  ELSE
    RETURN QUERY SELECT
      prefs.enabled,
      prefs.friend_request_enabled,
      prefs.group_invite_enabled,
      prefs.high_score_enabled,
      prefs.message_enabled,
      prefs.round_completed_enabled,
      prefs.achievement_unlocked_enabled,
      prefs.group_activity_enabled,
      prefs.quiet_hours_start,
      prefs.quiet_hours_end,
      prefs.quiet_hours_enabled,
      prefs.auto_delete_read_after_days,
      prefs.auto_delete_unread_after_days;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_notification_preferences"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_drill_by_title"("p_title" "text", "p_shot_area" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.drills WHERE title = p_title LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.drills (title, shot_area, visibility)
    VALUES (p_title, p_shot_area, 'coach_only') RETURNING id INTO v_id;
  ELSIF p_shot_area IS NOT NULL THEN
    UPDATE public.drills SET shot_area = p_shot_area WHERE id = v_id AND shot_area IS NULL;
  END IF;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_drill_by_title"("p_title" "text", "p_shot_area" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_personal_bests_for_drills"("p_drills" "jsonb") RETURNS TABLE("drill_slug" "text", "best_score" integer, "best_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH drills_input AS (
    SELECT
      (elem->>'slug')::text AS slug,
      ARRAY(SELECT jsonb_array_elements_text(elem->'titles')) AS titles
    FROM jsonb_array_elements(p_drills) AS elem
  )
  SELECT
    di.slug AS drill_slug,
    pb.best_score,
    pb.best_at
  FROM drills_input di
  CROSS JOIN LATERAL (
    WITH drill_info AS (
      SELECT id, COALESCE(lower_is_better, false) AS lower_is_better
      FROM public.drills
      WHERE title = ANY(di.titles)
    ),
    dir AS (
      -- If variants disagree (shouldn't happen, but defensive), prefer
      -- the lower-is-better interpretation — same rule as the existing
      -- `top3_friends_for_drill_by_title` RPC.
      SELECT COALESCE(bool_or(lower_is_better), false) AS v
      FROM drill_info
    ),
    ordered AS (
      -- Rank all of the viewer's results for this drill by score in
      -- the drill's preferred direction; rn = 1 is the personal best.
      -- Using ROW_NUMBER lets us grab `best_score` and its `created_at`
      -- in the same pass without a grouped aggregate.
      SELECT
        dr.total_points,
        dr.created_at,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN (SELECT v FROM dir) THEN dr.total_points END ASC,
            CASE WHEN NOT (SELECT v FROM dir) THEN dr.total_points END DESC,
            dr.created_at DESC
        ) AS rn
      FROM public.drill_results dr
      WHERE dr.user_id = auth.uid()
        AND dr.drill_id IN (SELECT id FROM drill_info)
    )
    SELECT
      total_points::integer AS best_score,
      created_at            AS best_at
    FROM ordered
    WHERE rn = 1
  ) pb
  WHERE pb.best_score IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_personal_bests_for_drills"("p_drills" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile"("target_user_id" "uuid") RETURNS TABLE("avatar_url" "text", "country" "text", "display_name" "text", "handicap" "text", "home_club" "text", "id" "uuid", "username" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.avatar_url,
    p.country,
    COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''),
             NULLIF(split_part(COALESCE(p.email, ''), '@', 1), '')) AS display_name,
    p.handicap,
    p.home_club,
    p.id,
    p.username
  FROM public.profiles p
  WHERE
    auth.uid() IS NOT NULL
    AND p.id = target_user_id
    AND (p.id = auth.uid() OR NOT public.is_blocked_either_way(p.id))
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_public_profile"("target_user_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "creator_id" "uuid" NOT NULL,
    "total_rounds" integer DEFAULT 4 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "default_mulligans" integer DEFAULT 0 NOT NULL,
    "default_gimmes_enabled" boolean DEFAULT false NOT NULL,
    "tournament_type" "text" DEFAULT 'single'::"text" NOT NULL,
    "scoring_mode" "text" DEFAULT 'direct'::"text" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "spoiler_guard_enabled" boolean DEFAULT false NOT NULL,
    "spoiler_revealed" boolean DEFAULT false NOT NULL,
    "allowed_formats" "text"[],
    "formats_locked" boolean DEFAULT false NOT NULL,
    "mulligans_locked" boolean DEFAULT false NOT NULL,
    "default_handicaps_required" boolean DEFAULT true NOT NULL,
    "handicaps_locked" boolean DEFAULT false NOT NULL,
    "default_course_id" "uuid",
    "course_locked" boolean DEFAULT false NOT NULL,
    "default_tee_column_key" "text",
    "tee_locked" boolean DEFAULT false NOT NULL,
    "default_hole_selection" "text" DEFAULT 'full18'::"text" NOT NULL,
    "holes_locked" boolean DEFAULT false NOT NULL,
    "date_window_start" timestamp with time zone,
    "date_window_end" timestamp with time zone,
    "date_window_locked" boolean DEFAULT false NOT NULL,
    "is_unlimited_rounds" boolean DEFAULT false NOT NULL,
    "cumulative_scoring_rule" "text",
    "best_n_count" integer,
    CONSTRAINT "best_n_count_matches_rule" CHECK (((("cumulative_scoring_rule" IS DISTINCT FROM 'best_n'::"text") AND ("best_n_count" IS NULL)) OR (("cumulative_scoring_rule" = 'best_n'::"text") AND (("best_n_count" >= 1) AND ("best_n_count" <= 20))))),
    CONSTRAINT "course_lock_requires_course" CHECK (((NOT "course_locked") OR ("default_course_id" IS NOT NULL))),
    CONSTRAINT "course_locked_requires_default_course" CHECK (((NOT "course_locked") OR ("default_course_id" IS NOT NULL))),
    CONSTRAINT "cumulative_scoring_rule_matches_unlimited" CHECK ((((NOT "is_unlimited_rounds") AND ("cumulative_scoring_rule" IS NULL)) OR ("is_unlimited_rounds" AND ("cumulative_scoring_rule" IS NOT NULL)))),
    CONSTRAINT "cumulative_scoring_rule_valid_values" CHECK ((("cumulative_scoring_rule" IS NULL) OR ("cumulative_scoring_rule" = ANY (ARRAY['total'::"text", 'average'::"text", 'best_n'::"text"])))),
    CONSTRAINT "date_window_end_after_start" CHECK ((("date_window_start" IS NULL) OR ("date_window_end" IS NULL) OR ("date_window_end" >= "date_window_start"))),
    CONSTRAINT "date_window_lock_requires_endpoints" CHECK (((NOT "date_window_locked") OR (("date_window_start" IS NOT NULL) AND ("date_window_end" IS NOT NULL)))),
    CONSTRAINT "date_window_locked_requires_endpoints" CHECK (((NOT "date_window_locked") OR (("date_window_start" IS NOT NULL) AND ("date_window_end" IS NOT NULL)))),
    CONSTRAINT "formats_lock_requires_format" CHECK (((NOT "formats_locked") OR (("allowed_formats" IS NOT NULL) AND ("array_length"("allowed_formats", 1) >= 1)))),
    CONSTRAINT "formats_locked_requires_allowed_formats" CHECK (((NOT "formats_locked") OR (("allowed_formats" IS NOT NULL) AND ("array_length"("allowed_formats", 1) >= 1)))),
    CONSTRAINT "tee_lock_requires_tee" CHECK (((NOT "tee_locked") OR (("default_tee_column_key" IS NOT NULL) AND ("default_tee_column_key" <> ''::"text")))),
    CONSTRAINT "tournaments_default_hole_selection_check" CHECK (("default_hole_selection" = ANY (ARRAY['full18'::"text", 'front9'::"text", 'back9'::"text"])))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_tournaments_for_user"("target_user_id" "uuid") RETURNS SETOF "public"."tournaments"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT t.*
  FROM tournaments t
  JOIN tournament_members tm ON tm.tournament_id = t.id
  WHERE tm.user_id = target_user_id
  AND t.is_private = false
  ORDER BY t.created_at DESC;
$$;


ALTER FUNCTION "public"."get_public_tournaments_for_user"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recommended_coach_drills"("p_focus_area" "text", "p_difficulty" "text" DEFAULT NULL::"text", "p_exclude_ids" "uuid"[] DEFAULT '{}'::"uuid"[], "p_limit" integer DEFAULT 7) RETURNS TABLE("id" "uuid", "title" "text", "focus_area" "text", "difficulty" "text", "goal_tags" "text"[], "drill_type" "text", "shot_area" "text", "goal" "text", "setup_steps" "jsonb", "rules" "jsonb", "outcomes" "jsonb", "time_minutes" integer, "lower_is_better" boolean, "quality_score" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH scored AS (
    SELECT
      cd.id,
      cd.title,
      cd.focus_area,
      cd.difficulty,
      cd.goal_tags,
      (cd.payload->>'drill_type')::text AS drill_type,
      (cd.payload->>'shot_area')::text AS shot_area,
      (cd.payload->>'goal')::text AS goal,
      cd.payload->'setup_steps' AS setup_steps,
      cd.payload->'rules' AS rules,
      cd.payload->'outcomes' AS outcomes,
      (cd.payload->>'time_minutes')::int AS time_minutes,
      (cd.payload->>'lower_is_better')::boolean AS lower_is_better,
      -- Base quality score
      (cd.upvotes - cd.downvotes)
        + (cd.completion_count * 0.2)
        + (cd.times_used * 0.05)
      -- Focus area bonus: +3 for exact match, +1 for mixed, 0 for mismatch
      + CASE
          WHEN cd.focus_area = p_focus_area THEN 3
          WHEN cd.focus_area = 'mixed' THEN 1
          ELSE 0
        END
      -- Difficulty bonus: +2 exact, +1 adjacent, 0 mismatch
      + CASE
          WHEN p_difficulty IS NULL THEN 0
          WHEN cd.difficulty = p_difficulty THEN 2
          WHEN cd.difficulty IS NULL THEN 0
          -- adjacent difficulty levels
          WHEN p_difficulty = 'beginner' AND cd.difficulty = 'intermediate' THEN 1
          WHEN p_difficulty = 'intermediate' AND cd.difficulty IN ('beginner', 'advanced') THEN 1
          WHEN p_difficulty = 'advanced' AND cd.difficulty = 'intermediate' THEN 1
          ELSE 0
        END
      -- Freshness: small penalty for old drills (max -2 for drills >60 days old)
      - LEAST(
          EXTRACT(EPOCH FROM (now() - cd.created_at)) / (30 * 86400),
          2
        )
      AS quality_score
    FROM public.coach_drills cd
    WHERE
      -- Must have focus_area populated
      cd.focus_area IS NOT NULL
      -- Exclude specific IDs
      AND (p_exclude_ids IS NULL OR cd.id != ALL(p_exclude_ids))
      -- Must not be downvoted into oblivion
      AND (cd.upvotes - cd.downvotes) >= -2
      -- Focus area: exact match OR mixed OR same broad category
      AND (
        cd.focus_area = p_focus_area
        OR cd.focus_area = 'mixed'
        OR p_focus_area = 'mixed'
      )
  )
  SELECT
    s.id, s.title, s.focus_area, s.difficulty, s.goal_tags,
    s.drill_type, s.shot_area, s.goal, s.setup_steps, s.rules,
    s.outcomes, s.time_minutes, s.lower_is_better, s.quality_score
  FROM scored s
  ORDER BY s.quality_score DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_recommended_coach_drills"("p_focus_area" "text", "p_difficulty" "text", "p_exclude_ids" "uuid"[], "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_round_stats_summary"("p_round_ids" "uuid"[]) RETURNS TABLE("round_id" "uuid", "user_id" "uuid", "fairway_pct" numeric, "gir_pct" numeric, "up_down_pct" numeric, "putts_per_hole" numeric)
    LANGUAGE "sql" STABLE
    AS $$
    WITH scoped_holes AS (
        SELECT
            rp.round_id         AS r_id,
            rp.user_id          AS u_id,
            h.par,
            h.fairway,
            h.gir,
            h.short_game_shots,
            h.putts
        FROM holes h
        JOIN round_players rp ON rp.id = h.player_id
        JOIN rounds r         ON r.id = rp.round_id
        WHERE rp.round_id = ANY(p_round_ids)
          AND rp.is_guest = false
          AND rp.user_id IS NOT NULL
          AND r.is_finished = true
          AND r.stats_mode IN ('basic', 'strokes_gained')
    )
    SELECT
        r_id AS round_id,
        u_id AS user_id,

        -- Fairway %
        CASE
            WHEN SUM(CASE WHEN par >= 4 AND fairway IS NOT NULL THEN 1 ELSE 0 END) > 0
            THEN ROUND(
                SUM(CASE WHEN par >= 4 AND fairway = 'fairway' THEN 1 ELSE 0 END)::numeric
                / SUM(CASE WHEN par >= 4 AND fairway IS NOT NULL THEN 1 ELSE 0 END)::numeric
                * 100,
                1
            )
            ELSE NULL
        END AS fairway_pct,

        -- GIR %
        CASE
            WHEN SUM(CASE WHEN gir IS NOT NULL THEN 1 ELSE 0 END) > 0
            THEN ROUND(
                SUM(CASE WHEN gir = true THEN 1 ELSE 0 END)::numeric
                / SUM(CASE WHEN gir IS NOT NULL THEN 1 ELSE 0 END)::numeric
                * 100,
                1
            )
            ELSE NULL
        END AS gir_pct,

        -- Up & down %
        CASE
            WHEN SUM(
                    CASE WHEN gir = false AND COALESCE(short_game_shots, 0) > 0
                         THEN short_game_shots ELSE 0 END
                 ) > 0
            THEN ROUND(
                SUM(CASE
                        WHEN gir = false
                         AND short_game_shots = 1
                         AND (short_game_shots + COALESCE(putts, 2)) <= 2
                        THEN 1 ELSE 0
                    END)::numeric
                / SUM(
                    CASE WHEN gir = false AND COALESCE(short_game_shots, 0) > 0
                         THEN short_game_shots ELSE 0 END
                  )::numeric
                * 100,
                1
            )
            ELSE NULL
        END AS up_down_pct,

        -- Putts per hole
        CASE
            WHEN SUM(CASE WHEN putts IS NOT NULL THEN 1 ELSE 0 END) > 0
            THEN ROUND(
                SUM(COALESCE(putts, 0))::numeric
                / SUM(CASE WHEN putts IS NOT NULL THEN 1 ELSE 0 END)::numeric,
                2
            )
            ELSE NULL
        END AS putts_per_hole

    FROM scoped_holes
    GROUP BY r_id, u_id;
$$;


ALTER FUNCTION "public"."get_round_stats_summary"("p_round_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top3_friends_for_drills"("p_drills" "jsonb") RETURNS TABLE("drill_slug" "text", "user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer, "rank" integer, "is_me" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH drills_input AS (
    SELECT
      (elem->>'slug')::text AS slug,
      ARRAY(SELECT jsonb_array_elements_text(elem->'titles')) AS titles
    FROM jsonb_array_elements(p_drills) AS elem
  ),
  -- Eligible users = the viewer plus everyone they've friended.
  -- Using UNION (not UNION ALL) de-duplicates if a friend row is
  -- somehow stored in both directions.
  eligible_users AS (
    SELECT auth.uid() AS user_id
    UNION
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END AS user_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  )
  SELECT
    di.slug AS drill_slug,
    top3.user_id,
    top3.display_name,
    top3.username,
    top3.best_score,
    top3.rank,
    top3.is_me
  FROM drills_input di
  CROSS JOIN LATERAL (
    WITH drill_info AS (
      SELECT id, COALESCE(lower_is_better, false) AS lower_is_better
      FROM public.drills
      WHERE title = ANY(di.titles)
    ),
    dir AS (
      SELECT COALESCE(bool_or(lower_is_better), false) AS v
      FROM drill_info
    ),
    best AS (
      SELECT
        dr.user_id,
        CASE WHEN (SELECT v FROM dir)
             THEN MIN(dr.total_points)
             ELSE MAX(dr.total_points)
        END AS best_score
      FROM public.drill_results dr
      WHERE dr.drill_id IN (SELECT id FROM drill_info)
        AND dr.user_id IN (SELECT user_id FROM eligible_users)
      GROUP BY dr.user_id
    ),
    ranked AS (
      SELECT
        b.user_id,
        p.display_name,
        p.username,
        b.best_score,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN (SELECT v FROM dir) THEN b.best_score END ASC,
            CASE WHEN NOT (SELECT v FROM dir) THEN b.best_score END DESC,
            p.username ASC
        )::int AS rank,
        (b.user_id = auth.uid()) AS is_me
      FROM best b
      JOIN public.profiles p ON p.id = b.user_id
    )
    SELECT * FROM ranked WHERE rank <= 3
  ) top3
  WHERE top3.best_score IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_top3_friends_for_drills"("p_drills" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_leaderboard"("p_tournament_id" "uuid") RETURNS TABLE("member_id" "uuid", "display_name" "text", "user_id" "uuid", "rounds_played" bigint, "total_strokes" bigint, "total_par" bigint, "total_vs_par" bigint, "position" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
WITH member_scores AS (
    SELECT
        tm.id as member_id,
        COALESCE(tm.guest_name, p.display_name, p.username, 'Player') as display_name,
        tm.user_id,
        COUNT(DISTINCT tr.round_id) FILTER (WHERE tr.status = 'completed') as rounds_played,
        COALESCE(SUM(h.score) FILTER (WHERE tr.status = 'completed'), 0) as total_strokes,
        COALESCE(SUM(h.par) FILTER (WHERE tr.status = 'completed'), 0) as total_par
    FROM tournament_members tm
    LEFT JOIN profiles p ON p.id = tm.user_id
    LEFT JOIN round_players rp ON rp.event_player_id = tm.event_player_id
    LEFT JOIN tournament_rounds tr ON tr.round_id = rp.round_id AND tr.tournament_id = tm.tournament_id
    LEFT JOIN holes h ON h.round_id = rp.round_id AND h.player_id = rp.id
    WHERE tm.tournament_id = p_tournament_id
    GROUP BY tm.id, tm.guest_name, p.display_name, p.username, tm.user_id
)
SELECT
    member_id,
    display_name,
    user_id,
    rounds_played,
    total_strokes,
    total_par,
    (total_strokes - total_par) as total_vs_par,
    RANK() OVER (ORDER BY
        CASE WHEN rounds_played = 0 THEN 1 ELSE 0 END,
        (total_strokes - total_par) ASC,
        total_strokes ASC
    ) as "position"
FROM member_scores
ORDER BY "position";
$$;


ALTER FUNCTION "public"."get_tournament_leaderboard"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_members_public"("target_tournament_id" "uuid") RETURNS TABLE("id" "uuid", "tournament_id" "uuid", "user_id" "uuid", "guest_name" "text", "role" "text", "added_at" timestamp with time zone, "event_player_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "handicap" "text", "home_club" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT 
    tm.id,
    tm.tournament_id,
    tm.user_id,
    tm.guest_name,
    tm.role,
    tm.added_at,
    tm.event_player_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.handicap,
    p.home_club
  FROM tournament_members tm
  LEFT JOIN profiles p ON p.id = tm.user_id
  WHERE tm.tournament_id = target_tournament_id
  ORDER BY tm.added_at ASC;
$$;


ALTER FUNCTION "public"."get_tournament_members_public"("target_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tournament_public"("target_tournament_id" "uuid") RETURNS SETOF "public"."tournaments"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT t.*
  FROM tournaments t
  WHERE t.id = target_tournament_id
  AND t.is_private = false;
$$;


ALTER FUNCTION "public"."get_tournament_public"("target_tournament_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "round_id" "uuid" NOT NULL,
    "round_number" integer NOT NULL,
    "course_name" "text",
    "round_date" "date",
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "multiplier" numeric DEFAULT 1 NOT NULL,
    "game_format" "text",
    "round_name" "text",
    "included_player_ids" "text"[],
    "point_config_snapshot" "jsonb"
);


ALTER TABLE "public"."tournament_rounds" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tournament_rounds"."included_player_ids" IS 'Array of round_players.id values that are linked to the tournament for this round. NULL = legacy/all-players-included. Set at round-creation by the wizard from tournamentIncludedPlayerIds.';



CREATE OR REPLACE FUNCTION "public"."get_tournament_rounds_public"("target_tournament_id" "uuid") RETURNS SETOF "public"."tournament_rounds"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT tr.*
  FROM tournament_rounds tr
  WHERE tr.tournament_id = target_tournament_id
  ORDER BY tr.round_number ASC;
$$;


ALTER FUNCTION "public"."get_tournament_rounds_public"("target_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_counts"("uid" "uuid") RETURNS TABLE("conversation_id" "uuid", "unread_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT m.conversation_id, COUNT(*) AS unread_count
  FROM public.messages m
  WHERE m.is_read = false
    AND m.sender_id <> uid
    AND m.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = m.conversation_id
          AND cp.user_id = uid
      )
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        JOIN public.group_members gm ON gm.group_id = c.group_id
        WHERE c.id = m.conversation_id
          AND gm.user_id = uid
      )
    )
  GROUP BY m.conversation_id;
$$;


ALTER FUNCTION "public"."get_unread_counts"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."global_leaderboard_for_drill"("p_drill_title" "text") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer, "rank" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  best_scores AS (
    SELECT 
      dr.user_id,
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
    GROUP BY dr.user_id, drill_info.lower_is_better
  ),
  ranked AS (
    SELECT 
      bs.user_id,
      p.display_name,
      p.username,
      bs.best_score,
      RANK() OVER (
        ORDER BY 
          CASE WHEN drill_info.lower_is_better THEN bs.best_score END ASC,
          CASE WHEN NOT drill_info.lower_is_better THEN bs.best_score END DESC
      ) as rank
    FROM best_scores bs
    JOIN public.profiles p ON p.id = bs.user_id
    CROSS JOIN drill_info
  )
  SELECT * FROM ranked
  ORDER BY rank, username;
$$;


ALTER FUNCTION "public"."global_leaderboard_for_drill"("p_drill_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."group_level_leaderboard"("p_group_id" "uuid") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "avatar_url" "text", "category" "text", "tier" "text", "completed_in_tier" integer, "total_completed" integer, "total_xp" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH visible_users AS (
    SELECT gm.user_id AS uid
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND public.is_group_member(auth.uid(), p_group_id)
  ),
  per_tier AS (
    SELECT
      ulp.user_id,
      l.category,
      l.tier,
      CASE l.tier
        WHEN 'rookie'       THEN 1
        WHEN 'amateur'      THEN 2
        WHEN 'intermediate' THEN 3
        WHEN 'pro'          THEN 4
      END AS tier_rank,
      COUNT(*)::INT  AS completed_count,
      SUM(l.xp)::INT AS xp_sum
    FROM public.user_level_progress ulp
    JOIN public.levels l ON l.id = ulp.level_id
    WHERE ulp.user_id IN (SELECT uid FROM visible_users)
    GROUP BY ulp.user_id, l.category, l.tier
  ),
  highest_tier AS (
    SELECT DISTINCT ON (user_id, category)
      user_id, category, tier, completed_count
    FROM per_tier
    ORDER BY user_id, category, tier_rank DESC
  ),
  category_totals AS (
    SELECT user_id, category,
           SUM(completed_count)::INT AS total_completed,
           SUM(xp_sum)::INT          AS total_xp
    FROM per_tier
    GROUP BY user_id, category
  )
  SELECT
    ht.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    ht.category,
    ht.tier,
    ht.completed_count AS completed_in_tier,
    ct.total_completed,
    ct.total_xp
  FROM highest_tier ht
  JOIN category_totals ct ON ct.user_id = ht.user_id AND ct.category = ht.category
  JOIN public.profiles p  ON p.id = ht.user_id
  ORDER BY ct.total_xp DESC NULLS LAST, ct.total_completed DESC, p.username ASC;
$$;


ALTER FUNCTION "public"."group_level_leaderboard"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  meta jsonb;
  computed_display_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  computed_display_name :=
    nullif(btrim(coalesce(
      meta->>'display_name',
      meta->>'full_name',
      meta->>'name',
      (coalesce(meta->>'first_name', '') || ' ' || coalesce(meta->>'last_name', ''))
    )), '');

  if computed_display_name is null then
    computed_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, country, handicap, home_club)
  values (
    new.id,
    new.email,
    computed_display_name,
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'country', ''),
    nullif(meta->>'handicap', ''),
    nullif(meta->>'home_club', '')
  )
  on conflict (id) do update
  set
    email        = excluded.email,
    display_name = coalesce(nullif(profiles.display_name, ''), excluded.display_name),
    avatar_url   = coalesce(profiles.avatar_url, excluded.avatar_url),
    country      = coalesce(profiles.country, excluded.country),
    handicap     = coalesce(profiles.handicap, excluded.handicap),
    home_club    = coalesce(profiles.home_club, excluded.home_club);

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    select exists (
        select 1
          from public.map_battle_participants
         where battle_id = p_battle_id
           and user_id   = p_user_id
           and left_at   is null
    );
$$;


ALTER FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    select exists (
        select 1
          from public.map_battles
         where id = p_battle_id
           and owner_id = p_user_id
    );
$$;


ALTER FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_blocked_either_way"("other" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = other)
       OR (b.blocker_id = other       AND b.blocked_id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."is_blocked_either_way"("other" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('coach','admin')
  );
$$;


ALTER FUNCTION "public"."is_coach"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_creator"("_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE 
    WHEN _event_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.events
      WHERE id = _event_id AND creator_id = auth.uid()
    )
  END
$$;


ALTER FUNCTION "public"."is_event_creator"("_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_friend_of"("_owner_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester = auth.uid() AND addressee = _owner_id)
      OR (addressee = auth.uid() AND requester = _owner_id)
    )
  );
$$;


ALTER FUNCTION "public"."is_friend_of"("_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_friend_of_game_participant"("_game_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.round_status rs
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = rs.user_id)
        OR (f.addressee = auth.uid() AND f.requester = rs.user_id)
      )
    WHERE rs.round_id::text = _game_id
  );
$$;


ALTER FUNCTION "public"."is_friend_of_game_participant"("_game_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_friend_of_round_participant"("_round_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.round_players rp
    INNER JOIN public.friendships f
      ON f.status = 'accepted'
      AND (
        (f.requester = auth.uid() AND f.addressee = rp.user_id)
        OR (f.addressee = auth.uid() AND f.requester = rp.user_id)
      )
    WHERE rp.round_id = _round_id
  );
$$;


ALTER FUNCTION "public"."is_friend_of_round_participant"("_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("_user_id" "uuid", "_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
  )
$$;


ALTER FUNCTION "public"."is_group_member"("_user_id" "uuid", "_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_owner_or_admin"("_user_id" "uuid", "_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;


ALTER FUNCTION "public"."is_group_owner_or_admin"("_user_id" "uuid", "_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_round_owner"("_round_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
SELECT
EXISTS (SELECT 1 FROM public.rounds WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.banker_games WHERE id::text = _round_id AND created_by = auth.uid())
OR EXISTS (SELECT 1 FROM public.best_ball_worst_ball_games WHERE id::text = _round_id AND created_by = auth.uid())
OR EXISTS (SELECT 1 FROM public.match_play_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.copenhagen_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.skins_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.nine_points_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.wolf_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.umbriago_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.scramble_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.best_ball_games WHERE id::text = _round_id AND user_id = auth.uid())
OR EXISTS (SELECT 1 FROM public.best_ball_taliban_games WHERE id::text = _round_id AND user_id = auth.uid());
$$;


ALTER FUNCTION "public"."is_round_owner"("_round_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_round_participant"("p_round_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.round_status
    WHERE round_id::text = p_round_id
    AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_round_participant"("p_round_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_round_participant"("_user_id" "uuid", "_round_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.round_players
    WHERE round_id = _round_id AND user_id = _user_id
  )
$$;


ALTER FUNCTION "public"."is_round_participant"("_user_id" "uuid", "_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_session_coach"("uid" "uuid", "sid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_sessions
    WHERE id = sid AND created_by = uid AND public.is_coach(uid)
  )
$$;


ALTER FUNCTION "public"."is_session_coach"("uid" "uuid", "sid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_session_invited"("uid" "uuid", "sid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_invites
    WHERE session_id = sid AND invited_user_id = uid
  )
$$;


ALTER FUNCTION "public"."is_session_invited"("uid" "uuid", "sid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND creator_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_creator"("p_tournament_id" "text", "p_user_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id::text = p_tournament_id
    AND creator_id::text = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_tournament_creator"("p_tournament_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id = p_tournament_id AND creator_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_member"("p_tournament_id" "text", "p_user_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members
    WHERE tournament_id::text = p_tournament_id
    AND user_id::text = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_tournament_member"("p_tournament_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tournament_member"("p_tournament_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_tournament_member"("p_tournament_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_round"("p_round_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rp_id uuid;
BEGIN
  -- Find the caller's round_player id
  SELECT id INTO v_rp_id
  FROM round_players
  WHERE round_id = p_round_id
    AND user_id = v_uid
  LIMIT 1;

  -- Delete this player's holes
  IF v_rp_id IS NOT NULL THEN
    DELETE FROM holes
    WHERE round_id = p_round_id
      AND player_id = v_rp_id;
  END IF;

  -- Remove from round_players
  DELETE FROM round_players
  WHERE round_id = p_round_id
    AND user_id = v_uid;

  -- Mark round_status as 'left' (round_status.round_id is TEXT)
  UPDATE round_status
  SET status = 'left'
  WHERE round_id::uuid = p_round_id
    AND user_id = v_uid;
END;
$$;


ALTER FUNCTION "public"."leave_round"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_my_blocks"() RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "home_club" "text", "blocked_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT p.id, p.username, COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), '')) AS display_name, p.avatar_url, p.home_club, b.created_at AS blocked_at FROM public.blocks b JOIN public.profiles p ON p.id = b.blocked_id WHERE b.blocker_id = auth.uid() ORDER BY b.created_at DESC; $$;


ALTER FUNCTION "public"."list_my_blocks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Verify the caller is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1
    FROM conversations c
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE c.id = p_conversation_id
      AND gm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  -- Mark all unread messages from other senders as read
  UPDATE messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND is_read = false
    AND sender_id <> v_uid;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalized_friendship_pair"("a" "uuid", "b" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT ARRAY[LEAST(a, b), GREATEST(a, b)];
$$;


ALTER FUNCTION "public"."normalized_friendship_pair"("a" "uuid", "b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_battle_finished"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    rec record;
    v_battle_name text;
begin
    -- Only fire on null → set transition. UPDATE statements that don't
    -- change winner_user_id (status flip, ended_at stamp, etc.) skip.
    if NEW.winner_user_id is null then
        return NEW;
    end if;
    if OLD.winner_user_id is not null then
        return NEW;
    end if;

    v_battle_name := NEW.name;

    for rec in
        select user_id
          from public.map_battle_participants
         where battle_id = NEW.id
           and user_id <> NEW.winner_user_id
           and left_at is null
    loop
        insert into public.notifications (
            user_id,
            type,
            title,
            message,
            related_id,
            related_user_id,
            metadata
        ) values (
            rec.user_id,
            'battle_finished',
            'Battle finished',
            'Someone just won "' || v_battle_name || '"',
            NEW.id,
            NEW.winner_user_id,
            jsonb_build_object(
                'sub_type',  'battle_finished',
                'battle_id', NEW.id::text,
                'map_name',  v_battle_name
            )
        );
    end loop;

    return NEW;
end;
$$;


ALTER FUNCTION "public"."notify_battle_finished"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_challenge_events"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_challenge RECORD;
  v_group_name TEXT;
  v_member RECORD;
  v_body TEXT;
  v_title TEXT;
BEGIN
  FOR v_challenge IN
    SELECT *
    FROM public.group_challenges
    WHERE is_active = true
      AND start_date = CURRENT_DATE
  LOOP
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = v_challenge.group_id;

    v_title := 'Challenge Started!';
    v_body := v_challenge.title || ' has started in ' || COALESCE(v_group_name, 'your group') || '. Play ' || v_challenge.drill_title || ' before ' || to_char(v_challenge.end_date, 'Mon DD') || '!';

    FOR v_member IN
      SELECT gm.user_id
      FROM public.group_members gm
      WHERE gm.group_id = v_challenge.group_id
    LOOP
      IF public.should_send_notification(v_member.user_id, 'group_activity') THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        SELECT v_member.user_id, 'group_activity', v_title, v_body, v_challenge.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = v_member.user_id
            AND n.type = 'group_activity'
            AND n.related_id = v_challenge.id
            AND n.title = v_title
        );

        PERFORM net.http_post(
          url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
          body := jsonb_build_object(
            'recipient_user_id', v_member.user_id::text,
            'title', 'OnlyGolf',
            'body', v_body,
            'notification_type', 'group_activity_enabled',
            'metadata', jsonb_build_object(
              'type', 'group_activity',
              'activity_type', 'challenge_started',
              'challenge_id', v_challenge.id::text,
              'group_name', v_group_name
            )
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  FOR v_challenge IN
    SELECT *
    FROM public.group_challenges
    WHERE end_date = CURRENT_DATE - 1
  LOOP
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = v_challenge.group_id;

    v_title := 'Challenge Ended';
    v_body := v_challenge.title || ' in ' || COALESCE(v_group_name, 'your group') || ' has ended. Check the results!';

    FOR v_member IN
      SELECT gm.user_id
      FROM public.group_members gm
      WHERE gm.group_id = v_challenge.group_id
    LOOP
      IF public.should_send_notification(v_member.user_id, 'group_activity') THEN
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        SELECT v_member.user_id, 'group_activity', v_title, v_body, v_challenge.id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = v_member.user_id
            AND n.type = 'group_activity'
            AND n.related_id = v_challenge.id
            AND n.title = v_title
        );

        PERFORM net.http_post(
          url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
          body := jsonb_build_object(
            'recipient_user_id', v_member.user_id::text,
            'title', 'OnlyGolf',
            'body', v_body,
            'notification_type', 'group_activity_enabled',
            'metadata', jsonb_build_object(
              'type', 'group_activity',
              'activity_type', 'challenge_ended',
              'challenge_id', v_challenge.id::text,
              'group_name', v_group_name
            )
          )
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_challenge_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_drill_leaderboard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_drill_title text;
  v_user_name text;
  v_is_best boolean;
  v_lower_is_better boolean;
  v_group record;
  v_is_group_leader boolean;
  v_is_friend_leader boolean;
  v_group_notified_user_ids UUID[];
  v_group_member_ids UUID[];
  v_notify_user_id UUID;
  v_notify_title TEXT;
  v_notify_body TEXT;
BEGIN
  SELECT title, COALESCE(lower_is_better, false)
  INTO v_drill_title, v_lower_is_better
  FROM public.drills
  WHERE id = NEW.drill_id;

  SELECT COALESCE(display_name, username, 'Someone')
  INTO v_user_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_lower_is_better THEN
    SELECT NEW.total_points <= COALESCE(MIN(total_points), NEW.total_points)
    INTO v_is_best
    FROM public.drill_results
    WHERE drill_id = NEW.drill_id AND user_id = NEW.user_id;
  ELSE
    SELECT NEW.total_points >= COALESCE(MAX(total_points), NEW.total_points)
    INTO v_is_best
    FROM public.drill_results
    WHERE drill_id = NEW.drill_id AND user_id = NEW.user_id;
  END IF;

  IF v_is_best THEN
    v_group_notified_user_ids := ARRAY[]::UUID[];

    -- GROUP PRIORITY
    FOR v_group IN
      SELECT gm.group_id, g.name as group_name
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.user_id = NEW.user_id
    LOOP
      IF v_lower_is_better THEN
        SELECT NEW.total_points <= COALESCE(MIN(dr.total_points), NEW.total_points)
        INTO v_is_group_leader
        FROM public.drill_results dr
        JOIN public.group_members gm ON gm.user_id = dr.user_id
        WHERE dr.drill_id = NEW.drill_id
          AND gm.group_id = v_group.group_id
          AND dr.user_id != NEW.user_id;
      ELSE
        SELECT NEW.total_points >= COALESCE(MAX(dr.total_points), NEW.total_points)
        INTO v_is_group_leader
        FROM public.drill_results dr
        JOIN public.group_members gm ON gm.user_id = dr.user_id
        WHERE dr.drill_id = NEW.drill_id
          AND gm.group_id = v_group.group_id
          AND dr.user_id != NEW.user_id;
      END IF;

      IF v_is_group_leader THEN
        SELECT array_agg(DISTINCT gm.user_id)
        INTO v_group_member_ids
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id;

        v_notify_title := 'New Group Leader!';
        v_notify_body := v_user_name || ' is now leading ' || v_group.group_name || ' on ' || v_drill_title || ' with ' || NEW.total_points || ' points';

        INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, context_id, group_id)
        SELECT DISTINCT
          gm.user_id,
          'high_score',
          v_notify_title,
          v_notify_body,
          NEW.drill_id,
          NEW.user_id,
          v_group.group_id,
          v_group.group_id
        FROM public.group_members gm
        WHERE gm.group_id = v_group.group_id
          AND gm.user_id != NEW.user_id
          AND public.should_send_notification(gm.user_id, 'high_score')
          AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = gm.user_id
              AND n.type = 'high_score'
              AND n.related_id = NEW.drill_id
              AND n.related_user_id = NEW.user_id
              AND COALESCE(n.context_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_group.group_id, '00000000-0000-0000-0000-000000000000'::uuid)
          )
        ON CONFLICT DO NOTHING;

        FOR v_notify_user_id IN
          SELECT DISTINCT gm.user_id
          FROM public.group_members gm
          WHERE gm.group_id = v_group.group_id
            AND gm.user_id != NEW.user_id
            AND public.should_send_notification(gm.user_id, 'high_score')
        LOOP
          PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
              'recipient_user_id', v_notify_user_id::text,
              'title', 'OnlyGolf',
              'body', v_notify_body,
              'notification_type', 'high_score_enabled',
              'metadata', jsonb_build_object(
                'type', 'high_score',
                'drill_name', v_drill_title,
                'drill_id', NEW.drill_id::text,
                'new_holder_name', v_user_name,
                'new_score', NEW.total_points::text,
                'group_name', v_group.group_name
              )
            )
          );
        END LOOP;

        IF v_group_member_ids IS NOT NULL THEN
          v_group_notified_user_ids := v_group_notified_user_ids || v_group_member_ids;
        END IF;
      END IF;
    END LOOP;

    -- FRIEND PRIORITY
    IF v_lower_is_better THEN
      SELECT NEW.total_points <= COALESCE(MIN(dr.total_points), NEW.total_points)
      INTO v_is_friend_leader
      FROM public.drill_results dr
      JOIN public.friends_pairs fp ON (fp.a = dr.user_id OR fp.b = dr.user_id)
      WHERE dr.drill_id = NEW.drill_id
        AND dr.user_id != NEW.user_id
        AND (fp.a = NEW.user_id OR fp.b = NEW.user_id);
    ELSE
      SELECT NEW.total_points >= COALESCE(MAX(dr.total_points), NEW.total_points)
      INTO v_is_friend_leader
      FROM public.drill_results dr
      JOIN public.friends_pairs fp ON (fp.a = dr.user_id OR fp.b = dr.user_id)
      WHERE dr.drill_id = NEW.drill_id
        AND dr.user_id != NEW.user_id
        AND (fp.a = NEW.user_id OR fp.b = NEW.user_id);
    END IF;

    IF v_is_friend_leader THEN
      v_notify_title := 'New Friend Leader!';
      v_notify_body := v_user_name || ' is now leading your friends on ' || v_drill_title || ' with ' || NEW.total_points || ' points';

      INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, context_id, group_id)
      SELECT DISTINCT
        CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END,
        'high_score'::text,
        v_notify_title,
        v_notify_body,
        NEW.drill_id,
        NEW.user_id,
        NULL::uuid,
        NULL::uuid
      FROM public.friends_pairs fp
      WHERE (fp.a = NEW.user_id OR fp.b = NEW.user_id)
        AND CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END != ALL(v_group_notified_user_ids)
        AND public.should_send_notification(
              CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, 'high_score')
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END
            AND n.type = 'high_score'
            AND n.related_id = NEW.drill_id
            AND n.related_user_id = NEW.user_id
            AND COALESCE(n.context_id, '00000000-0000-0000-0000-000000000000'::uuid) = '00000000-0000-0000-0000-000000000000'::uuid
        )
      ON CONFLICT DO NOTHING;

      FOR v_notify_user_id IN
        SELECT DISTINCT CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END AS fid
        FROM public.friends_pairs fp
        WHERE (fp.a = NEW.user_id OR fp.b = NEW.user_id)
          AND CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END != ALL(v_group_notified_user_ids)
          AND public.should_send_notification(
                CASE WHEN fp.a = NEW.user_id THEN fp.b ELSE fp.a END, 'high_score')
      LOOP
        PERFORM net.http_post(
          url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
          body := jsonb_build_object(
            'recipient_user_id', v_notify_user_id::text,
            'title', 'OnlyGolf',
            'body', v_notify_body,
            'notification_type', 'high_score_enabled',
            'metadata', jsonb_build_object(
              'type', 'high_score',
              'drill_name', v_drill_title,
              'drill_id', NEW.drill_id::text,
              'new_holder_name', v_user_name,
              'new_score', NEW.total_points::text
            )
          )
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_drill_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_friend_finished_round"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    player_name TEXT;
    course_name TEXT;
    game_format TEXT;
    format_display TEXT;
    friend_id UUID;
    body_text TEXT;
BEGIN
    IF NEW.post_type != 'round_finished' THEN
        RETURN NEW;
    END IF;

    SELECT display_name INTO player_name
    FROM profiles WHERE id = NEW.user_id;
    IF player_name IS NULL THEN
        player_name := 'A friend';
    END IF;

    course_name := NEW.metadata->>'course_name';
    game_format := NEW.metadata->>'game_format';
    format_display := REPLACE(INITCAP(REPLACE(COALESCE(game_format, 'a round'), '_', ' ')), ' ', ' ');
    body_text := player_name || ' finished a round of ' || format_display || COALESCE(' at ' || course_name, '');

    FOR friend_id IN
        SELECT addressee FROM friendships
        WHERE requester = NEW.user_id AND status = 'accepted'
        UNION
        SELECT requester FROM friendships
        WHERE addressee = NEW.user_id AND status = 'accepted'
    LOOP
        CONTINUE WHEN NOT public.should_send_notification(friend_id, 'friend_finished_round');

        INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, metadata)
        VALUES (
            friend_id,
            'group_activity',
            'OnlyGolf',
            body_text,
            NEW.id,
            NEW.user_id,
            jsonb_build_object(
                'sub_type', 'friend_finished_round',
                'round_id', NEW.metadata->>'round_id',
                'game_format', game_format,
                'activity_post_id', NEW.id::text
            )
        );

        PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
                'recipient_user_id', friend_id::text,
                'title', 'OnlyGolf',
                'body', body_text,
                'notification_type', 'round_completed_enabled',
                'metadata', jsonb_build_object(
                    'type', 'friend_finished_round',
                    'activity_post_id', NEW.id::text,
                    'round_id', NEW.metadata->>'round_id',
                    'game_format', game_format
                )
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friend_finished_round"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    requester_name TEXT;
BEGIN
    IF NEW.status = 'pending' THEN
        IF NOT public.should_send_notification(NEW.addressee, 'friend_request') THEN
            RETURN NEW;
        END IF;

        SELECT display_name INTO requester_name
        FROM profiles WHERE id = NEW.requester;
        IF requester_name IS NULL THEN
            requester_name := 'Someone';
        END IF;

        PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
                'recipient_user_id', NEW.addressee::text,
                'title', 'Friend Request',
                'body', requester_name || ' wants to be your friend',
                'notification_type', 'friend_request_enabled',
                'metadata', jsonb_build_object(
                    'type', 'friend_request',
                    'requester_id', NEW.requester::text,
                    'requester_name', requester_name
                )
            )
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_friend_started_round"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    player_name TEXT;
    format_display TEXT;
    friend_id UUID;
    body_text TEXT;
BEGIN
    IF NEW.status != 'in_progress' THEN
        RETURN NEW;
    END IF;

    SELECT display_name INTO player_name
    FROM profiles WHERE id = NEW.user_id::uuid;
    IF player_name IS NULL THEN
        player_name := 'A friend';
    END IF;

    format_display := REPLACE(INITCAP(REPLACE(COALESCE(NEW.game_format, 'a round'), '_', ' ')), ' ', ' ');
    body_text := player_name || ' started a round of ' || format_display || COALESCE(' at ' || NEW.course_name, '');

    FOR friend_id IN
        SELECT addressee FROM friendships
        WHERE requester = NEW.user_id::uuid AND status = 'accepted'
        UNION
        SELECT requester FROM friendships
        WHERE addressee = NEW.user_id::uuid AND status = 'accepted'
    LOOP
        CONTINUE WHEN NOT public.should_send_notification(friend_id, 'friend_started_round');

        INSERT INTO public.notifications (user_id, type, title, message, related_user_id, metadata)
        VALUES (
            friend_id,
            'group_activity',
            'OnlyGolf',
            body_text,
            NEW.user_id::uuid,
            jsonb_build_object(
                'sub_type', 'friend_started_round',
                'round_id', NEW.round_id,
                'game_format', NEW.game_format,
                'course_name', NEW.course_name
            )
        );

        PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
                'recipient_user_id', friend_id::text,
                'title', 'OnlyGolf',
                'body', body_text,
                'notification_type', 'friend_started_round_enabled',
                'metadata', jsonb_build_object(
                    'type', 'friend_started_round',
                    'round_id', NEW.round_id,
                    'user_id', NEW.user_id,
                    'user_name', player_name,
                    'game_format', NEW.game_format,
                    'course_name', NEW.course_name
                )
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friend_started_round"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_group_session_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    creator_name TEXT;
    group_name TEXT;
    session_date TEXT;
    member RECORD;
    body_text TEXT;
    tz TEXT;
BEGIN
    tz := COALESCE(NEW.timezone, 'UTC');

    SELECT display_name INTO creator_name
    FROM profiles WHERE id = NEW.created_by;

    SELECT name INTO group_name
    FROM groups WHERE id = NEW.group_id;
    IF group_name IS NULL THEN
        group_name := 'your group';
    END IF;

    session_date := TO_CHAR(NEW.start_time AT TIME ZONE tz, 'Mon DD "at" HH24:MI');
    body_text := 'New session: ' || NEW.title || ' on ' || session_date;

    FOR member IN
        SELECT user_id FROM group_members
        WHERE group_id = NEW.group_id
          AND user_id != NEW.created_by
    LOOP
        CONTINUE WHEN NOT public.should_send_notification(member.user_id, 'group_activity');

        INSERT INTO public.notifications (user_id, type, title, message, related_id, metadata)
        VALUES (
            member.user_id,
            'group_activity',
            group_name,
            body_text,
            NEW.id,
            jsonb_build_object(
                'sub_type', 'session_scheduled',
                'group_id', NEW.group_id::text,
                'group_name', group_name,
                'session_id', NEW.id::text,
                'session_title', NEW.title
            )
        );

        PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
                'recipient_user_id', member.user_id::text,
                'title', group_name,
                'body', body_text,
                'notification_type', 'group_activity_enabled',
                'metadata', jsonb_build_object(
                    'type', 'group_activity',
                    'group_id', NEW.group_id::text,
                    'group_name', group_name,
                    'activity_type', 'session_scheduled',
                    'session_id', NEW.id::text,
                    'session_title', NEW.title
                )
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_group_session_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    sender_name TEXT;
    conv_group_id UUID;
    recipient RECORD;
    body_preview TEXT;
BEGIN
    SELECT display_name INTO sender_name
    FROM profiles WHERE id = NEW.sender_id;
    IF sender_name IS NULL THEN
        sender_name := 'Someone';
    END IF;

    body_preview := LEFT(NEW.content, 100);

    SELECT group_id INTO conv_group_id
    FROM conversations
    WHERE id = NEW.conversation_id;

    FOR recipient IN
        SELECT cp.user_id
        FROM conversation_participants cp
        WHERE cp.conversation_id = NEW.conversation_id
          AND cp.user_id != NEW.sender_id
        UNION
        SELECT gm.user_id
        FROM group_members gm
        WHERE gm.group_id = conv_group_id
          AND conv_group_id IS NOT NULL
          AND gm.user_id != NEW.sender_id
    LOOP
        CONTINUE WHEN NOT public.should_send_notification(recipient.user_id, 'message');

        PERFORM net.http_post(
            url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
            body := jsonb_build_object(
                'recipient_user_id', recipient.user_id::text,
                'title', sender_name,
                'body', body_preview,
                'notification_type', 'message_enabled',
                'metadata', jsonb_build_object(
                    'type', 'message',
                    'conversation_id', NEW.conversation_id::text,
                    'sender_id', NEW.sender_id::text,
                    'sender_name', sender_name
                )
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_round_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    action_type TEXT;
    target_user_id TEXT;
    _service_role_key TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        target_user_id := NEW.user_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
        action_type := 'finished';
        target_user_id := NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        target_user_id := OLD.user_id;
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF target_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT decrypted_secret INTO _service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    IF _service_role_key IS NULL THEN
        RAISE WARNING 'notify_round_status_change: service_role_key not found in vault';
        RETURN COALESCE(NEW, OLD);
    END IF;

    PERFORM net.http_post(
        url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_role_key
        ),
        body := jsonb_build_object(
            'recipient_user_id', target_user_id,
            'silent', true,
            'metadata', jsonb_build_object(
                'type', 'round_status_change',
                'round_id', COALESCE(NEW.round_id, OLD.round_id),
                'action', action_type
            )
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."notify_round_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_scorecard_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    commenter_name TEXT;
    preview TEXT;
    target_user_id UUID;
BEGIN
    BEGIN
        target_user_id := NEW.player_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;

    IF NEW.user_id = target_user_id THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
        RETURN NEW;
    END IF;

    IF NOT public.should_send_notification(target_user_id, 'scorecard_reactions') THEN
        RETURN NEW;
    END IF;

    SELECT display_name INTO commenter_name
    FROM profiles WHERE id = NEW.user_id;
    IF commenter_name IS NULL THEN
        commenter_name := 'Someone';
    END IF;

    preview := LEFT(NEW.comment_text, 50);

    PERFORM net.http_post(
        url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
        body := jsonb_build_object(
            'recipient_user_id', NEW.player_id,
            'title', 'OnlyGolf',
            'body', commenter_name || ' commented: "' || preview || '"',
            'notification_type', 'scorecard_reactions_enabled',
            'metadata', jsonb_build_object(
                'type', 'scorecard_reaction',
                'reaction_type', 'comment',
                'round_id', NEW.game_id,
                'game_format', NEW.game_format,
                'reactor_name', commenter_name
            )
        )
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_scorecard_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_scorecard_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    liker_name TEXT;
    target_user_id UUID;
BEGIN
    BEGIN
        target_user_id := NEW.player_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;

    IF NEW.user_id = target_user_id THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
        RETURN NEW;
    END IF;

    IF NOT public.should_send_notification(target_user_id, 'scorecard_reactions') THEN
        RETURN NEW;
    END IF;

    SELECT display_name INTO liker_name
    FROM profiles WHERE id = NEW.user_id;
    IF liker_name IS NULL THEN
        liker_name := 'Someone';
    END IF;

    PERFORM net.http_post(
        url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
        body := jsonb_build_object(
            'recipient_user_id', NEW.player_id,
            'title', 'OnlyGolf',
            'body', liker_name || ' liked your scorecard',
            'notification_type', 'scorecard_reactions_enabled',
            'metadata', jsonb_build_object(
                'type', 'scorecard_reaction',
                'reaction_type', 'like',
                'round_id', NEW.game_id,
                'game_format', NEW.game_format,
                'reactor_name', liker_name
            )
        )
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_scorecard_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_attendance_reminder"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_session RECORD;
    v_group_name TEXT;
    v_session_time TEXT;
    v_member RECORD;
    v_body TEXT;
    v_tz TEXT;
BEGIN
    FOR v_session IN
        SELECT gs.*
        FROM public.group_sessions gs
        WHERE gs.status IN ('scheduled', 'open')
          AND gs.reminder_sent_at IS NULL
          AND gs.group_id IS NOT NULL
          AND gs.start_time BETWEEN (NOW() + INTERVAL '23.5 hours') AND (NOW() + INTERVAL '24.5 hours')
    LOOP
        v_tz := COALESCE(v_session.timezone, 'UTC');

        SELECT name INTO v_group_name
        FROM public.groups
        WHERE id = v_session.group_id;

        v_session_time := TO_CHAR(v_session.start_time AT TIME ZONE v_tz, 'HH24:MI');
        v_body := 'You haven''t responded to ' || v_session.title || ' tomorrow at ' || v_session_time;

        FOR v_member IN
            SELECT gm.user_id
            FROM public.group_members gm
            WHERE gm.group_id = v_session.group_id
              AND gm.user_id != v_session.created_by
              AND NOT EXISTS (
                  SELECT 1 FROM public.session_responses sr
                  WHERE sr.session_id = v_session.id
                    AND sr.user_id = gm.user_id
              )
        LOOP
            CONTINUE WHEN NOT public.should_send_notification(v_member.user_id, 'group_activity');

            INSERT INTO public.notifications (user_id, type, title, message, related_id, metadata)
            VALUES (
                v_member.user_id,
                'group_activity',
                COALESCE(v_group_name, 'Practice Session'),
                v_body,
                v_session.id,
                jsonb_build_object(
                    'sub_type', 'session_attendance_reminder',
                    'session_id', v_session.id::text,
                    'session_title', v_session.title,
                    'group_name', v_group_name
                )
            );

            PERFORM net.http_post(
                url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
                body := jsonb_build_object(
                    'recipient_user_id', v_member.user_id::text,
                    'title', COALESCE(v_group_name, 'Practice Session'),
                    'body', v_body,
                    'notification_type', 'group_activity_enabled',
                    'metadata', jsonb_build_object(
                        'type', 'group_activity',
                        'activity_type', 'session_attendance_reminder',
                        'session_id', v_session.id::text,
                        'session_title', v_session.title,
                        'group_name', v_group_name
                    )
                )
            );
        END LOOP;

        UPDATE public.group_sessions
        SET reminder_sent_at = NOW()
        WHERE id = v_session.id;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_session_attendance_reminder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_coach_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session RECORD;
  v_adder_name TEXT;
  v_body TEXT;
BEGIN
  SELECT gs.*, g.name AS group_name
  INTO v_session
  FROM public.group_sessions gs
  JOIN public.groups g ON g.id = gs.group_id
  WHERE gs.id = NEW.session_id;

  IF v_session IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.coach_user_id = v_session.created_by THEN
    RETURN NEW;
  END IF;

  IF NOT public.should_send_notification(NEW.coach_user_id, 'group_activity') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), 'A coach')
  INTO v_adder_name
  FROM public.profiles p
  WHERE p.id = v_session.created_by;

  v_body := COALESCE(v_adder_name, 'A coach') || ' added you to "' || v_session.title || '" in ' || COALESCE(v_session.group_name, 'a group');

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.coach_user_id,
    'session_coach',
    'Added to Session',
    v_body,
    NEW.session_id
  );

  PERFORM net.http_post(
    url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
    body := jsonb_build_object(
      'recipient_user_id', NEW.coach_user_id::text,
      'title', 'OnlyGolf',
      'body', v_body,
      'notification_type', 'group_activity_enabled',
      'metadata', jsonb_build_object(
        'type', 'session_coach',
        'session_id', NEW.session_id::text,
        'group_name', v_session.group_name
      )
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_session_coach_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_session RECORD;
    v_group_name TEXT;
    v_inviter_name TEXT;
    v_session_date TEXT;
    v_body TEXT;
    v_tz TEXT;
BEGIN
    SELECT gs.*, g.name AS group_name
    INTO v_session
    FROM public.group_sessions gs
    LEFT JOIN public.groups g ON g.id = gs.group_id
    WHERE gs.id = NEW.session_id;

    IF v_session IS NULL THEN
        RETURN NEW;
    END IF;

    IF NOT public.should_send_notification(NEW.invited_user_id, 'group_activity') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(display_name, username, 'A coach')
    INTO v_inviter_name
    FROM public.profiles
    WHERE id = NEW.invited_by;

    v_tz := COALESCE(v_session.timezone, 'UTC');
    v_session_date := TO_CHAR(v_session.start_time AT TIME ZONE v_tz, 'Mon DD "at" HH24:MI');
    v_body := v_inviter_name || ' invited you to ' || v_session.title || ' on ' || v_session_date;

    -- Bell notification
    INSERT INTO public.notifications (user_id, type, title, message, related_id, metadata)
    VALUES (
        NEW.invited_user_id,
        'group_activity',
        COALESCE(v_session.group_name, 'Practice Session'),
        v_body,
        NEW.session_id,
        jsonb_build_object(
            'sub_type', 'session_invite',
            'session_id', NEW.session_id::text,
            'session_title', v_session.title,
            'group_name', v_session.group_name,
            'inviter_name', v_inviter_name
        )
    );

    -- Push notification
    PERFORM net.http_post(
        url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
        body := jsonb_build_object(
            'recipient_user_id', NEW.invited_user_id::text,
            'title', COALESCE(v_session.group_name, 'Practice Session'),
            'body', v_body,
            'notification_type', 'group_activity_enabled',
            'metadata', jsonb_build_object(
                'type', 'group_activity',
                'activity_type', 'session_invite',
                'session_id', NEW.session_id::text,
                'session_title', v_session.title,
                'group_name', v_session.group_name,
                'inviter_name', v_inviter_name
            )
        )
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_session_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_session_starting_soon"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_session RECORD;
    v_group_name TEXT;
    v_body TEXT;
    v_responder RECORD;
BEGIN
    FOR v_session IN
        SELECT gs.*
        FROM public.group_sessions gs
        WHERE gs.status IN ('scheduled', 'open')
          AND gs.start_reminder_sent_at IS NULL
          AND gs.group_id IS NOT NULL
          AND gs.start_time BETWEEN (NOW() + INTERVAL '25 minutes') AND (NOW() + INTERVAL '35 minutes')
    LOOP
        SELECT name INTO v_group_name
        FROM public.groups
        WHERE id = v_session.group_id;

        v_body := v_session.title || ' starts in 30 minutes';

        FOR v_responder IN
            SELECT sr.user_id
            FROM public.session_responses sr
            WHERE sr.session_id = v_session.id
              AND sr.response_status = 'going'
        LOOP
            CONTINUE WHEN NOT public.should_send_notification(v_responder.user_id, 'group_activity');

            INSERT INTO public.notifications (user_id, type, title, message, related_id, metadata)
            VALUES (
                v_responder.user_id,
                'group_activity',
                COALESCE(v_group_name, 'Practice Session'),
                v_body,
                v_session.id,
                jsonb_build_object(
                    'sub_type', 'session_starting_soon',
                    'session_id', v_session.id::text,
                    'session_title', v_session.title,
                    'group_name', v_group_name
                )
            );

            PERFORM net.http_post(
                url := 'https://rwvrzypgokxbznqjtinn.supabase.co/functions/v1/send-notification',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer REDACTED_SERVICE_ROLE_KEY_set_via_db_setting"}'::jsonb,
                body := jsonb_build_object(
                    'recipient_user_id', v_responder.user_id::text,
                    'title', COALESCE(v_group_name, 'Practice Session'),
                    'body', v_body,
                    'notification_type', 'group_activity_enabled',
                    'metadata', jsonb_build_object(
                        'type', 'group_activity',
                        'activity_type', 'session_starting_soon',
                        'session_id', v_session.id::text,
                        'session_title', v_session.title,
                        'group_name', v_group_name
                    )
                )
            );
        END LOOP;

        UPDATE public.group_sessions
        SET start_reminder_sent_at = NOW()
        WHERE id = v_session.id;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_session_starting_soon"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_friendship_pair"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.requester IS NOT NULL AND NEW.addressee IS NOT NULL THEN
    NEW.user_a := LEAST(NEW.requester, NEW.addressee);
    NEW.user_b := GREATEST(NEW.requester, NEW.addressee);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."populate_friendship_pair"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."putting_score_average"("p_user_id" "uuid") RETURNS TABLE("avg_score" numeric, "total_drills" integer, "last_10_avg" numeric, "best_score" numeric, "trend" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH putting_results AS (
    SELECT dr.normalized_score, dr.created_at,
           ROW_NUMBER() OVER (ORDER BY dr.created_at DESC) as rn
    FROM public.drill_results dr
    JOIN public.drills d ON d.id = dr.drill_id
    WHERE dr.user_id = p_user_id
      AND dr.normalized_score IS NOT NULL
      AND d.shot_area = 'putting'
  )
  SELECT
    ROUND(AVG(normalized_score) / 10.0, 1) as avg_score,
    COUNT(*)::integer as total_drills,
    ROUND(AVG(CASE WHEN rn <= 10 THEN normalized_score END) / 10.0, 1) as last_10_avg,
    ROUND(MIN(normalized_score) / 10.0, 1) as best_score,
    ROUND(
      (AVG(CASE WHEN rn <= 5 THEN normalized_score END) -
       AVG(CASE WHEN rn BETWEEN 6 AND 10 THEN normalized_score END)) / 10.0,
      1
    ) as trend
  FROM putting_results;
$$;


ALTER FUNCTION "public"."putting_score_average"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebuild_round_scorecard_snapshot"("p_round_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_holes_played INTEGER;
  v_snapshot JSONB;
  v_players JSONB := '[]'::jsonb;
  v_player_data JSONB;
  v_scores JSONB;
  v_total INTEGER;
  v_thru INTEGER := 0;
  v_player_record RECORD;
  v_holes_array JSONB := '[]'::jsonb;
BEGIN
  -- Get holes_played for the round
  SELECT holes_played INTO v_holes_played
  FROM rounds
  WHERE id = p_round_id;
  
  IF v_holes_played IS NULL THEN
    RETURN;
  END IF;
  
  -- Build players array with their scores
  FOR v_player_record IN
    SELECT 
      rp.id as player_id,
      rp.user_id,
      rp.guest_name,
      rp.is_guest,
      COALESCE(p.display_name, p.username, rp.guest_name, 'Player') as display_name
    FROM round_players rp
    LEFT JOIN profiles p ON p.id = rp.user_id
    WHERE rp.round_id = p_round_id
    ORDER BY rp.created_at
  LOOP
    -- Build scores array for this player (1-18, nulls allowed)
    v_scores := '[]'::jsonb;
    v_total := 0;
    v_thru := 0;
    
    -- Initialize array with nulls for all holes
    FOR i IN 1..v_holes_played LOOP
      v_scores := v_scores || jsonb_build_array(NULL);
    END LOOP;
    
    -- Fill in actual scores
    FOR i IN 1..v_holes_played LOOP
      SELECT score INTO v_total
      FROM holes
      WHERE round_id = p_round_id
        AND hole_number = i
        AND player_id = v_player_record.player_id
      LIMIT 1;
      
      IF v_total IS NOT NULL AND v_total > 0 THEN
        v_scores := jsonb_set(v_scores, ARRAY[i-1]::text[], to_jsonb(v_total));
        v_thru := i;
      END IF;
    END LOOP;
    
    -- Calculate total score
    SELECT COALESCE(SUM(score), 0) INTO v_total
    FROM holes
    WHERE round_id = p_round_id
      AND player_id = v_player_record.player_id
      AND score > 0;
    
    -- Build player object
    v_player_data := jsonb_build_object(
      'user_id', v_player_record.user_id,
      'player_id', v_player_record.player_id,
      'display_name', v_player_record.display_name,
      'guest_name', v_player_record.guest_name,
      'is_guest', COALESCE(v_player_record.is_guest, false),
      'scores', v_scores,
      'total', COALESCE(v_total, 0)
    );
    
    v_players := v_players || v_player_data;
  END LOOP;
  
  -- If no round_players exist, check for single-player round (holes without player_id)
  IF jsonb_array_length(v_players) = 0 THEN
    -- Check if there are any holes for this round
    SELECT COUNT(*) INTO v_total
    FROM holes
    WHERE round_id = p_round_id
    LIMIT 1;
    
    IF v_total > 0 THEN
      -- Single player round - get owner info
      SELECT 
        r.user_id,
        COALESCE(p.display_name, p.username, 'Player') as display_name
      INTO v_player_record
      FROM rounds r
      LEFT JOIN profiles p ON p.id = r.user_id
      WHERE r.id = p_round_id;
      
      -- Build scores array
      v_scores := '[]'::jsonb;
      v_total := 0;
      v_thru := 0;
      
      FOR i IN 1..v_holes_played LOOP
        v_scores := v_scores || jsonb_build_array(NULL);
      END LOOP;
      
      FOR i IN 1..v_holes_played LOOP
        SELECT score INTO v_total
        FROM holes
        WHERE round_id = p_round_id
          AND hole_number = i
          AND player_id IS NULL
        LIMIT 1;
        
        IF v_total IS NOT NULL AND v_total > 0 THEN
          v_scores := jsonb_set(v_scores, ARRAY[i-1]::text[], to_jsonb(v_total));
          v_thru := i;
        END IF;
      END LOOP;
      
      SELECT COALESCE(SUM(score), 0) INTO v_total
      FROM holes
      WHERE round_id = p_round_id
        AND player_id IS NULL
        AND score > 0;
      
      v_player_data := jsonb_build_object(
        'user_id', v_player_record.user_id,
        'player_id', NULL,
        'display_name', v_player_record.display_name,
        'guest_name', NULL,
        'is_guest', false,
        'scores', v_scores,
        'total', COALESCE(v_total, 0)
      );
      
      v_players := jsonb_build_array(v_player_data);
    END IF;
  END IF;
  
  -- Calculate thru (highest hole number with a score across all players)
  SELECT COALESCE(MAX(hole_number), 0) INTO v_thru
  FROM holes
  WHERE round_id = p_round_id
    AND score > 0;
  
  -- Build holes array [1..18]
  v_holes_array := '[]'::jsonb;
  FOR i IN 1..v_holes_played LOOP
    v_holes_array := v_holes_array || to_jsonb(i);
  END LOOP;
  
  -- Build final snapshot
  v_snapshot := jsonb_build_object(
    'holes', v_holes_array,
    'players', v_players,
    'thru', v_thru,
    'updated_at', NOW()
  );
  
  -- Update the round with the snapshot
  UPDATE rounds
  SET scorecard_snapshot = v_snapshot
  WHERE id = p_round_id;
END;
$$;


ALTER FUNCTION "public"."rebuild_round_scorecard_snapshot"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_friendship"("other_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF other_user_id IS NULL OR other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid target' USING ERRCODE = '22023';
  END IF;

  -- Delete friendships in both directions, regardless of status (covers
  -- accepted friendships AND pending requests we want to cancel).
  WITH deleted AS (
    DELETE FROM public.friendships
    WHERE (requester = v_me AND addressee = other_user_id)
       OR (requester = other_user_id AND addressee = v_me)
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM deleted;

  -- friends_pairs is a VIEW derived from friendships, so removing the
  -- friendships row(s) automatically updates the view. Nothing extra to
  -- delete there.

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."remove_friendship"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."round_has_scores"("p_round_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.holes WHERE round_id = p_round_id LIMIT 1);
$$;


ALTER FUNCTION "public"."round_has_scores"("p_round_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_profiles"("q" "text", "max_results" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "country" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.username,
    COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''),
             NULLIF(split_part(COALESCE(p.email, ''), '@', 1), '')) AS display_name,
    p.avatar_url,
    p.country
  FROM public.profiles p
  WHERE
    auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(trim(COALESCE(q, ''))) >= 3
    AND NOT public.is_blocked_either_way(p.id)
    AND (
      COALESCE(p.username, '') ILIKE '%' || q || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || q || '%'
      OR COALESCE(p.email, '') ILIKE '%' || q || '%'
    )
  ORDER BY
    CASE
      WHEN COALESCE(p.username, '') ILIKE q || '%' THEN 0
      WHEN COALESCE(p.display_name, '') ILIKE q || '%' THEN 1
      WHEN COALESCE(p.email, '') ILIKE q || '%' THEN 2
      ELSE 3
    END,
    p.created_at DESC NULLS LAST
  LIMIT least(COALESCE(max_results, 10), 25);
$$;


ALTER FUNCTION "public"."search_profiles"("q" "text", "max_results" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_send_notification"("_user_id" "uuid", "_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  prefs RECORD;
  v_current_time TIME;
  in_quiet_hours BOOLEAN := false;
BEGIN
  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = _user_id;

  IF prefs IS NULL THEN
    RETURN true;
  END IF;

  IF NOT prefs.enabled THEN
    RETURN false;
  END IF;

  IF prefs.quiet_hours_enabled
     AND prefs.quiet_hours_start IS NOT NULL
     AND prefs.quiet_hours_end IS NOT NULL
  THEN
    v_current_time := CURRENT_TIME;
    IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
      in_quiet_hours := v_current_time >= prefs.quiet_hours_start
                     OR v_current_time <= prefs.quiet_hours_end;
    ELSE
      in_quiet_hours := v_current_time >= prefs.quiet_hours_start
                    AND v_current_time <= prefs.quiet_hours_end;
    END IF;
    IF in_quiet_hours THEN
      RETURN false;
    END IF;
  END IF;

  RETURN CASE _type
    WHEN 'friend_request'        THEN prefs.friend_request_enabled
    WHEN 'friend_started_round'  THEN prefs.friend_started_round_enabled
    WHEN 'friend_finished_round' THEN prefs.round_completed_enabled
    WHEN 'round_completed'       THEN prefs.round_completed_enabled
    WHEN 'group_invite'          THEN prefs.group_invite_enabled
    WHEN 'high_score'            THEN prefs.high_score_enabled
    WHEN 'message'               THEN prefs.message_enabled
    WHEN 'achievement_unlocked'  THEN prefs.achievement_unlocked_enabled
    WHEN 'group_activity'        THEN prefs.group_activity_enabled
    WHEN 'scorecard_reactions'   THEN prefs.scorecard_reactions_enabled
    WHEN 'session_coach'         THEN true
    WHEN 'session_invite'        THEN true
    ELSE true
  END;
END;
$$;


ALTER FUNCTION "public"."should_send_notification"("_user_id" "uuid", "_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_tournament_round_point_config"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    SELECT jsonb_build_object(
        'position_points', position_points,
        'bonus_categories', bonus_categories
    )
    INTO NEW.point_config_snapshot
    FROM public.tournament_point_config
    WHERE tournament_id = NEW.tournament_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."snapshot_tournament_round_point_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_coach_feedback"("p_drill_id" "uuid", "p_vote" smallint, "p_reason_tag" "text" DEFAULT NULL::"text", "p_comment" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_old_vote smallint;
BEGIN
  -- Check if user already voted
  SELECT vote INTO v_old_vote
    FROM public.coach_ai_feedback
   WHERE user_id = v_user_id AND drill_id = p_drill_id;

  IF v_old_vote IS NOT NULL THEN
    -- Reverse old vote
    IF v_old_vote = 1 THEN
      UPDATE public.coach_drills SET upvotes = GREATEST(upvotes - 1, 0)
       WHERE id = p_drill_id;
    ELSE
      UPDATE public.coach_drills SET downvotes = GREATEST(downvotes - 1, 0)
       WHERE id = p_drill_id;
    END IF;

    -- Update the feedback row
    UPDATE public.coach_ai_feedback
       SET vote = p_vote,
           reason_tag = p_reason_tag,
           comment = p_comment,
           created_at = now()
     WHERE user_id = v_user_id AND drill_id = p_drill_id;
  ELSE
    -- Insert new feedback
    INSERT INTO public.coach_ai_feedback (user_id, drill_id, vote, reason_tag, comment)
    VALUES (v_user_id, p_drill_id, p_vote, p_reason_tag, p_comment);
  END IF;

  -- Apply new vote
  IF p_vote = 1 THEN
    UPDATE public.coach_drills SET upvotes = upvotes + 1
     WHERE id = p_drill_id;
  ELSE
    UPDATE public.coach_drills SET downvotes = downvotes + 1
     WHERE id = p_drill_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."submit_coach_feedback"("p_drill_id" "uuid", "p_vote" smallint, "p_reason_tag" "text", "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suggested_friends"() RETURNS TABLE("id" "uuid", "username" "text", "display_name" "text", "avatar_url" "text", "handicap" "text", "home_club" "text", "country" "text", "reason" "text", "priority" integer, "mutual_friend_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE v_me uuid := auth.uid(); v_my_club text; BEGIN IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF; SELECT p.home_club INTO v_my_club FROM public.profiles p WHERE p.id = v_me; RETURN QUERY WITH my_friends AS (SELECT CASE WHEN fp.a = v_me THEN fp.b ELSE fp.a END AS friend_id FROM public.friends_pairs fp WHERE fp.a = v_me OR fp.b = v_me), exclude_ids AS (SELECT v_me AS uid UNION SELECT friend_id FROM my_friends UNION SELECT CASE WHEN f.requester = v_me THEN f.addressee ELSE f.requester END FROM public.friendships f WHERE (f.requester = v_me OR f.addressee = v_me) AND f.status::text = 'pending' UNION SELECT b.blocked_id FROM public.blocks b WHERE b.blocker_id = v_me UNION SELECT b.blocker_id FROM public.blocks b WHERE b.blocked_id = v_me), mutuals AS (SELECT CASE WHEN fp.a IN (SELECT friend_id FROM my_friends) THEN fp.b ELSE fp.a END AS candidate_id, COUNT(*) AS mutual_count FROM public.friends_pairs fp WHERE (fp.a IN (SELECT friend_id FROM my_friends) OR fp.b IN (SELECT friend_id FROM my_friends)) AND (CASE WHEN fp.a IN (SELECT friend_id FROM my_friends) THEN fp.b ELSE fp.a END) NOT IN (SELECT uid FROM exclude_ids) GROUP BY candidate_id ORDER BY mutual_count DESC, candidate_id ASC LIMIT 3), branch1 AS (SELECT m.candidate_id AS uid, CASE WHEN m.mutual_count = 1 THEN '1 mutual friend' ELSE m.mutual_count::text || ' mutual friends' END AS reason, 0 AS priority, m.mutual_count::int AS mutual_friend_count FROM mutuals m), my_groups AS (SELECT g.id, g.name, g.created_at FROM public.groups g JOIN public.group_members gm ON gm.group_id = g.id WHERE gm.user_id = v_me), branch2_raw AS (SELECT gm.user_id AS uid, mg.name AS group_name, mg.created_at AS group_created_at, ROW_NUMBER() OVER (PARTITION BY gm.user_id ORDER BY mg.created_at ASC, mg.id ASC) AS rn FROM public.group_members gm JOIN my_groups mg ON mg.id = gm.group_id WHERE gm.user_id NOT IN (SELECT uid FROM exclude_ids) AND gm.user_id NOT IN (SELECT uid FROM branch1)), branch2 AS (SELECT br.uid, 'In your group: ' || br.group_name AS reason, 1 AS priority, 0 AS mutual_friend_count FROM branch2_raw br WHERE br.rn = 1), branch3_pool AS (SELECT p.id AS uid FROM public.profiles p WHERE v_my_club IS NOT NULL AND v_my_club <> '' AND p.home_club = v_my_club AND p.id NOT IN (SELECT uid FROM exclude_ids) AND p.id NOT IN (SELECT uid FROM branch1) AND p.id NOT IN (SELECT uid FROM branch2) ORDER BY p.id ASC LIMIT 20), branch3 AS (SELECT bp.uid, 'Also plays at ' || v_my_club AS reason, 2 AS priority, 0 AS mutual_friend_count FROM branch3_pool bp), unioned AS (SELECT * FROM branch1 UNION ALL SELECT * FROM branch2 UNION ALL SELECT * FROM branch3) SELECT p.id, p.username, p.display_name, p.avatar_url, p.handicap::text, p.home_club, p.country, u.reason, u.priority, u.mutual_friend_count FROM unioned u JOIN public.profiles p ON p.id = u.uid ORDER BY u.priority ASC, u.mutual_friend_count DESC, u.uid ASC LIMIT 3; END; $$;


ALTER FUNCTION "public"."suggested_friends"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."top3_favourite_group_for_drill"("p_drill" "uuid") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  with fav as (
    select favourite_group_id from public.user_settings where user_id = auth.uid()
  ),
  members as (
    select gm.user_id
    from public.group_members gm, fav
    where gm.group_id = fav.favourite_group_id
  ),
  best as (
    select dr.user_id, max(dr.total_points) as best_score
    from public.drill_results dr
    where dr.drill_id = p_drill
      and dr.user_id in (select user_id from members)
    group by dr.user_id
  )
  select b.user_id, p.display_name, p.username, b.best_score
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.best_score desc, p.username asc
  limit 3;
$$;


ALTER FUNCTION "public"."top3_favourite_group_for_drill"("p_drill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."top3_favourite_group_for_drill_by_title"("p_drill_title" "text") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) as lower_is_better 
    FROM public.drills 
    WHERE title = p_drill_title 
    LIMIT 1
  ),
  fav AS (
    SELECT favourite_group_id FROM public.user_settings WHERE user_id = auth.uid()
  ),
  members AS (
    SELECT gm.user_id
    FROM public.group_members gm, fav
    WHERE gm.group_id = fav.favourite_group_id
  ),
  best AS (
    SELECT 
      dr.user_id, 
      CASE 
        WHEN drill_info.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END as best_score
    FROM public.drill_results dr, drill_info
    WHERE dr.drill_id = drill_info.id
      AND dr.user_id IN (SELECT user_id FROM members)
    GROUP BY dr.user_id, drill_info.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN drill_info
  ORDER BY 
    CASE WHEN drill_info.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT drill_info.lower_is_better THEN b.best_score END DESC,
    p.username ASC
  LIMIT 3;
$$;


ALTER FUNCTION "public"."top3_favourite_group_for_drill_by_title"("p_drill_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."top3_friends_for_drill"("p_drill" "uuid") RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  with my_friends as (
    select case when fp.a = auth.uid() then fp.b else fp.a end as friend_id
    from public.friends_pairs fp
    where fp.a = auth.uid() or fp.b = auth.uid()
  ),
  best as (
    select dr.user_id, max(dr.total_points) as best_score
    from public.drill_results dr
    where dr.drill_id = p_drill
      and dr.user_id in (select friend_id from my_friends)
    group by dr.user_id
  )
  select b.user_id, p.display_name, p.username, b.best_score
  from best b
  join public.profiles p on p.id = b.user_id
  order by b.best_score desc, p.username asc
  limit 3;
$$;


ALTER FUNCTION "public"."top3_friends_for_drill"("p_drill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."top3_friends_for_drill_by_title"("p_drill_titles" "text"[]) RETURNS TABLE("user_id" "uuid", "display_name" "text", "username" "text", "best_score" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH drill_info AS (
    SELECT id, COALESCE(lower_is_better, false) AS lower_is_better
    FROM public.drills
    WHERE title = ANY(p_drill_titles)
  ),
  my_friends AS (
    SELECT CASE WHEN fp.a = auth.uid() THEN fp.b ELSE fp.a END AS friend_id
    FROM public.friends_pairs fp
    WHERE fp.a = auth.uid() OR fp.b = auth.uid()
  ),
  direction AS (
    SELECT bool_or(lower_is_better) AS lower_is_better FROM drill_info
  ),
  best AS (
    SELECT
      dr.user_id,
      CASE
        WHEN direction.lower_is_better THEN MIN(dr.total_points)
        ELSE MAX(dr.total_points)
      END AS best_score
    FROM public.drill_results dr
    CROSS JOIN direction
    WHERE dr.drill_id IN (SELECT id FROM drill_info)
      AND dr.user_id IN (SELECT friend_id FROM my_friends)
    GROUP BY dr.user_id, direction.lower_is_better
  )
  SELECT b.user_id, p.display_name, p.username, b.best_score
  FROM best b
  JOIN public.profiles p ON p.id = b.user_id
  CROSS JOIN direction
  ORDER BY
    CASE WHEN direction.lower_is_better THEN b.best_score END ASC,
    CASE WHEN NOT direction.lower_is_better THEN b.best_score END DESC,
    p.username ASC
  LIMIT 3;
$$;


ALTER FUNCTION "public"."top3_friends_for_drill_by_title"("p_drill_titles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tournament_contests_touch_edited"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.distance IS DISTINCT FROM OLD.distance THEN
        NEW.edited_at = now();
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tournament_contests_touch_edited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_coach_drill_completed"("p_drill_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.coach_drills
     SET completion_count = completion_count + 1
   WHERE id = p_drill_id;
END;
$$;


ALTER FUNCTION "public"."track_coach_drill_completed"("p_drill_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_coach_drill_used"("p_drill_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.coach_drills
     SET times_used = times_used + 1,
         last_used_at = now()
   WHERE id = p_drill_id;
END;
$$;


ALTER FUNCTION "public"."track_coach_drill_used"("p_drill_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_rebuild_scorecard_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_round_id uuid;
BEGIN
  -- Get round_id from the affected row
  IF TG_OP = 'DELETE' THEN
    v_round_id := OLD.round_id;
  ELSE
    v_round_id := NEW.round_id;
  END IF;
  
  -- Only rebuild if round_id is valid
  IF v_round_id IS NOT NULL THEN
    -- Rebuild snapshot for this round (with error handling)
    BEGIN
      PERFORM public.rebuild_round_scorecard_snapshot(v_round_id);
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Failed to rebuild snapshot for round %: %', v_round_id, SQLERRM;
    END;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trigger_rebuild_scorecard_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."umbriago_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_idx int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select (i - 1)::int into v_idx
  from umbriago_games g, jsonb_array_elements(g.players) with ordinality as e(p, i)
  where g.id = p_game_id and lower(p->>'id') = lower(v_uid::text);

  if v_idx is null then return; end if;

  update umbriago_games
  set players = jsonb_set(
        jsonb_set(players, array[v_idx::text, 'track_basic_stats'], to_jsonb(p_track_basic), true),
        array[v_idx::text, 'track_strokes_gained'], to_jsonb(p_track_sg), true
      ),
      stats_mode = p_stats_mode
  where id = p_game_id;
end;
$$;


ALTER FUNCTION "public"."umbriago_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unblock_user"("other_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.blocks
  WHERE blocker_id = v_me AND blocked_id = other_user_id;
END;
$$;


ALTER FUNCTION "public"."unblock_user"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_battle_participant_on_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_level_ids uuid[];
    v_completed_count int;
    v_total_levels int;
    v_existing_winner uuid;
begin
    select level_ids, winner_user_id
      into v_level_ids, v_existing_winner
      from public.map_battles
     where id = NEW.battle_id;

    v_total_levels := coalesce(array_length(v_level_ids, 1), 0);

    select count(distinct level_id)::int
      into v_completed_count
      from public.map_battle_progress
     where battle_id = NEW.battle_id
       and user_id = NEW.user_id;

    update public.map_battle_participants
       set current_level = least(v_completed_count + 1, v_total_levels + 1),
           finished_at = case
               when v_completed_count >= v_total_levels and v_total_levels > 0 then now()
               else finished_at
           end
     where battle_id = NEW.battle_id
       and user_id = NEW.user_id;

    -- First-to-finish wins. We don't auto-end the battle here so
    -- stragglers can still complete (per spec).
    if v_existing_winner is null
       and v_completed_count >= v_total_levels
       and v_total_levels > 0 then
        update public.map_battles
           set winner_user_id = NEW.user_id
         where id = NEW.battle_id
           and winner_user_id is null;
    end if;

    return NEW;
end;
$$;


ALTER FUNCTION "public"."update_battle_participant_on_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
                            BEGIN
                              NEW.updated_at = NOW();
                                RETURN NEW;
                                END;
                                $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_high_score_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_related_id" "uuid", "p_related_user_id" "uuid", "p_context_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Try to update existing notification first
  UPDATE public.notifications
  SET 
    message = p_message,
    title = p_title,
    is_read = false,
    created_at = now()
  WHERE user_id = p_user_id
    AND type = 'high_score'
    AND related_id = p_related_id
    AND related_user_id = p_related_user_id
    AND COALESCE(context_id, '00000000-0000-0000-0000-000000000000') = COALESCE(p_context_id, '00000000-0000-0000-0000-000000000000');
  
  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_user_id, context_id, is_read, created_at)
    VALUES (p_user_id, 'high_score', p_title, p_message, p_related_id, p_related_user_id, p_context_id, false, now());
  END IF;
END;
$$;


ALTER FUNCTION "public"."upsert_high_score_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_related_id" "uuid", "p_related_user_id" "uuid", "p_context_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_debug_round_status_deletes" (
    "id" bigint NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"(),
    "deleted_row_user_id" "uuid",
    "deleted_row_round_id" "text",
    "auth_uid" "uuid",
    "db_role" "text",
    "application_name" "text",
    "client_addr" "text",
    "current_query" "text",
    "backend_start" timestamp with time zone
);


ALTER TABLE "public"."_debug_round_status_deletes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."_debug_round_status_deletes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."_debug_round_status_deletes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."_debug_round_status_deletes_id_seq" OWNED BY "public"."_debug_round_status_deletes"."id";



CREATE TABLE IF NOT EXISTS "public"."activity_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'friends'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banker_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "course_id" "uuid",
    "game_name" "text",
    "status" "text" DEFAULT 'setup'::"text",
    "num_holes" integer DEFAULT 18,
    "min_amount" integer DEFAULT 1,
    "max_amount" integer DEFAULT 5,
    "has_max_amount" boolean DEFAULT true,
    "presses_enabled" boolean DEFAULT true,
    "current_hole" integer DEFAULT 1,
    "banker_order" "text"[],
    "current_banker_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "stats_mode" "text" DEFAULT 'none'::"text",
    "course_name" "text",
    "date_played" timestamp with time zone DEFAULT "now"(),
    "event_id" "uuid",
    "group_id" "uuid",
    "is_private" boolean DEFAULT false NOT NULL,
    "use_handicaps" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."banker_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banker_hole_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "hole_number" integer,
    "player_id" "uuid",
    "strokes" integer,
    "bet_amount" integer,
    "pressed" boolean DEFAULT false,
    "banker_pressed" boolean DEFAULT false,
    "net_result" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_order" integer DEFAULT 0,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text"
);


ALTER TABLE "public"."banker_hole_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banker_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "hole_number" integer,
    "banker_player_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."banker_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banker_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "player_id" "uuid",
    "guest_name" "text",
    "tee_set" "text" DEFAULT 'white'::"text",
    "player_order" integer DEFAULT 0,
    "running_total" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "track_basic_stats" boolean DEFAULT false
);


ALTER TABLE "public"."banker_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "course_name" "text" NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "holes_played" integer DEFAULT 18 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "game_type" "text" DEFAULT 'stroke'::"text" NOT NULL,
    "use_handicaps" boolean DEFAULT false NOT NULL,
    "match_status" integer DEFAULT 0 NOT NULL,
    "holes_remaining" integer DEFAULT 18 NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "winner_team" "text",
    "final_result" "text",
    "round_name" "text",
    "mulligans_per_player" integer DEFAULT 0,
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "is_private" boolean DEFAULT false NOT NULL,
    "teams" "jsonb",
    "team_a_name" "text" DEFAULT 'Team A'::"text" NOT NULL,
    "team_a_players" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_b_name" "text" DEFAULT 'Team B'::"text" NOT NULL,
    "team_b_players" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_a_total" integer DEFAULT 0 NOT NULL,
    "team_b_total" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "best_ball_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."best_ball_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hole_result" integer DEFAULT 0 NOT NULL,
    "match_status_after" integer DEFAULT 0 NOT NULL,
    "holes_remaining_after" integer DEFAULT 17 NOT NULL,
    "group_number" integer DEFAULT 1,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid",
    "team_results" "jsonb",
    "team_a_scores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_b_scores" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_a_best_gross" integer,
    "team_a_best_net" integer,
    "team_a_counting_player" "text",
    "team_b_best_gross" integer,
    "team_b_best_net" integer,
    "team_b_counting_player" "text",
    "team_a_running_total" integer DEFAULT 0 NOT NULL,
    "team_b_running_total" integer DEFAULT 0 NOT NULL,
    "match_statuses" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."best_ball_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_taliban_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "course_id" "uuid",
    "course_name" "text",
    "date_played" "date",
    "holes_played" integer DEFAULT 18,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "game_type" "text" DEFAULT 'best_ball_taliban'::"text",
    "team_a_name" "text",
    "team_a_players" "jsonb" DEFAULT '[]'::"jsonb",
    "team_b_name" "text",
    "team_b_players" "jsonb" DEFAULT '[]'::"jsonb",
    "use_handicaps" boolean DEFAULT false,
    "team_a_total" integer DEFAULT 0,
    "team_b_total" integer DEFAULT 0,
    "match_status" integer DEFAULT 0,
    "holes_remaining" integer DEFAULT 18,
    "is_finished" boolean DEFAULT false,
    "winner_team" "text",
    "final_result" "text",
    "round_name" "text",
    "mulligans_per_player" integer DEFAULT 0,
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "is_private" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."best_ball_taliban_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_taliban_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "hole_number" integer NOT NULL,
    "par" integer DEFAULT 4,
    "stroke_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_a_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "team_b_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "team_a_best_gross" integer,
    "team_a_best_net" integer,
    "team_a_counting_player" "text",
    "team_b_best_gross" integer,
    "team_b_best_net" integer,
    "team_b_counting_player" "text",
    "team_a_running_total" integer DEFAULT 0,
    "team_b_running_total" integer DEFAULT 0,
    "hole_result" integer DEFAULT 0,
    "match_status_after" integer DEFAULT 0,
    "holes_remaining_after" integer DEFAULT 18,
    "group_number" integer DEFAULT 1,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."best_ball_taliban_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_worst_ball_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "course_id" "uuid",
    "course_name" "text",
    "team_a_players" "uuid"[] DEFAULT '{}'::"uuid"[],
    "team_b_players" "uuid"[] DEFAULT '{}'::"uuid"[],
    "team_a_name" "text" DEFAULT 'Team A'::"text",
    "team_b_name" "text" DEFAULT 'Team B'::"text",
    "match_status" integer DEFAULT 0,
    "current_hole" integer DEFAULT 1,
    "is_complete" boolean DEFAULT false,
    "is_finished" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_private" boolean DEFAULT false NOT NULL,
    "stats_mode" "text" DEFAULT 'none'::"text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "team_a_players_v2" "jsonb" DEFAULT '[]'::"jsonb",
    "team_b_players_v2" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "best_ball_worst_ball_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."best_ball_worst_ball_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."best_ball_worst_ball_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "hole_number" integer NOT NULL,
    "player_id" "uuid",
    "score" integer,
    "par" integer,
    "stroke_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text"
);


ALTER TABLE "public"."best_ball_worst_ball_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocks_check" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_ai_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "drill_id" "uuid" NOT NULL,
    "vote" smallint NOT NULL,
    "reason_tag" "text",
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_ai_feedback_vote_check" CHECK (("vote" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."coach_ai_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_drill_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" NOT NULL,
    CONSTRAINT "coach_drill_generations_kind_check" CHECK (("kind" = ANY (ARRAY['generate'::"text", 'remix'::"text", 'refine'::"text", 'create_level'::"text", 'format_drill'::"text"])))
);


ALTER TABLE "public"."coach_drill_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_drills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "goal" "text",
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "focus_area" "text",
    "difficulty" "text",
    "goal_tags" "text"[] DEFAULT '{}'::"text"[],
    "upvotes" integer DEFAULT 0 NOT NULL,
    "downvotes" integer DEFAULT 0 NOT NULL,
    "times_used" integer DEFAULT 0 NOT NULL,
    "completion_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "shared_by_user_id" "uuid"
);


ALTER TABLE "public"."coach_drills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    CONSTRAINT "conversations_type_check" CHECK (("type" = ANY (ARRAY['friend'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."copenhagen_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "course_id" "uuid",
    "tee_set" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1" "text" NOT NULL,
    "player_2" "text" NOT NULL,
    "player_3" "text" NOT NULL,
    "player_1_handicap" numeric,
    "player_2_handicap" numeric,
    "player_3_handicap" numeric,
    "player_1_tee" "text",
    "player_2_tee" "text",
    "player_3_tee" "text",
    "use_handicaps" boolean DEFAULT false NOT NULL,
    "stake_per_point" numeric DEFAULT 1 NOT NULL,
    "player_1_total_points" integer DEFAULT 0 NOT NULL,
    "player_2_total_points" integer DEFAULT 0 NOT NULL,
    "player_3_total_points" integer DEFAULT 0 NOT NULL,
    "presses" "jsonb" DEFAULT '[]'::"jsonb",
    "is_finished" boolean DEFAULT false NOT NULL,
    "winner_player" "text",
    "round_name" "text",
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "players" "jsonb" DEFAULT '[]'::"jsonb",
    "rolls_per_player" integer DEFAULT 0,
    "roll_history" "jsonb" DEFAULT '[]'::"jsonb",
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "copenhagen_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."copenhagen_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."copenhagen_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1_gross_score" integer,
    "player_2_gross_score" integer,
    "player_3_gross_score" integer,
    "player_1_net_score" integer,
    "player_2_net_score" integer,
    "player_3_net_score" integer,
    "player_1_hole_points" integer DEFAULT 0 NOT NULL,
    "player_2_hole_points" integer DEFAULT 0 NOT NULL,
    "player_3_hole_points" integer DEFAULT 0 NOT NULL,
    "player_1_running_total" integer DEFAULT 0 NOT NULL,
    "player_2_running_total" integer DEFAULT 0 NOT NULL,
    "player_3_running_total" integer DEFAULT 0 NOT NULL,
    "is_sweep" boolean DEFAULT false NOT NULL,
    "sweep_winner" integer,
    "press_points" "jsonb" DEFAULT '{}'::"jsonb",
    "player_1_mulligan" boolean DEFAULT false,
    "player_2_mulligan" boolean DEFAULT false,
    "player_3_mulligan" boolean DEFAULT false,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."copenhagen_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_hole_distances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_hole_id" "uuid" NOT NULL,
    "course_tee_id" "uuid" NOT NULL,
    "distance" integer NOT NULL,
    CONSTRAINT "course_hole_distances_distance_check" CHECK (("distance" > 0))
);


ALTER TABLE "public"."course_hole_distances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer NOT NULL,
    "stroke_index" integer NOT NULL,
    "white_distance" integer,
    "yellow_distance" integer,
    "blue_distance" integer,
    "red_distance" integer,
    "orange_distance" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "black_distance" integer,
    "silver_distance" integer,
    "gold_distance" integer,
    "tee_distances" "jsonb",
    "par_men" integer,
    "par_women" integer,
    "stroke_index_men" integer,
    "stroke_index_women" integer
);


ALTER TABLE "public"."course_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_tees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "tee_name" "text" NOT NULL,
    "tee_color" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "par_men" integer,
    "par_women" integer,
    "course_rating_men" numeric(4,1),
    "slope_men" integer,
    "course_rating_women" numeric(4,1),
    "slope_women" integer,
    "course_rating_men_front9" numeric(4,1),
    "course_rating_men_back9" numeric(4,1),
    "slope_men_front9" integer,
    "slope_men_back9" integer,
    "course_rating_women_front9" numeric(4,1),
    "course_rating_women_back9" numeric(4,1),
    "slope_women_front9" integer,
    "slope_women_back9" integer,
    "total_distance" integer,
    "external_tee_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."course_tees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tee_names" "jsonb" DEFAULT '{"red": "Red", "blue": "Blue", "black": "Black", "white": "White", "yellow": "Yellow"}'::"jsonb",
    "country_code" "text",
    "tee_colors" "jsonb",
    "tee_ratings" "jsonb",
    "external_source" "text",
    "external_id" "text",
    "external_club_id" "text",
    "external_data" "jsonb",
    "imported_at" timestamp with time zone,
    "external_updated_at" timestamp with time zone,
    "latitude" numeric,
    "longitude" numeric,
    "length_format" "text",
    "imported_by" "uuid",
    CONSTRAINT "courses_length_format_check" CHECK ((("length_format" IS NULL) OR ("length_format" = ANY (ARRAY['y'::"text", 'm'::"text"]))))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."courses"."tee_ratings" IS 'Per-tee course rating + slope rating, keyed by tee color. Format: {"yellow": {"rating": 70.7, "slope": 121}, ...}';



CREATE TABLE IF NOT EXISTS "public"."custom_level_maps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "category" "text",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "course_art" "text",
    CONSTRAINT "custom_level_maps_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 80)))
);


ALTER TABLE "public"."custom_level_maps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" DEFAULT 'ios'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drill_results" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "drill_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_points" integer NOT NULL,
    "attempts_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "normalized_score" smallint
);


ALTER TABLE "public"."drill_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drills" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "short_desc" "text",
    "long_desc" "text",
    "scoring_scheme" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lower_is_better" boolean DEFAULT false,
    "shot_area" "text",
    "visibility" "text" DEFAULT 'featured'::"text" NOT NULL
);


ALTER TABLE "public"."drills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "creator_id" "uuid" NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE,
    "course_id" "uuid",
    "course_name" "text",
    "game_type" "text" NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorite_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorite_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "requester" "uuid",
    "addressee" "uuid",
    "status" "public"."friend_status" DEFAULT 'pending'::"public"."friend_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_a" "uuid",
    "user_b" "uuid"
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."friends_pairs" AS
 SELECT DISTINCT LEAST("requester", "addressee") AS "a",
    GREATEST("requester", "addressee") AS "b"
   FROM "public"."friendships"
  WHERE ("status" = 'accepted'::"public"."friend_status");


ALTER VIEW "public"."friends_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_feed_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."game_feed_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_feed_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "text" NOT NULL,
    "game_type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text",
    "image_url" "text",
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."game_feed_posts" REPLICA IDENTITY FULL;


ALTER TABLE "public"."game_feed_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "round_id" "uuid",
    "group_name" "text" DEFAULT 'Group A'::"text" NOT NULL,
    "group_index" integer DEFAULT 0 NOT NULL,
    "tee_time" "text",
    "starting_hole" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_type" "text",
    "event_id" "uuid"
);


ALTER TABLE "public"."game_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "game_type" "text" NOT NULL,
    "game_id" "uuid" NOT NULL
);


ALTER TABLE "public"."game_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "content" "text",
    "image_url" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_activity_type_check" CHECK (("type" = ANY (ARRAY['auto'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."group_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_activity_comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_activity_comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_activity_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid"
);


ALTER TABLE "public"."group_activity_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_activity_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_activity_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "drill_id" "uuid",
    "drill_slug" "text" NOT NULL,
    "drill_title" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "end_date" "date" DEFAULT (CURRENT_DATE + 6) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."group_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0 NOT NULL,
    "revoked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."group_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."group_role" DEFAULT 'member'::"public"."group_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "start_time" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "end_time" timestamp with time zone,
    "max_participants" integer,
    "recurrence_pattern" "text",
    "recurrence_end_date" timestamp with time zone,
    "parent_session_id" "uuid",
    "reminder_sent_at" timestamp with time zone,
    "template_id" "uuid",
    "invited_player_ids" "uuid"[],
    "start_reminder_sent_at" timestamp with time zone,
    "timezone" "text" DEFAULT 'UTC'::"text",
    CONSTRAINT "group_sessions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'open'::"text", 'closed'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."group_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "is_coach_group" boolean DEFAULT false NOT NULL,
    "image_url" "text",
    "show_coach_profile_results" boolean DEFAULT false NOT NULL,
    "group_type" "text",
    "show_coach_score" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."groups"."is_coach_group" IS 'When true, the owner is a coach and should be excluded from leaderboards';



CREATE TABLE IF NOT EXISTS "public"."holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "round_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer NOT NULL,
    "score" integer NOT NULL,
    "tee_result" "public"."tee_result",
    "approach_bucket" "public"."approach_bucket",
    "up_and_down" boolean DEFAULT false,
    "sand_save" boolean DEFAULT false,
    "putts" integer,
    "first_putt_band" "public"."first_putt_band",
    "penalties" integer DEFAULT 0,
    "recovery" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "approach_results" "text"[] DEFAULT '{}'::"text"[],
    "pro_shot_data" "jsonb",
    "player_id" "uuid",
    "mulligan" boolean DEFAULT false NOT NULL,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "mulligan_used" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."holes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."holes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."holes"."pro_shot_data" IS 'Stores detailed shot-by-shot data for pro rounds including distances, lies, and strokes gained';



CREATE TABLE IF NOT EXISTS "public"."levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "level_in_tier" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "distance" "text",
    "success_criteria" "text",
    "xp" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "shared_by_user_id" "uuid",
    "custom_map_id" "uuid",
    CONSTRAINT "levels_category_check" CHECK (("category" = ANY (ARRAY['putting'::"text", 'short_game'::"text"]))),
    CONSTRAINT "levels_level_in_tier_check" CHECK (("level_in_tier" >= 1)),
    CONSTRAINT "levels_tier_check" CHECK (("tier" = ANY (ARRAY['rookie'::"text", 'amateur'::"text", 'intermediate'::"text", 'pro'::"text", 'custom'::"text"]))),
    CONSTRAINT "levels_xp_check" CHECK (("xp" >= 0))
);


ALTER TABLE "public"."levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_battle_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "current_level" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "map_battle_participants_current_level_check" CHECK (("current_level" >= 1))
);


ALTER TABLE "public"."map_battle_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_battle_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "level_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."map_battle_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."map_battles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "base_map_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "time_limit_seconds" integer,
    "level_ids" "uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "ended_reason" "text",
    "winner_user_id" "uuid",
    CONSTRAINT "map_battles_ended_reason_check" CHECK ((("ended_reason" IS NULL) OR ("ended_reason" = ANY (ARRAY['time_expired'::"text", 'owner_ended'::"text", 'all_finished'::"text"])))),
    CONSTRAINT "map_battles_level_ids_check" CHECK (("array_length"("level_ids", 1) >= 1)),
    CONSTRAINT "map_battles_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 80))),
    CONSTRAINT "map_battles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'finished'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "map_battles_time_limit_seconds_check" CHECK ((("time_limit_seconds" IS NULL) OR ("time_limit_seconds" > 0)))
);


ALTER TABLE "public"."map_battles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_play_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "course_id" "uuid",
    "tee_set" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1" "text" NOT NULL,
    "player_1_handicap" numeric,
    "player_1_tee" "text",
    "player_2" "text" NOT NULL,
    "player_2_handicap" numeric,
    "player_2_tee" "text",
    "use_handicaps" boolean DEFAULT false NOT NULL,
    "match_status" integer DEFAULT 0 NOT NULL,
    "holes_remaining" integer DEFAULT 18 NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "winner_player" "text",
    "final_result" "text",
    "round_name" "text",
    "mulligans_per_player" integer DEFAULT 0,
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "groups" "jsonb" DEFAULT '[]'::"jsonb",
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "match_play_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."match_play_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_play_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "player_1_gross_score" integer,
    "player_1_net_score" integer,
    "player_2_gross_score" integer,
    "player_2_net_score" integer,
    "hole_result" integer DEFAULT 0 NOT NULL,
    "match_status_after" integer DEFAULT 0 NOT NULL,
    "holes_remaining_after" integer DEFAULT 17 NOT NULL,
    "player_1_mulligan" boolean DEFAULT false,
    "player_2_mulligan" boolean DEFAULT false,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."match_play_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "metadata" "jsonb",
    "edited_at" timestamp with time zone,
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nine_points_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "course_id" "uuid",
    "tee_set" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1" "text" NOT NULL,
    "player_2" "text" NOT NULL,
    "player_3" "text" NOT NULL,
    "player_1_tee" "text",
    "player_2_tee" "text",
    "player_3_tee" "text",
    "player_1_points" integer DEFAULT 0 NOT NULL,
    "player_2_points" integer DEFAULT 0 NOT NULL,
    "player_3_points" integer DEFAULT 0 NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "winner_player" "text",
    "round_name" "text",
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "sweep_enabled" boolean DEFAULT true NOT NULL,
    "player_1_handicap" numeric,
    "player_2_handicap" numeric,
    "player_3_handicap" numeric,
    "players" "jsonb" DEFAULT '[]'::"jsonb",
    "is_private" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."nine_points_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nine_points_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1_score" integer,
    "player_2_score" integer,
    "player_3_score" integer,
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "player_1_points" integer DEFAULT 0 NOT NULL,
    "player_2_points" integer DEFAULT 0 NOT NULL,
    "player_3_points" integer DEFAULT 0 NOT NULL,
    "is_sweep" boolean DEFAULT false NOT NULL,
    "player_1_gross_score" integer,
    "player_2_gross_score" integer,
    "player_3_gross_score" integer,
    "player_1_net_score" integer,
    "player_2_net_score" integer,
    "player_3_net_score" integer,
    "player_1_hole_points" integer DEFAULT 0,
    "player_2_hole_points" integer DEFAULT 0,
    "player_3_hole_points" integer DEFAULT 0,
    "player_1_running_total" integer DEFAULT 0,
    "player_2_running_total" integer DEFAULT 0,
    "player_3_running_total" integer DEFAULT 0,
    "sweep_winner" integer,
    "player_1_mulligan" boolean DEFAULT false,
    "player_2_mulligan" boolean DEFAULT false,
    "player_3_mulligan" boolean DEFAULT false,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."nine_points_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "sender_user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "related_id" "uuid",
    "related_user_id" "uuid",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "context_id" "uuid",
    "group_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['friend_request'::"text", 'group_invite'::"text", 'high_score'::"text", 'message'::"text", 'group_activity'::"text", 'session_coach'::"text", 'session_invite'::"text", 'battle_invite'::"text", 'battle_finished'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_game_stats_mode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "game_id" "text" NOT NULL,
    "game_type" "text" NOT NULL,
    "stats_mode" "text" DEFAULT 'none'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."player_game_stats_mode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comment_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_comment_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid"
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reaction_emoji" "text" DEFAULT '❤️'::"text" NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scorecard_snapshot" "jsonb",
    "round_id" "uuid"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pro_stats_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pro_round_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer NOT NULL,
    "score" integer NOT NULL,
    "putts" integer,
    "pro_shot_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pro_stats_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pro_stats_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "external_round_id" "uuid",
    "course_name" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pro_stats_rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_name" "text",
    "username" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "country" "text",
    "handicap" "text",
    "home_club" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "distance_unit" "text",
    "gender" "text",
    "first_name" "text",
    "last_name" "text",
    "home_course_id" "uuid",
    "cover_photo_url" "text",
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "recommended_tier" "text",
    "stats_comparison_level" "text",
    CONSTRAINT "display_name_length" CHECK (("length"("display_name") <= 50)),
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "profiles_recommended_tier_check" CHECK (("recommended_tier" = ANY (ARRAY['rookie'::"text", 'amateur'::"text", 'intermediate'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."gender" IS 'Player gender for WHS handicap/slope calculation. male or female only.';



CREATE TABLE IF NOT EXISTS "public"."round_comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."round_comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."round_comment_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."round_comment_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."round_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "round_id" "uuid" NOT NULL,
    "game_type" "text" DEFAULT 'round'::"text" NOT NULL,
    "game_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hole_number" integer,
    "scorecard_player_id" "text",
    "scorecard_player_name" "text",
    "is_activity_item" boolean DEFAULT false
);


ALTER TABLE "public"."round_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."round_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "round_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tee_color" "text",
    "handicap" numeric(4,1),
    "starting_hole" integer DEFAULT 1,
    "group_id" "uuid",
    "guest_name" "text",
    "is_guest" boolean DEFAULT false,
    "event_player_id" "uuid",
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "group_number" integer DEFAULT 1,
    "short_game_type" "text",
    "stats_mode" "text",
    "track_basic_stats" boolean DEFAULT false,
    "track_strokes_gained" boolean DEFAULT false,
    CONSTRAINT "round_players_user_or_guest_check" CHECK ((("user_id" IS NOT NULL) OR (("is_guest" = true) AND ("guest_name" IS NOT NULL))))
);


ALTER TABLE "public"."round_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."round_status" (
    "round_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "finished_at" timestamp with time zone,
    "user_id" "uuid",
    "course_name" "text",
    "game_format" "text" DEFAULT 'stroke_play'::"text" NOT NULL,
    "result_text" "text",
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    CONSTRAINT "round_status_role_check" CHECK (("role" = ANY (ARRAY['player'::"text", 'observer'::"text"])))
);

ALTER TABLE ONLY "public"."round_status" REPLICA IDENTITY FULL;


ALTER TABLE "public"."round_status" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."round_status_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."round_status_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."round_status_id_seq" OWNED BY "public"."round_status"."id";



CREATE TABLE IF NOT EXISTS "public"."rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tee_set" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "origin" "text",
    "round_name" "text",
    "event_id" "uuid",
    "starting_hole" integer DEFAULT 1,
    "round_type" "text" DEFAULT 'fun_practice'::"text",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "scorecard_snapshot" "jsonb",
    "tournament_id" "uuid",
    "course_id" "uuid",
    "is_finished" boolean DEFAULT false NOT NULL,
    "hole_selection" "text" DEFAULT 'Full 18'::"text",
    "is_private" boolean DEFAULT false NOT NULL,
    "is_handicap_round" boolean,
    CONSTRAINT "rounds_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."rounds" OWNER TO "postgres";


COMMENT ON COLUMN "public"."rounds"."round_type" IS 'Round type: fun_practice, qualifying, or tournament';



COMMENT ON COLUMN "public"."rounds"."stats_mode" IS 'In-round stats tracking mode: none, basic, or strokes_gained';



CREATE OR REPLACE VIEW "public"."round_summaries" WITH ("security_invoker"='true') AS
 SELECT "r"."id" AS "round_id",
    "r"."user_id",
    "r"."course_name",
    "r"."date_played",
    "r"."holes_played",
    "r"."tee_set",
    "r"."scorecard_snapshot",
    "sum"("h"."score") AS "total_score",
    "sum"("h"."par") AS "total_par",
    ("sum"("h"."score") - "sum"("h"."par")) AS "score_vs_par",
    "sum"("h"."putts") AS "total_putts",
    "count"(*) FILTER (WHERE ("h"."putts" > 2)) AS "three_putts",
    "sum"("h"."penalties") AS "total_penalties",
    "count"(*) FILTER (WHERE ("h"."tee_result" = 'FIR'::"public"."tee_result")) AS "fairways_hit",
    "count"(*) FILTER (WHERE ("h"."par" >= 4)) AS "par4_and_5_count",
        CASE
            WHEN ("count"(*) FILTER (WHERE ("h"."par" >= 4)) > 0) THEN ((("count"(*) FILTER (WHERE ("h"."tee_result" = 'FIR'::"public"."tee_result")))::double precision / ("count"(*) FILTER (WHERE ("h"."par" >= 4)))::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS "fir_percentage",
    "count"(*) FILTER (WHERE ('GIR'::"text" = ANY ("h"."approach_results"))) AS "greens_hit",
        CASE
            WHEN ("count"(*) > 0) THEN ((("count"(*) FILTER (WHERE ('GIR'::"text" = ANY ("h"."approach_results"))))::double precision / ("count"(*))::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS "gir_percentage",
    "count"(*) FILTER (WHERE ("h"."sand_save" = true)) AS "sand_saves",
    "count"(*) FILTER (WHERE ("h"."up_and_down" = true)) AS "up_and_downs",
    "count"(*) FILTER (WHERE (NOT ('GIR'::"text" = ANY ("h"."approach_results")))) AS "missed_greens",
        CASE
            WHEN ("count"(*) FILTER (WHERE (NOT ('GIR'::"text" = ANY ("h"."approach_results")))) > 0) THEN ((("count"(*) FILTER (WHERE ("h"."up_and_down" = true)))::double precision / ("count"(*) FILTER (WHERE (NOT ('GIR'::"text" = ANY ("h"."approach_results")))))::double precision) * (100)::double precision)
            ELSE NULL::double precision
        END AS "updown_percentage"
   FROM ("public"."rounds" "r"
     LEFT JOIN "public"."holes" "h" ON (("h"."round_id" = "r"."id")))
  GROUP BY "r"."id", "r"."user_id", "r"."course_name", "r"."date_played", "r"."holes_played", "r"."tee_set", "r"."scorecard_snapshot";


ALTER VIEW "public"."round_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scorecard_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "text" NOT NULL,
    "game_format" "text" NOT NULL,
    "player_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scorecard_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scorecard_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "text" NOT NULL,
    "game_format" "text" NOT NULL,
    "player_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reaction_emoji" "text" DEFAULT '❤️'::"text" NOT NULL
);


ALTER TABLE "public"."scorecard_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scramble_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "course_name" "text" NOT NULL,
    "tee_set" "text",
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "holes_played" integer DEFAULT 18 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "teams" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "min_drives_per_player" integer,
    "use_handicaps" boolean DEFAULT false NOT NULL,
    "scoring_type" "text" DEFAULT 'gross'::"text" NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "winning_team" "text",
    "round_name" "text",
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "players_per_team" integer DEFAULT 4,
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "scramble_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."scramble_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scramble_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "team_tee_shots" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scramble_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attended" boolean DEFAULT true NOT NULL,
    "marked_by" "uuid" NOT NULL,
    "marked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_drills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "drill_type" "text" NOT NULL,
    "drill_slug" "text",
    "drill_title" "text" NOT NULL,
    "coach_drill_id" "uuid",
    "drill_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "drill_detail" "text",
    CONSTRAINT "session_drills_drill_type_check" CHECK (("drill_type" = ANY (ARRAY['builtin'::"text", 'coach'::"text"])))
);


ALTER TABLE "public"."session_drills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "invited_user_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "session_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."session_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "note_text" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response_status" "text" NOT NULL,
    "responded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_responses_response_status_check" CHECK (("response_status" = ANY (ARRAY['going'::"text", 'maybe'::"text", 'not_going'::"text"])))
);


ALTER TABLE "public"."session_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "session_drill_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "drill_result_id" "uuid",
    "score_value" integer NOT NULL,
    "is_best" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."session_scores" REPLICA IDENTITY FULL;


ALTER TABLE "public"."session_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "drills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."session_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sg_rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "text",
    "course_name" "text" NOT NULL,
    "tee_key" "text",
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "holes_played" integer DEFAULT 18 NOT NULL,
    "hole_selection" "text" DEFAULT 'full18'::"text" NOT NULL,
    "club_tracking" boolean DEFAULT false NOT NULL,
    "total_score" integer,
    "sg_total" double precision,
    "sg_off_the_tee" double precision,
    "sg_approach" double precision,
    "sg_around_the_green" double precision,
    "sg_putting" double precision,
    "holes_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_format" "text",
    "source_round_id" "uuid"
);


ALTER TABLE "public"."sg_rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skins_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid",
    "course_name" "text" NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "holes_played" integer DEFAULT 18 NOT NULL,
    "skin_value" numeric DEFAULT 1 NOT NULL,
    "carryover_enabled" boolean DEFAULT true NOT NULL,
    "use_handicaps" boolean DEFAULT false NOT NULL,
    "handicap_mode" "text" DEFAULT 'net'::"text" NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "players" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "winner_player" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "round_name" "text",
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "skins_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."skins_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skins_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "par" integer DEFAULT 4 NOT NULL,
    "stroke_index" integer,
    "player_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "skins_available" integer DEFAULT 1 NOT NULL,
    "winner_player" "text",
    "is_carryover" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."skins_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_chat_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_chat_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revoked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."tournament_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "guest_name" "text",
    "event_player_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"(),
    "added_by" "uuid",
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "team_id" "uuid",
    CONSTRAINT "member_user_or_guest" CHECK ((("user_id" IS NOT NULL) OR ("guest_name" IS NOT NULL)))
);


ALTER TABLE "public"."tournament_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'general'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sender_name" "text"
);


ALTER TABLE "public"."tournament_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_point_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "position_points" "jsonb" DEFAULT '{"1": 25, "2": 20, "3": 16, "4": 13, "5": 11, "6": 9, "7": 7, "8": 5, "9": 3, "last": 1}'::"jsonb" NOT NULL,
    "bonus_categories" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_point_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_round_contest_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "round_id" "uuid" NOT NULL,
    "contest_kind" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "distance" numeric NOT NULL,
    "unit" "text" DEFAULT 'yd'::"text" NOT NULL,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tournament_round_contest_entries_contest_kind_check" CHECK (("contest_kind" = ANY (ARRAY['ctp'::"text", 'longest_drive'::"text"]))),
    CONSTRAINT "tournament_round_contest_entries_distance_check" CHECK (("distance" > (0)::numeric)),
    CONSTRAINT "tournament_round_contest_entries_unit_check" CHECK (("unit" = ANY (ARRAY['yd'::"text", 'm'::"text"])))
);


ALTER TABLE "public"."tournament_round_contest_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_round_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "round_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "position_points" integer DEFAULT 0 NOT NULL,
    "bonus_points" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "multiplier" numeric DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_round_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Team'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umbriago_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "tee_set" "text",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_a_player_1" "text" NOT NULL,
    "team_a_player_2" "text" NOT NULL,
    "team_b_player_1" "text" NOT NULL,
    "team_b_player_2" "text" NOT NULL,
    "stake_per_point" numeric DEFAULT 10 NOT NULL,
    "payout_mode" "text" DEFAULT 'difference'::"text" NOT NULL,
    "team_a_total_points" integer DEFAULT 0 NOT NULL,
    "team_b_total_points" integer DEFAULT 0 NOT NULL,
    "roll_history" "jsonb" DEFAULT '[]'::"jsonb",
    "is_finished" boolean DEFAULT false NOT NULL,
    "winning_team" "text",
    "final_payout" numeric,
    "course_id" "uuid",
    "rolls_per_team" integer DEFAULT 1 NOT NULL,
    "round_name" "text",
    "team_a_name" "text" DEFAULT 'Team A'::"text" NOT NULL,
    "team_b_name" "text" DEFAULT 'Team B'::"text" NOT NULL,
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "groups" "jsonb" DEFAULT '[]'::"jsonb",
    "players" "jsonb" DEFAULT '[]'::"jsonb",
    "last_hole_auto_double" boolean DEFAULT false,
    "is_private" boolean DEFAULT false NOT NULL,
    "team_rotation" "text" DEFAULT 'none'::"text" NOT NULL,
    CONSTRAINT "umbriago_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"]))),
    CONSTRAINT "umbriago_games_team_rotation_check" CHECK (("team_rotation" = ANY (ARRAY['none'::"text", 'every_6'::"text", 'front_back'::"text"])))
);


ALTER TABLE "public"."umbriago_games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."umbriago_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "team_a_player_1_score" integer,
    "team_a_player_2_score" integer,
    "team_b_player_1_score" integer,
    "team_b_player_2_score" integer,
    "par" integer DEFAULT 4 NOT NULL,
    "team_low_winner" "text",
    "individual_low_winner" "text",
    "closest_to_pin_winner" "text",
    "birdie_eagle_winner" "text",
    "multiplier" integer DEFAULT 1 NOT NULL,
    "double_called_by" "text",
    "double_back_called" boolean DEFAULT false,
    "is_umbriago" boolean DEFAULT false NOT NULL,
    "team_a_hole_points" integer DEFAULT 0 NOT NULL,
    "team_b_hole_points" integer DEFAULT 0 NOT NULL,
    "team_a_running_total" integer DEFAULT 0 NOT NULL,
    "team_b_running_total" integer DEFAULT 0 NOT NULL,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."umbriago_holes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_bucket_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_bucket_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_conversation_settings" (
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "is_muted" boolean DEFAULT false NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "muted_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_conversation_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "drill_id" "text" NOT NULL,
    "drill_title" "text" NOT NULL,
    "drill_category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_level_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "level_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_level_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "milestone_key" "text" NOT NULL,
    "current_tier" integer DEFAULT 0 NOT NULL,
    "tier_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_earned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_milestones_current_tier_nonneg" CHECK (("current_tier" >= 0))
);


ALTER TABLE "public"."user_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wolf_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_name" "text" NOT NULL,
    "course_id" "uuid",
    "holes_played" integer DEFAULT 18 NOT NULL,
    "date_played" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1" "text" NOT NULL,
    "player_2" "text" NOT NULL,
    "player_3" "text" NOT NULL,
    "player_4" "text",
    "player_5" "text",
    "lone_wolf_win_points" integer DEFAULT 3 NOT NULL,
    "lone_wolf_loss_points" integer DEFAULT 1 NOT NULL,
    "team_win_points" integer DEFAULT 1 NOT NULL,
    "wolf_position" "text" DEFAULT 'last'::"text" NOT NULL,
    "player_1_points" integer DEFAULT 0 NOT NULL,
    "player_2_points" integer DEFAULT 0 NOT NULL,
    "player_3_points" integer DEFAULT 0 NOT NULL,
    "player_4_points" integer DEFAULT 0 NOT NULL,
    "player_5_points" integer DEFAULT 0 NOT NULL,
    "is_finished" boolean DEFAULT false NOT NULL,
    "winner_player" "text",
    "round_name" "text",
    "rolls_per_player" integer DEFAULT 1 NOT NULL,
    "roll_history" "jsonb" DEFAULT '[]'::"jsonb",
    "double_enabled" boolean DEFAULT true NOT NULL,
    "player_6" "text",
    "player_6_points" integer DEFAULT 0 NOT NULL,
    "event_id" "uuid",
    "group_id" "uuid",
    "stats_mode" "text" DEFAULT 'none'::"text",
    "players" "jsonb" DEFAULT '[]'::"jsonb",
    "is_private" boolean DEFAULT false NOT NULL,
    CONSTRAINT "wolf_games_stats_mode_check" CHECK (("stats_mode" = ANY (ARRAY['none'::"text", 'basic'::"text", 'strokes_gained'::"text"])))
);


ALTER TABLE "public"."wolf_games" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_played_courses_v1" AS
 SELECT ("lower"(("rp"."user_id")::"text"))::"uuid" AS "user_id",
    "r"."course_id",
    "r"."date_played",
    "r"."is_private",
    "r"."user_id" AS "round_owner"
   FROM ("public"."rounds" "r"
     JOIN "public"."round_players" "rp" ON (("rp"."round_id" = "r"."id")))
  WHERE (("r"."is_finished" = true) AND ("r"."course_id" IS NOT NULL) AND ("rp"."user_id" IS NOT NULL))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'odId'::"text")))::"uuid" AS "user_id",
    "bb"."course_id",
    ("bb"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "bb"."user_id" AS "round_owner"
   FROM "public"."best_ball_games" "bb",
    LATERAL "jsonb_array_elements"("bb"."teams") "team"("value"),
    LATERAL "jsonb_array_elements"(("team"."value" -> 'players'::"text")) "p"("value")
  WHERE (("bb"."is_finished" = true) AND ("bb"."course_id" IS NOT NULL) AND ("bb"."teams" IS NOT NULL) AND ("p"."value" ? 'odId'::"text") AND (("p"."value" ->> 'odId'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'odId'::"text")))::"uuid" AS "user_id",
    "bbt"."course_id",
    ("bbt"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "bbt"."user_id" AS "round_owner"
   FROM "public"."best_ball_taliban_games" "bbt",
    LATERAL "jsonb_array_elements"("bbt"."team_a_players") "p"("value")
  WHERE (("bbt"."is_finished" = true) AND ("bbt"."course_id" IS NOT NULL) AND ("bbt"."team_a_players" IS NOT NULL) AND ("p"."value" ? 'odId'::"text") AND (("p"."value" ->> 'odId'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'odId'::"text")))::"uuid" AS "user_id",
    "bbt"."course_id",
    ("bbt"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "bbt"."user_id" AS "round_owner"
   FROM "public"."best_ball_taliban_games" "bbt",
    LATERAL "jsonb_array_elements"("bbt"."team_b_players") "p"("value")
  WHERE (("bbt"."is_finished" = true) AND ("bbt"."course_id" IS NOT NULL) AND ("bbt"."team_b_players" IS NOT NULL) AND ("p"."value" ? 'odId'::"text") AND (("p"."value" ->> 'odId'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'odId'::"text")))::"uuid" AS "user_id",
    "bbwb"."course_id",
    ("bbwb"."created_at")::"date" AS "date_played",
    false AS "is_private",
    NULL::"uuid" AS "round_owner"
   FROM "public"."best_ball_worst_ball_games" "bbwb",
    LATERAL "jsonb_array_elements"("bbwb"."team_a_players_v2") "p"("value")
  WHERE (("bbwb"."is_finished" = true) AND ("bbwb"."course_id" IS NOT NULL) AND ("bbwb"."team_a_players_v2" IS NOT NULL) AND ("p"."value" ? 'odId'::"text") AND (("p"."value" ->> 'odId'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'odId'::"text")))::"uuid" AS "user_id",
    "bbwb"."course_id",
    ("bbwb"."created_at")::"date" AS "date_played",
    false AS "is_private",
    NULL::"uuid" AS "round_owner"
   FROM "public"."best_ball_worst_ball_games" "bbwb",
    LATERAL "jsonb_array_elements"("bbwb"."team_b_players_v2") "p"("value")
  WHERE (("bbwb"."is_finished" = true) AND ("bbwb"."course_id" IS NOT NULL) AND ("bbwb"."team_b_players_v2" IS NOT NULL) AND ("p"."value" ? 'odId'::"text") AND (("p"."value" ->> 'odId'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'id'::"text")))::"uuid" AS "user_id",
    "u"."course_id",
    ("u"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "u"."user_id" AS "round_owner"
   FROM "public"."umbriago_games" "u",
    LATERAL "jsonb_array_elements"("u"."players") "p"("value")
  WHERE (("u"."is_finished" = true) AND ("u"."course_id" IS NOT NULL) AND ("u"."players" IS NOT NULL) AND ("p"."value" ? 'id'::"text") AND (("p"."value" ->> 'id'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'id'::"text")))::"uuid" AS "user_id",
    "cg"."course_id",
    ("cg"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "cg"."user_id" AS "round_owner"
   FROM "public"."copenhagen_games" "cg",
    LATERAL "jsonb_array_elements"("cg"."players") "p"("value")
  WHERE (("cg"."is_finished" = true) AND ("cg"."course_id" IS NOT NULL) AND ("cg"."players" IS NOT NULL) AND ("p"."value" ? 'id'::"text") AND (("p"."value" ->> 'id'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'id'::"text")))::"uuid" AS "user_id",
    "wg"."course_id",
    ("wg"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "wg"."user_id" AS "round_owner"
   FROM "public"."wolf_games" "wg",
    LATERAL "jsonb_array_elements"("wg"."players") "p"("value")
  WHERE (("wg"."is_finished" = true) AND ("wg"."course_id" IS NOT NULL) AND ("wg"."players" IS NOT NULL) AND ("p"."value" ? 'id'::"text") AND (("p"."value" ->> 'id'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'id'::"text")))::"uuid" AS "user_id",
    "ng"."course_id",
    ("ng"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "ng"."user_id" AS "round_owner"
   FROM "public"."nine_points_games" "ng",
    LATERAL "jsonb_array_elements"("ng"."players") "p"("value")
  WHERE (("ng"."is_finished" = true) AND ("ng"."course_id" IS NOT NULL) AND ("ng"."players" IS NOT NULL) AND ("p"."value" ? 'id'::"text") AND (("p"."value" ->> 'id'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"(("p"."value" ->> 'id'::"text")))::"uuid" AS "user_id",
    "sg"."course_id",
    ("sg"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "sg"."user_id" AS "round_owner"
   FROM "public"."skins_games" "sg",
    LATERAL "jsonb_array_elements"("sg"."players") "p"("value")
  WHERE (("sg"."is_finished" = true) AND ("sg"."course_id" IS NOT NULL) AND ("sg"."players" IS NOT NULL) AND ("p"."value" ? 'id'::"text") AND (("p"."value" ->> 'id'::"text") !~ '^guest-'::"text"))
UNION ALL
 SELECT ("lower"("uid"."uid"))::"uuid" AS "user_id",
    "bg"."course_id",
    ("bg"."created_at")::"date" AS "date_played",
    false AS "is_private",
    NULL::"uuid" AS "round_owner"
   FROM "public"."banker_games" "bg",
    LATERAL "unnest"("bg"."banker_order") "uid"("uid")
  WHERE (("bg"."banker_order" IS NOT NULL) AND ("bg"."course_id" IS NOT NULL) AND ("uid"."uid" !~ '^guest-'::"text") AND ("uid"."uid" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::"text"))
UNION ALL
 SELECT ("lower"("mp"."player_1"))::"uuid" AS "user_id",
    "mp"."course_id",
    ("mp"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "mp"."user_id" AS "round_owner"
   FROM "public"."match_play_games" "mp"
  WHERE (("mp"."is_finished" = true) AND ("mp"."course_id" IS NOT NULL) AND ("mp"."player_1" IS NOT NULL) AND ("mp"."player_1" !~ '^guest-'::"text") AND ("mp"."player_1" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::"text"))
UNION ALL
 SELECT ("lower"("mp"."player_2"))::"uuid" AS "user_id",
    "mp"."course_id",
    ("mp"."created_at")::"date" AS "date_played",
    false AS "is_private",
    "mp"."user_id" AS "round_owner"
   FROM "public"."match_play_games" "mp"
  WHERE (("mp"."is_finished" = true) AND ("mp"."course_id" IS NOT NULL) AND ("mp"."player_2" IS NOT NULL) AND ("mp"."player_2" !~ '^guest-'::"text") AND ("mp"."player_2" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::"text"));


ALTER VIEW "public"."user_played_courses_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_ranked_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "rank_position" integer NOT NULL,
    "is_pre_app" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_ranked_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "favourite_group_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wolf_holes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "hole_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "par" integer DEFAULT 4 NOT NULL,
    "wolf_player" integer NOT NULL,
    "wolf_choice" "text",
    "partner_player" integer,
    "player_1_score" integer,
    "player_2_score" integer,
    "player_3_score" integer,
    "player_4_score" integer,
    "player_5_score" integer,
    "player_1_hole_points" integer DEFAULT 0 NOT NULL,
    "player_2_hole_points" integer DEFAULT 0 NOT NULL,
    "player_3_hole_points" integer DEFAULT 0 NOT NULL,
    "player_4_hole_points" integer DEFAULT 0 NOT NULL,
    "player_5_hole_points" integer DEFAULT 0 NOT NULL,
    "player_1_running_total" integer DEFAULT 0 NOT NULL,
    "player_2_running_total" integer DEFAULT 0 NOT NULL,
    "player_3_running_total" integer DEFAULT 0 NOT NULL,
    "player_4_running_total" integer DEFAULT 0 NOT NULL,
    "player_5_running_total" integer DEFAULT 0 NOT NULL,
    "winning_side" "text",
    "multiplier" integer DEFAULT 1 NOT NULL,
    "double_called_by" integer,
    "double_back_called" boolean DEFAULT false,
    "player_6_score" integer,
    "player_6_hole_points" integer DEFAULT 0 NOT NULL,
    "player_6_running_total" integer DEFAULT 0 NOT NULL,
    "fairway" "text",
    "gir" boolean,
    "short_game_shots" integer,
    "putts" integer,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "short_game_type" "text",
    "stats_player_id" "uuid"
);


ALTER TABLE "public"."wolf_holes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."_debug_round_status_deletes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."_debug_round_status_deletes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."round_status" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."round_status_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."_debug_round_status_deletes"
    ADD CONSTRAINT "_debug_round_status_deletes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_posts"
    ADD CONSTRAINT "activity_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banker_games"
    ADD CONSTRAINT "banker_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banker_hole_scores"
    ADD CONSTRAINT "banker_hole_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banker_holes"
    ADD CONSTRAINT "banker_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."banker_holes"
    ADD CONSTRAINT "banker_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banker_players"
    ADD CONSTRAINT "banker_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_games"
    ADD CONSTRAINT "best_ball_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_holes"
    ADD CONSTRAINT "best_ball_holes_game_id_hole_number_group_key" UNIQUE ("game_id", "hole_number", "group_number");



ALTER TABLE ONLY "public"."best_ball_holes"
    ADD CONSTRAINT "best_ball_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_taliban_games"
    ADD CONSTRAINT "best_ball_taliban_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_taliban_holes"
    ADD CONSTRAINT "best_ball_taliban_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."best_ball_taliban_holes"
    ADD CONSTRAINT "best_ball_taliban_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_worst_ball_games"
    ADD CONSTRAINT "best_ball_worst_ball_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."best_ball_worst_ball_holes"
    ADD CONSTRAINT "best_ball_worst_ball_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."coach_ai_feedback"
    ADD CONSTRAINT "coach_ai_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_ai_feedback"
    ADD CONSTRAINT "coach_ai_feedback_user_id_drill_id_key" UNIQUE ("user_id", "drill_id");



ALTER TABLE ONLY "public"."coach_drill_generations"
    ADD CONSTRAINT "coach_drill_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_drills"
    ADD CONSTRAINT "coach_drills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."copenhagen_games"
    ADD CONSTRAINT "copenhagen_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."copenhagen_holes"
    ADD CONSTRAINT "copenhagen_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."copenhagen_holes"
    ADD CONSTRAINT "copenhagen_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_hole_distances"
    ADD CONSTRAINT "course_hole_distances_hole_tee_unique" UNIQUE ("course_hole_id", "course_tee_id");



ALTER TABLE ONLY "public"."course_hole_distances"
    ADD CONSTRAINT "course_hole_distances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_holes"
    ADD CONSTRAINT "course_holes_course_id_hole_number_key" UNIQUE ("course_id", "hole_number");



ALTER TABLE ONLY "public"."course_holes"
    ADD CONSTRAINT "course_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_tees"
    ADD CONSTRAINT "course_tees_course_name_unique" UNIQUE ("course_id", "tee_name");



ALTER TABLE ONLY "public"."course_tees"
    ADD CONSTRAINT "course_tees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_level_maps"
    ADD CONSTRAINT "custom_level_maps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."drill_results"
    ADD CONSTRAINT "drill_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drills"
    ADD CONSTRAINT "drills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_courses"
    ADD CONSTRAINT "favorite_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_courses"
    ADD CONSTRAINT "favorite_courses_user_id_course_id_key" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_addressee_key" UNIQUE ("requester", "addressee");



ALTER TABLE ONLY "public"."game_feed_likes"
    ADD CONSTRAINT "game_feed_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_feed_likes"
    ADD CONSTRAINT "game_feed_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."game_feed_posts"
    ADD CONSTRAINT "game_feed_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_groups"
    ADD CONSTRAINT "game_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_groups"
    ADD CONSTRAINT "game_groups_round_id_group_index_key" UNIQUE ("round_id", "group_index");



ALTER TABLE ONLY "public"."game_likes"
    ADD CONSTRAINT "game_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_likes"
    ADD CONSTRAINT "game_likes_user_game_unique" UNIQUE ("user_id", "game_type", "game_id");



ALTER TABLE ONLY "public"."group_activity_comment_likes"
    ADD CONSTRAINT "group_activity_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."group_activity_comment_likes"
    ADD CONSTRAINT "group_activity_comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_activity_comments"
    ADD CONSTRAINT "group_activity_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_activity_likes"
    ADD CONSTRAINT "group_activity_likes_activity_id_user_id_key" UNIQUE ("activity_id", "user_id");



ALTER TABLE ONLY "public"."group_activity_likes"
    ADD CONSTRAINT "group_activity_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_activity"
    ADD CONSTRAINT "group_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_challenges"
    ADD CONSTRAINT "group_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_user_unique" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holes"
    ADD CONSTRAINT "holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holes"
    ADD CONSTRAINT "holes_round_hole_player_unique" UNIQUE ("round_id", "hole_number", "player_id");



ALTER TABLE ONLY "public"."holes"
    ADD CONSTRAINT "holes_round_player_hole_unique" UNIQUE ("round_id", "player_id", "hole_number");



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_battle_participants"
    ADD CONSTRAINT "map_battle_participants_battle_id_user_id_key" UNIQUE ("battle_id", "user_id");



ALTER TABLE ONLY "public"."map_battle_participants"
    ADD CONSTRAINT "map_battle_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_battle_progress"
    ADD CONSTRAINT "map_battle_progress_battle_id_user_id_level_id_key" UNIQUE ("battle_id", "user_id", "level_id");



ALTER TABLE ONLY "public"."map_battle_progress"
    ADD CONSTRAINT "map_battle_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."map_battles"
    ADD CONSTRAINT "map_battles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_play_games"
    ADD CONSTRAINT "match_play_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_play_holes"
    ADD CONSTRAINT "match_play_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nine_points_games"
    ADD CONSTRAINT "nine_points_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nine_points_holes"
    ADD CONSTRAINT "nine_points_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."nine_points_holes"
    ADD CONSTRAINT "nine_points_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_game_stats_mode"
    ADD CONSTRAINT "player_game_stats_mode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."player_game_stats_mode"
    ADD CONSTRAINT "player_game_stats_mode_user_id_game_id_game_type_key" UNIQUE ("user_id", "game_id", "game_type");



ALTER TABLE ONLY "public"."post_comment_likes"
    ADD CONSTRAINT "post_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."post_comment_likes"
    ADD CONSTRAINT "post_comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comment_replies"
    ADD CONSTRAINT "post_comment_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_user_unique" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_stats_holes"
    ADD CONSTRAINT "pro_stats_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_stats_holes"
    ADD CONSTRAINT "pro_stats_holes_pro_round_id_hole_number_key" UNIQUE ("pro_round_id", "hole_number");



ALTER TABLE ONLY "public"."pro_stats_rounds"
    ADD CONSTRAINT "pro_stats_rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."round_comment_likes"
    ADD CONSTRAINT "round_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."round_comment_likes"
    ADD CONSTRAINT "round_comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."round_comment_replies"
    ADD CONSTRAINT "round_comment_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."round_comments"
    ADD CONSTRAINT "round_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."round_players"
    ADD CONSTRAINT "round_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."round_players"
    ADD CONSTRAINT "round_players_round_id_user_id_key" UNIQUE ("round_id", "user_id");



ALTER TABLE ONLY "public"."round_status"
    ADD CONSTRAINT "round_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scorecard_comments"
    ADD CONSTRAINT "scorecard_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scorecard_likes"
    ADD CONSTRAINT "scorecard_likes_game_id_player_id_user_id_key" UNIQUE ("game_id", "player_id", "user_id");



ALTER TABLE ONLY "public"."scorecard_likes"
    ADD CONSTRAINT "scorecard_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scramble_games"
    ADD CONSTRAINT "scramble_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scramble_holes"
    ADD CONSTRAINT "scramble_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."scramble_holes"
    ADD CONSTRAINT "scramble_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_attendance"
    ADD CONSTRAINT "session_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_attendance"
    ADD CONSTRAINT "session_attendance_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."session_drills"
    ADD CONSTRAINT "session_drills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_drills"
    ADD CONSTRAINT "session_drills_session_id_position_key" UNIQUE ("session_id", "position");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_session_id_invited_user_id_key" UNIQUE ("session_id", "invited_user_id");



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_session_id_coach_id_key" UNIQUE ("session_id", "coach_id");



ALTER TABLE ONLY "public"."session_responses"
    ADD CONSTRAINT "session_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_responses"
    ADD CONSTRAINT "session_responses_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."session_scores"
    ADD CONSTRAINT "session_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_templates"
    ADD CONSTRAINT "session_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sg_rounds"
    ADD CONSTRAINT "sg_rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skins_games"
    ADD CONSTRAINT "skins_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skins_holes"
    ADD CONSTRAINT "skins_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."skins_holes"
    ADD CONSTRAINT "skins_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_chat_reads"
    ADD CONSTRAINT "tournament_chat_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_chat_reads"
    ADD CONSTRAINT "tournament_chat_reads_user_id_tournament_id_key" UNIQUE ("user_id", "tournament_id");



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_tournament_id_group_id_key" UNIQUE ("tournament_id", "group_id");



ALTER TABLE ONLY "public"."tournament_invites"
    ADD CONSTRAINT "tournament_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."tournament_invites"
    ADD CONSTRAINT "tournament_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_tournament_user_unique" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."tournament_messages"
    ADD CONSTRAINT "tournament_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_point_config"
    ADD CONSTRAINT "tournament_point_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_point_config"
    ADD CONSTRAINT "tournament_point_config_tournament_id_key" UNIQUE ("tournament_id");



ALTER TABLE ONLY "public"."tournament_round_contest_entries"
    ADD CONSTRAINT "tournament_round_contest_entr_tournament_id_round_id_contes_key" UNIQUE ("tournament_id", "round_id", "contest_kind", "user_id");



ALTER TABLE ONLY "public"."tournament_round_contest_entries"
    ADD CONSTRAINT "tournament_round_contest_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_round_points"
    ADD CONSTRAINT "tournament_round_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_round_points"
    ADD CONSTRAINT "tournament_round_points_tournament_id_round_id_player_id_key" UNIQUE ("tournament_id", "round_id", "player_id");



ALTER TABLE ONLY "public"."tournament_rounds"
    ADD CONSTRAINT "tournament_rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_rounds"
    ADD CONSTRAINT "tournament_rounds_tournament_id_round_id_key" UNIQUE ("tournament_id", "round_id");



ALTER TABLE ONLY "public"."tournament_rounds"
    ADD CONSTRAINT "tournament_rounds_tournament_id_round_number_key" UNIQUE ("tournament_id", "round_number");



ALTER TABLE ONLY "public"."tournament_teams"
    ADD CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umbriago_games"
    ADD CONSTRAINT "umbriago_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umbriago_holes"
    ADD CONSTRAINT "umbriago_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."umbriago_holes"
    ADD CONSTRAINT "umbriago_holes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_stats_rounds"
    ADD CONSTRAINT "unique_user_external_round" UNIQUE ("user_id", "external_round_id");



ALTER TABLE ONLY "public"."user_bucket_courses"
    ADD CONSTRAINT "user_bucket_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_bucket_courses"
    ADD CONSTRAINT "user_bucket_courses_unique_per_user" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."user_conversation_settings"
    ADD CONSTRAINT "user_conversation_settings_pkey" PRIMARY KEY ("user_id", "conversation_id");



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_user_id_drill_id_key" UNIQUE ("user_id", "drill_id");



ALTER TABLE ONLY "public"."user_level_progress"
    ADD CONSTRAINT "user_level_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_level_progress"
    ADD CONSTRAINT "user_level_progress_user_id_level_id_key" UNIQUE ("user_id", "level_id");



ALTER TABLE ONLY "public"."user_milestones"
    ADD CONSTRAINT "user_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_milestones"
    ADD CONSTRAINT "user_milestones_user_key_unique" UNIQUE ("user_id", "milestone_key");



ALTER TABLE ONLY "public"."user_ranked_courses"
    ADD CONSTRAINT "user_ranked_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ranked_courses"
    ADD CONSTRAINT "user_ranked_courses_unique_per_user" UNIQUE ("user_id", "course_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."wolf_games"
    ADD CONSTRAINT "wolf_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wolf_holes"
    ADD CONSTRAINT "wolf_holes_game_id_hole_number_key" UNIQUE ("game_id", "hole_number");



ALTER TABLE ONLY "public"."wolf_holes"
    ADD CONSTRAINT "wolf_holes_pkey" PRIMARY KEY ("id");



CREATE INDEX "course_hole_distances_hole_idx" ON "public"."course_hole_distances" USING "btree" ("course_hole_id");



CREATE INDEX "course_hole_distances_tee_idx" ON "public"."course_hole_distances" USING "btree" ("course_tee_id");



CREATE INDEX "course_tees_course_idx" ON "public"."course_tees" USING "btree" ("course_id");



CREATE UNIQUE INDEX "courses_external_idx" ON "public"."courses" USING "btree" ("external_source", "external_id") WHERE ("external_source" IS NOT NULL);



CREATE INDEX "drill_results_drill_user_idx" ON "public"."drill_results" USING "btree" ("drill_id", "user_id", "total_points" DESC, "created_at" DESC);



CREATE INDEX "friendships_pair_idx" ON "public"."friendships" USING "btree" (LEAST("requester", "addressee"), GREATEST("requester", "addressee"));



CREATE UNIQUE INDEX "friendships_user_pair_unique" ON "public"."friendships" USING "btree" ("user_a", "user_b");



CREATE INDEX "group_members_user_idx" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_activity_posts_created_at" ON "public"."activity_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_posts_participant_ids" ON "public"."activity_posts" USING "gin" ((("metadata" -> 'participant_ids'::"text")));



CREATE INDEX "idx_activity_posts_post_type" ON "public"."activity_posts" USING "btree" ("post_type");



CREATE UNIQUE INDEX "idx_activity_posts_unique_drill_high_score" ON "public"."activity_posts" USING "btree" ("user_id", (("metadata" ->> 'drill_id'::"text")), ((("metadata" ->> 'score'::"text"))::integer)) WHERE ("post_type" = 'drill_high_score'::"text");



COMMENT ON INDEX "public"."idx_activity_posts_unique_drill_high_score" IS 'Prevents duplicate drill_high_score activity_posts for the same (user, drill, score) tuple. Pairs with the ON CONFLICT DO NOTHING in create_drill_high_score_post() to make trigger replays / network retries safe.';



CREATE UNIQUE INDEX "idx_activity_posts_unique_round_finished" ON "public"."activity_posts" USING "btree" ((("metadata" ->> 'round_id'::"text"))) WHERE ("post_type" = 'round_finished'::"text");



COMMENT ON INDEX "public"."idx_activity_posts_unique_round_finished" IS 'Enforces one round_finished activity_posts row per round_id. Prevents duplicate feed entries from multi-device multiplayer races.';



CREATE INDEX "idx_activity_posts_user_id" ON "public"."activity_posts" USING "btree" ("user_id");



CREATE INDEX "idx_best_ball_games_group_id" ON "public"."best_ball_games" USING "btree" ("group_id");



CREATE INDEX "idx_blocks_blocked" ON "public"."blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocks_blocker" ON "public"."blocks" USING "btree" ("blocker_id");



CREATE INDEX "idx_coach_ai_feedback_drill" ON "public"."coach_ai_feedback" USING "btree" ("drill_id");



CREATE INDEX "idx_coach_ai_feedback_user" ON "public"."coach_ai_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_coach_drill_generations_user_recent" ON "public"."coach_drill_generations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_coach_drills_focus_area" ON "public"."coach_drills" USING "btree" ("focus_area");



CREATE INDEX "idx_coach_drills_last_used" ON "public"."coach_drills" USING "btree" ("last_used_at");



CREATE INDEX "idx_coach_drills_votes" ON "public"."coach_drills" USING "btree" ("upvotes", "downvotes");



CREATE INDEX "idx_conversation_participants_user" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_participants_user_id" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_group" ON "public"."conversations" USING "btree" ("group_id") WHERE ("type" = 'group'::"text");



CREATE INDEX "idx_copenhagen_games_group_id" ON "public"."copenhagen_games" USING "btree" ("group_id");



CREATE INDEX "idx_courses_imported_by" ON "public"."courses" USING "btree" ("imported_by");



CREATE INDEX "idx_custom_level_maps_owner_category" ON "public"."custom_level_maps" USING "btree" ("owner_id", "category");



CREATE UNIQUE INDEX "idx_drill_results_user_drill_game" ON "public"."drill_results" USING "btree" ("user_id", "drill_id", (("attempts_json" ->> 'gameId'::"text"))) WHERE ((("attempts_json" ->> 'gameId'::"text") IS NOT NULL) AND (("attempts_json" ->> 'gameId'::"text") <> ''::"text"));



CREATE INDEX "idx_friendships_addressee" ON "public"."friendships" USING "btree" ("addressee");



CREATE INDEX "idx_friendships_addressee_status" ON "public"."friendships" USING "btree" ("addressee", "status");



CREATE INDEX "idx_friendships_requester" ON "public"."friendships" USING "btree" ("requester");



CREATE INDEX "idx_friendships_requester_status" ON "public"."friendships" USING "btree" ("requester", "status");



CREATE INDEX "idx_game_groups_event_id" ON "public"."game_groups" USING "btree" ("event_id");



CREATE INDEX "idx_game_groups_game_type" ON "public"."game_groups" USING "btree" ("game_type");



CREATE INDEX "idx_game_likes_game" ON "public"."game_likes" USING "btree" ("game_type", "game_id");



CREATE INDEX "idx_game_likes_user" ON "public"."game_likes" USING "btree" ("user_id");



CREATE INDEX "idx_group_activity_comment_likes_comment_id" ON "public"."group_activity_comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_group_activity_comment_likes_user_id" ON "public"."group_activity_comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_group_activity_comments_activity" ON "public"."group_activity_comments" USING "btree" ("activity_id");



CREATE INDEX "idx_group_activity_comments_parent_id" ON "public"."group_activity_comments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_group_activity_comments_user" ON "public"."group_activity_comments" USING "btree" ("user_id");



CREATE INDEX "idx_group_activity_group_created" ON "public"."group_activity" USING "btree" ("group_id", "created_at" DESC);



CREATE INDEX "idx_group_activity_likes_activity" ON "public"."group_activity_likes" USING "btree" ("activity_id");



CREATE INDEX "idx_group_activity_likes_user" ON "public"."group_activity_likes" USING "btree" ("user_id");



CREATE INDEX "idx_group_activity_user" ON "public"."group_activity" USING "btree" ("user_id");



CREATE INDEX "idx_group_challenges_active" ON "public"."group_challenges" USING "btree" ("group_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_group_invites_group_active" ON "public"."group_invites" USING "btree" ("group_id") WHERE ("revoked" = false);



CREATE INDEX "idx_group_members_group" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_user" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_group_sessions_created_by" ON "public"."group_sessions" USING "btree" ("created_by");



CREATE INDEX "idx_group_sessions_group_start" ON "public"."group_sessions" USING "btree" ("group_id", "start_time");



CREATE INDEX "idx_group_sessions_group_status" ON "public"."group_sessions" USING "btree" ("group_id", "status");



CREATE INDEX "idx_group_sessions_parent" ON "public"."group_sessions" USING "btree" ("parent_session_id") WHERE ("parent_session_id" IS NOT NULL);



CREATE INDEX "idx_holes_player_id" ON "public"."holes" USING "btree" ("player_id");



CREATE UNIQUE INDEX "idx_holes_round_hole_player" ON "public"."holes" USING "btree" ("round_id", "hole_number", "player_id");



CREATE INDEX "idx_holes_round_player" ON "public"."holes" USING "btree" ("round_id", "player_id");



CREATE INDEX "idx_levels_category_tier" ON "public"."levels" USING "btree" ("category", "tier", "level_in_tier");



CREATE INDEX "idx_levels_created_by" ON "public"."levels" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_levels_custom_map_id" ON "public"."levels" USING "btree" ("custom_map_id") WHERE ("custom_map_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_levels_custom_map_level_in_tier_key" ON "public"."levels" USING "btree" ("custom_map_id", "level_in_tier") WHERE ("custom_map_id" IS NOT NULL);



CREATE INDEX "idx_map_battle_participants_battle" ON "public"."map_battle_participants" USING "btree" ("battle_id");



CREATE INDEX "idx_map_battle_participants_user_active" ON "public"."map_battle_participants" USING "btree" ("user_id", "left_at") WHERE ("left_at" IS NULL);



CREATE INDEX "idx_map_battle_progress_battle_user" ON "public"."map_battle_progress" USING "btree" ("battle_id", "user_id");



CREATE INDEX "idx_map_battles_active_started" ON "public"."map_battles" USING "btree" ("status", "started_at") WHERE (("status" = 'active'::"text") AND ("time_limit_seconds" IS NOT NULL));



CREATE INDEX "idx_map_battles_base_map_status" ON "public"."map_battles" USING "btree" ("base_map_id", "status");



CREATE INDEX "idx_map_battles_owner_status" ON "public"."map_battles" USING "btree" ("owner_id", "status");



CREATE INDEX "idx_match_play_games_group_id" ON "public"."match_play_games" USING "btree" ("group_id");



CREATE INDEX "idx_match_play_games_user" ON "public"."match_play_games" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_match_play_holes_game_hole" ON "public"."match_play_holes" USING "btree" ("game_id", "hole_number");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_conversation_read" ON "public"."messages" USING "btree" ("conversation_id", "is_read", "sender_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_unread" ON "public"."messages" USING "btree" ("conversation_id", "sender_id") WHERE (("is_read" = false) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_notification_log_recipient_type" ON "public"."notification_log" USING "btree" ("recipient_user_id", "notification_type", "created_at" DESC);



CREATE INDEX "idx_notification_preferences_user_id" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_action_url" ON "public"."notifications" USING "btree" ("action_url") WHERE ("action_url" IS NOT NULL);



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_dedup_lookup" ON "public"."notifications" USING "btree" ("user_id", "type", "related_id", "related_user_id", "context_id");



CREATE UNIQUE INDEX "idx_notifications_high_score_unique" ON "public"."notifications" USING "btree" ("user_id", "type", "related_id", "related_user_id", COALESCE("context_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("type" = 'high_score'::"text");



CREATE INDEX "idx_notifications_metadata" ON "public"."notifications" USING "gin" ("metadata");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_post_comment_likes_comment_id" ON "public"."post_comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_post_comment_likes_user_id" ON "public"."post_comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_post_comment_replies_comment_id" ON "public"."post_comment_replies" USING "btree" ("comment_id");



CREATE INDEX "idx_post_comment_replies_user_id" ON "public"."post_comment_replies" USING "btree" ("user_id");



CREATE INDEX "idx_post_comments_post_id" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_comments_user_id" ON "public"."post_comments" USING "btree" ("user_id");



CREATE INDEX "idx_post_likes_post" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_user_id" ON "public"."post_likes" USING "btree" ("user_id");



CREATE INDEX "idx_post_likes_user_post" ON "public"."post_likes" USING "btree" ("user_id", "post_id");



CREATE INDEX "idx_posts_round_id" ON "public"."posts" USING "btree" ("round_id") WHERE ("round_id" IS NOT NULL);



CREATE INDEX "idx_posts_scorecard_snapshot" ON "public"."posts" USING "gin" ("scorecard_snapshot");



CREATE INDEX "idx_posts_user_created" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_round_comments_scorecard" ON "public"."round_comments" USING "btree" ("game_id", "game_type", "scorecard_player_id") WHERE ("scorecard_player_id" IS NOT NULL);



CREATE INDEX "idx_round_players_round" ON "public"."round_players" USING "btree" ("round_id");



CREATE INDEX "idx_round_players_round_id" ON "public"."round_players" USING "btree" ("round_id");



CREATE INDEX "idx_round_players_stats_mode" ON "public"."round_players" USING "btree" ("stats_mode") WHERE ("stats_mode" IS NOT NULL);



CREATE INDEX "idx_round_players_user_id" ON "public"."round_players" USING "btree" ("user_id");



CREATE INDEX "idx_round_status_created_at" ON "public"."round_status" USING "btree" ("created_at");



CREATE INDEX "idx_round_status_game_format" ON "public"."round_status" USING "btree" ("game_format");



CREATE INDEX "idx_round_status_round_id" ON "public"."round_status" USING "btree" ("round_id");



CREATE INDEX "idx_round_status_round_id_text" ON "public"."round_status" USING "btree" ((("round_id")::"text"));



CREATE INDEX "idx_round_status_round_id_user_id" ON "public"."round_status" USING "btree" ("round_id", "user_id");



CREATE INDEX "idx_round_status_user_id" ON "public"."round_status" USING "btree" ("user_id");



CREATE INDEX "idx_round_status_user_round" ON "public"."round_status" USING "btree" ("user_id", "round_id");



CREATE INDEX "idx_rounds_scorecard_snapshot" ON "public"."rounds" USING "gin" ("scorecard_snapshot");



CREATE INDEX "idx_rounds_tournament" ON "public"."rounds" USING "btree" ("tournament_id");



CREATE INDEX "idx_rounds_user_date" ON "public"."rounds" USING "btree" ("user_id", "date_played" DESC);



CREATE INDEX "idx_rounds_user_origin" ON "public"."rounds" USING "btree" ("user_id", "origin");



CREATE INDEX "idx_scramble_games_group_id" ON "public"."scramble_games" USING "btree" ("group_id");



CREATE INDEX "idx_session_attendance_session" ON "public"."session_attendance" USING "btree" ("session_id");



CREATE INDEX "idx_session_attendance_user" ON "public"."session_attendance" USING "btree" ("user_id");



CREATE INDEX "idx_session_drills_session_position" ON "public"."session_drills" USING "btree" ("session_id", "position");



CREATE INDEX "idx_session_invites_session" ON "public"."session_invites" USING "btree" ("session_id");



CREATE INDEX "idx_session_invites_user" ON "public"."session_invites" USING "btree" ("invited_user_id");



CREATE INDEX "idx_session_notes_session" ON "public"."session_notes" USING "btree" ("session_id");



CREATE INDEX "idx_session_responses_session" ON "public"."session_responses" USING "btree" ("session_id");



CREATE INDEX "idx_session_responses_user" ON "public"."session_responses" USING "btree" ("user_id");



CREATE INDEX "idx_session_scores_leaderboard" ON "public"."session_scores" USING "btree" ("session_drill_id", "is_best", "score_value");



CREATE INDEX "idx_session_scores_user" ON "public"."session_scores" USING "btree" ("session_id", "user_id");



CREATE INDEX "idx_session_templates_coach" ON "public"."session_templates" USING "btree" ("created_by");



CREATE INDEX "idx_session_templates_group" ON "public"."session_templates" USING "btree" ("group_id");



CREATE INDEX "idx_sg_rounds_date" ON "public"."sg_rounds" USING "btree" ("user_id", "date_played" DESC);



CREATE INDEX "idx_sg_rounds_user_id" ON "public"."sg_rounds" USING "btree" ("user_id");



CREATE INDEX "idx_skins_games_group_id" ON "public"."skins_games" USING "btree" ("group_id");



CREATE INDEX "idx_tournament_chat_reads_user_tournament" ON "public"."tournament_chat_reads" USING "btree" ("user_id", "tournament_id");



CREATE INDEX "idx_tournament_contests_round" ON "public"."tournament_round_contest_entries" USING "btree" ("tournament_id", "round_id");



CREATE INDEX "idx_tournament_invites_code" ON "public"."tournament_invites" USING "btree" ("code");



CREATE INDEX "idx_tournament_invites_tournament" ON "public"."tournament_invites" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_members_event_player" ON "public"."tournament_members" USING "btree" ("event_player_id");



CREATE INDEX "idx_tournament_members_team_id" ON "public"."tournament_members" USING "btree" ("team_id");



CREATE INDEX "idx_tournament_members_tournament" ON "public"."tournament_members" USING "btree" ("tournament_id");



CREATE UNIQUE INDEX "idx_tournament_members_unique_user" ON "public"."tournament_members" USING "btree" ("tournament_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_tournament_members_user" ON "public"."tournament_members" USING "btree" ("user_id");



CREATE INDEX "idx_tournament_rounds_round" ON "public"."tournament_rounds" USING "btree" ("round_id");



CREATE INDEX "idx_tournament_rounds_tournament" ON "public"."tournament_rounds" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_teams_tournament_id" ON "public"."tournament_teams" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournaments_creator" ON "public"."tournaments" USING "btree" ("creator_id");



CREATE INDEX "idx_tournaments_status" ON "public"."tournaments" USING "btree" ("status");



CREATE INDEX "idx_umbriago_games_group_id" ON "public"."umbriago_games" USING "btree" ("group_id");



CREATE UNIQUE INDEX "idx_unique_friendship_pair" ON "public"."friendships" USING "btree" (LEAST("requester", "addressee"), GREATEST("requester", "addressee"));



CREATE INDEX "idx_user_conversation_settings_user" ON "public"."user_conversation_settings" USING "btree" ("user_id");



CREATE INDEX "idx_user_level_progress_level" ON "public"."user_level_progress" USING "btree" ("level_id");



CREATE INDEX "idx_user_level_progress_user" ON "public"."user_level_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_milestones_key" ON "public"."user_milestones" USING "btree" ("milestone_key");



CREATE INDEX "idx_user_milestones_user" ON "public"."user_milestones" USING "btree" ("user_id");



CREATE INDEX "idx_user_milestones_user_recent" ON "public"."user_milestones" USING "btree" ("user_id", "last_earned_at" DESC) WHERE ("last_earned_at" IS NOT NULL);



CREATE INDEX "idx_wolf_games_group_id" ON "public"."wolf_games" USING "btree" ("group_id");



CREATE UNIQUE INDEX "levels_category_tier_level_in_tier_builtin_key" ON "public"."levels" USING "btree" ("category", "tier", "level_in_tier") WHERE ("created_by" IS NULL);



CREATE INDEX "profiles_home_course_id_idx" ON "public"."profiles" USING "btree" ("home_course_id");



CREATE INDEX "round_players_event_player_id_idx" ON "public"."round_players" USING "btree" ("event_player_id");



CREATE UNIQUE INDEX "sg_rounds_user_source_uniq" ON "public"."sg_rounds" USING "btree" ("user_id", "source_round_id") WHERE ("source_round_id" IS NOT NULL);



CREATE INDEX "user_bucket_courses_user_id_idx" ON "public"."user_bucket_courses" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "user_ranked_courses_user_id_idx" ON "public"."user_ranked_courses" USING "btree" ("user_id", "rank_position");



CREATE INDEX "user_settings_user_idx" ON "public"."user_settings" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "_debug_trg_round_status_delete" BEFORE DELETE ON "public"."round_status" FOR EACH ROW EXECUTE FUNCTION "public"."_debug_log_round_status_delete"();



CREATE OR REPLACE TRIGGER "create_21_points_participant_rows_trigger" AFTER INSERT ON "public"."drill_results" FOR EACH ROW EXECUTE FUNCTION "public"."create_21_points_participant_rows"();



CREATE OR REPLACE TRIGGER "enforce_favourite_groups_limit" BEFORE INSERT OR UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."check_favourite_groups_limit"();



CREATE OR REPLACE TRIGGER "on_drill_result_create_high_score_post" AFTER INSERT ON "public"."drill_results" FOR EACH ROW EXECUTE FUNCTION "public"."create_drill_high_score_post"();



CREATE OR REPLACE TRIGGER "on_drill_result_leaderboard" AFTER INSERT ON "public"."drill_results" FOR EACH ROW EXECUTE FUNCTION "public"."notify_drill_leaderboard"();



CREATE OR REPLACE TRIGGER "on_friend_finished_round_notify" AFTER INSERT ON "public"."activity_posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_friend_finished_round"();



CREATE OR REPLACE TRIGGER "on_friend_request_notify" AFTER INSERT ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."notify_friend_request"();



CREATE OR REPLACE TRIGGER "on_friend_started_round_notify" AFTER INSERT ON "public"."round_status" FOR EACH ROW EXECUTE FUNCTION "public"."notify_friend_started_round"();



CREATE OR REPLACE TRIGGER "on_group_session_notify" AFTER INSERT ON "public"."group_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_group_session_created"();



CREATE OR REPLACE TRIGGER "on_new_message_notify" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_message"();



CREATE OR REPLACE TRIGGER "on_round_status_notify" AFTER INSERT OR DELETE OR UPDATE ON "public"."round_status" FOR EACH ROW EXECUTE FUNCTION "public"."notify_round_status_change"();



CREATE OR REPLACE TRIGGER "on_scorecard_comment_notify" AFTER INSERT ON "public"."scorecard_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_scorecard_comment"();



CREATE OR REPLACE TRIGGER "on_scorecard_like_notify" AFTER INSERT ON "public"."scorecard_likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_scorecard_like"();



CREATE OR REPLACE TRIGGER "on_session_invite_notify" AFTER INSERT ON "public"."session_invites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_session_invite"();



CREATE OR REPLACE TRIGGER "populate_friendship_pair_trigger" BEFORE INSERT OR UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."populate_friendship_pair"();



CREATE OR REPLACE TRIGGER "rounds_auto_remove_from_bucket" AFTER UPDATE OF "is_finished" ON "public"."rounds" FOR EACH ROW EXECUTE FUNCTION "public"."auto_remove_played_from_bucket"();



CREATE OR REPLACE TRIGGER "trg_delete_round_activity_post" AFTER DELETE ON "public"."rounds" FOR EACH ROW EXECUTE FUNCTION "public"."delete_round_activity_post"();



CREATE OR REPLACE TRIGGER "trg_map_battle_progress_after_insert" AFTER INSERT ON "public"."map_battle_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_battle_participant_on_progress"();



CREATE OR REPLACE TRIGGER "trg_map_battles_notify_finished" AFTER UPDATE ON "public"."map_battles" FOR EACH ROW WHEN (("old"."winner_user_id" IS DISTINCT FROM "new"."winner_user_id")) EXECUTE FUNCTION "public"."notify_battle_finished"();



CREATE OR REPLACE TRIGGER "trg_snapshot_tournament_round_point_config" BEFORE INSERT ON "public"."tournament_rounds" FOR EACH ROW EXECUTE FUNCTION "public"."snapshot_tournament_round_point_config"();



CREATE OR REPLACE TRIGGER "trg_tournament_contests_touch" BEFORE UPDATE ON "public"."tournament_round_contest_entries" FOR EACH ROW EXECUTE FUNCTION "public"."tournament_contests_touch_edited"();



CREATE OR REPLACE TRIGGER "trg_user_milestones_updated_at" BEFORE UPDATE ON "public"."user_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_clean_device_token" BEFORE INSERT ON "public"."device_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."clean_device_token_on_insert"();



CREATE OR REPLACE TRIGGER "trigger_holes_rebuild_snapshot_delete" AFTER DELETE ON "public"."holes" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_rebuild_scorecard_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_holes_rebuild_snapshot_insert" AFTER INSERT ON "public"."holes" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_rebuild_scorecard_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_holes_rebuild_snapshot_update" AFTER UPDATE ON "public"."holes" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_rebuild_scorecard_snapshot"();



CREATE OR REPLACE TRIGGER "trigger_update_conversation_timestamp" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "update_player_game_stats_mode_updated_at" BEFORE UPDATE ON "public"."player_game_stats_mode" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_posts"
    ADD CONSTRAINT "activity_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."banker_games"
    ADD CONSTRAINT "banker_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."banker_games"
    ADD CONSTRAINT "banker_games_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."banker_hole_scores"
    ADD CONSTRAINT "banker_hole_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."banker_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."banker_holes"
    ADD CONSTRAINT "banker_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."banker_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."banker_players"
    ADD CONSTRAINT "banker_players_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."banker_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."banker_players"
    ADD CONSTRAINT "banker_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."best_ball_games"
    ADD CONSTRAINT "best_ball_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."best_ball_games"
    ADD CONSTRAINT "best_ball_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."best_ball_games"
    ADD CONSTRAINT "best_ball_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."best_ball_holes"
    ADD CONSTRAINT "best_ball_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."best_ball_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."best_ball_taliban_games"
    ADD CONSTRAINT "best_ball_taliban_games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."best_ball_taliban_holes"
    ADD CONSTRAINT "best_ball_taliban_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."best_ball_taliban_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."best_ball_worst_ball_games"
    ADD CONSTRAINT "best_ball_worst_ball_games_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."best_ball_worst_ball_holes"
    ADD CONSTRAINT "best_ball_worst_ball_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."best_ball_worst_ball_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."best_ball_worst_ball_holes"
    ADD CONSTRAINT "best_ball_worst_ball_holes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_ai_feedback"
    ADD CONSTRAINT "coach_ai_feedback_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "public"."coach_drills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_ai_feedback"
    ADD CONSTRAINT "coach_ai_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_drill_generations"
    ADD CONSTRAINT "coach_drill_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_drills"
    ADD CONSTRAINT "coach_drills_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_drills"
    ADD CONSTRAINT "coach_drills_shared_by_user_id_fkey" FOREIGN KEY ("shared_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."copenhagen_games"
    ADD CONSTRAINT "copenhagen_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."copenhagen_games"
    ADD CONSTRAINT "copenhagen_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."copenhagen_games"
    ADD CONSTRAINT "copenhagen_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."copenhagen_holes"
    ADD CONSTRAINT "copenhagen_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."copenhagen_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_hole_distances"
    ADD CONSTRAINT "course_hole_distances_course_hole_id_fkey" FOREIGN KEY ("course_hole_id") REFERENCES "public"."course_holes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_hole_distances"
    ADD CONSTRAINT "course_hole_distances_course_tee_id_fkey" FOREIGN KEY ("course_tee_id") REFERENCES "public"."course_tees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_holes"
    ADD CONSTRAINT "course_holes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_tees"
    ADD CONSTRAINT "course_tees_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."custom_level_maps"
    ADD CONSTRAINT "custom_level_maps_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."drill_results"
    ADD CONSTRAINT "drill_results_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drill_results"
    ADD CONSTRAINT "drill_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."favorite_courses"
    ADD CONSTRAINT "favorite_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_addressee_fkey" FOREIGN KEY ("addressee") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_fkey" FOREIGN KEY ("requester") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_feed_likes"
    ADD CONSTRAINT "game_feed_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."game_feed_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_feed_likes"
    ADD CONSTRAINT "game_feed_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."game_feed_posts"
    ADD CONSTRAINT "game_feed_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."game_feed_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_feed_posts"
    ADD CONSTRAINT "game_feed_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."game_groups"
    ADD CONSTRAINT "game_groups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_groups"
    ADD CONSTRAINT "game_groups_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_comment_likes"
    ADD CONSTRAINT "group_activity_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."group_activity_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_comment_likes"
    ADD CONSTRAINT "group_activity_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_comments"
    ADD CONSTRAINT "group_activity_comments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."group_activity"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_comments"
    ADD CONSTRAINT "group_activity_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."group_activity_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_comments"
    ADD CONSTRAINT "group_activity_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity"
    ADD CONSTRAINT "group_activity_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_likes"
    ADD CONSTRAINT "group_activity_likes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."group_activity"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity_likes"
    ADD CONSTRAINT "group_activity_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activity"
    ADD CONSTRAINT "group_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_challenges"
    ADD CONSTRAINT "group_challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_challenges"
    ADD CONSTRAINT "group_challenges_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_challenges"
    ADD CONSTRAINT "group_challenges_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "public"."group_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_sessions"
    ADD CONSTRAINT "group_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."session_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holes"
    ADD CONSTRAINT "holes_player_id_round_players_fk" FOREIGN KEY ("player_id") REFERENCES "public"."round_players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holes"
    ADD CONSTRAINT "holes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_custom_map_id_fkey" FOREIGN KEY ("custom_map_id") REFERENCES "public"."custom_level_maps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."levels"
    ADD CONSTRAINT "levels_shared_by_user_id_fkey" FOREIGN KEY ("shared_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."map_battle_participants"
    ADD CONSTRAINT "map_battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."map_battles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battle_participants"
    ADD CONSTRAINT "map_battle_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battle_progress"
    ADD CONSTRAINT "map_battle_progress_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."map_battles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battle_progress"
    ADD CONSTRAINT "map_battle_progress_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battle_progress"
    ADD CONSTRAINT "map_battle_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battles"
    ADD CONSTRAINT "map_battles_base_map_id_fkey" FOREIGN KEY ("base_map_id") REFERENCES "public"."custom_level_maps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battles"
    ADD CONSTRAINT "map_battles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."map_battles"
    ADD CONSTRAINT "map_battles_winner_user_id_fkey" FOREIGN KEY ("winner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."match_play_games"
    ADD CONSTRAINT "match_play_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."match_play_games"
    ADD CONSTRAINT "match_play_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_play_games"
    ADD CONSTRAINT "match_play_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_play_holes"
    ADD CONSTRAINT "match_play_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."match_play_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nine_points_holes"
    ADD CONSTRAINT "nine_points_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."nine_points_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comment_likes"
    ADD CONSTRAINT "post_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comment_likes"
    ADD CONSTRAINT "post_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comment_replies"
    ADD CONSTRAINT "post_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comment_replies"
    ADD CONSTRAINT "post_comment_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_home_course_id_fkey" FOREIGN KEY ("home_course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."round_comment_likes"
    ADD CONSTRAINT "round_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."round_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."round_comment_replies"
    ADD CONSTRAINT "round_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."round_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."round_players"
    ADD CONSTRAINT "round_players_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."round_players"
    ADD CONSTRAINT "round_players_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scramble_games"
    ADD CONSTRAINT "scramble_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."scramble_games"
    ADD CONSTRAINT "scramble_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scramble_games"
    ADD CONSTRAINT "scramble_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scramble_holes"
    ADD CONSTRAINT "scramble_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."scramble_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendance"
    ADD CONSTRAINT "session_attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendance"
    ADD CONSTRAINT "session_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendance"
    ADD CONSTRAINT "session_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_drills"
    ADD CONSTRAINT "session_drills_coach_drill_id_fkey" FOREIGN KEY ("coach_drill_id") REFERENCES "public"."coach_drills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_drills"
    ADD CONSTRAINT "session_drills_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_invites"
    ADD CONSTRAINT "session_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_notes"
    ADD CONSTRAINT "session_notes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_responses"
    ADD CONSTRAINT "session_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_responses"
    ADD CONSTRAINT "session_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_scores"
    ADD CONSTRAINT "session_scores_drill_result_id_fkey" FOREIGN KEY ("drill_result_id") REFERENCES "public"."drill_results"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."session_scores"
    ADD CONSTRAINT "session_scores_session_drill_id_fkey" FOREIGN KEY ("session_drill_id") REFERENCES "public"."session_drills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_scores"
    ADD CONSTRAINT "session_scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."group_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_scores"
    ADD CONSTRAINT "session_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_templates"
    ADD CONSTRAINT "session_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_templates"
    ADD CONSTRAINT "session_templates_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sg_rounds"
    ADD CONSTRAINT "sg_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skins_games"
    ADD CONSTRAINT "skins_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."skins_games"
    ADD CONSTRAINT "skins_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."skins_games"
    ADD CONSTRAINT "skins_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."skins_holes"
    ADD CONSTRAINT "skins_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."skins_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_chat_reads"
    ADD CONSTRAINT "tournament_chat_reads_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_chat_reads"
    ADD CONSTRAINT "tournament_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_invites"
    ADD CONSTRAINT "tournament_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tournament_invites"
    ADD CONSTRAINT "tournament_invites_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."tournament_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_members"
    ADD CONSTRAINT "tournament_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_messages"
    ADD CONSTRAINT "tournament_messages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_point_config"
    ADD CONSTRAINT "tournament_point_config_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_round_contest_entries"
    ADD CONSTRAINT "tournament_round_contest_entries_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_round_points"
    ADD CONSTRAINT "tournament_round_points_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_rounds"
    ADD CONSTRAINT "tournament_rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_teams"
    ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_default_course_id_fkey" FOREIGN KEY ("default_course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umbriago_games"
    ADD CONSTRAINT "umbriago_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."umbriago_games"
    ADD CONSTRAINT "umbriago_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umbriago_games"
    ADD CONSTRAINT "umbriago_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."umbriago_holes"
    ADD CONSTRAINT "umbriago_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."umbriago_games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bucket_courses"
    ADD CONSTRAINT "user_bucket_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bucket_courses"
    ADD CONSTRAINT "user_bucket_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_conversation_settings"
    ADD CONSTRAINT "user_conversation_settings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_conversation_settings"
    ADD CONSTRAINT "user_conversation_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_level_progress"
    ADD CONSTRAINT "user_level_progress_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_level_progress"
    ADD CONSTRAINT "user_level_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_milestones"
    ADD CONSTRAINT "user_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ranked_courses"
    ADD CONSTRAINT "user_ranked_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ranked_courses"
    ADD CONSTRAINT "user_ranked_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wolf_games"
    ADD CONSTRAINT "wolf_games_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."wolf_games"
    ADD CONSTRAINT "wolf_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wolf_games"
    ADD CONSTRAINT "wolf_games_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."game_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wolf_holes"
    ADD CONSTRAINT "wolf_holes_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."wolf_games"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all for authenticated" ON "public"."banker_games" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all for authenticated" ON "public"."banker_hole_scores" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all for authenticated" ON "public"."banker_holes" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all for authenticated" ON "public"."banker_players" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all for authenticated" ON "public"."round_status" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can read comments" ON "public"."scorecard_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can read drill results" ON "public"."drill_results" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read likes" ON "public"."scorecard_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view likes" ON "public"."game_feed_likes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."game_feed_posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Auth users can insert comments" ON "public"."scorecard_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth users can insert likes" ON "public"."scorecard_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated can view milestones" ON "public"."user_milestones" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create friend conversations" ON "public"."conversations" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("type" = 'friend'::"text")));



CREATE POLICY "Authenticated users can insert course holes" ON "public"."course_holes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert courses" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read all drill results" ON "public"."drill_results" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read levels" ON "public"."levels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Coach can delete own notes" ON "public"."session_notes" FOR DELETE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coach can update own notes" ON "public"."session_notes" FOR UPDATE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can create session notes" ON "public"."session_notes" FOR INSERT WITH CHECK ((("auth"."uid"() = "coach_id") AND "public"."is_coach"("auth"."uid"())));



CREATE POLICY "Coaches can create sessions" ON "public"."group_sessions" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND (EXISTS ( SELECT 1
   FROM "public"."group_members"
  WHERE (("group_members"."group_id" = "group_sessions"."group_id") AND ("group_members"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'coach'::"text"))))));



CREATE POLICY "Coaches can create templates" ON "public"."session_templates" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_coach"("auth"."uid"())));



CREATE POLICY "Coaches can delete attendance" ON "public"."session_attendance" FOR DELETE USING (("auth"."uid"() = "marked_by"));



CREATE POLICY "Coaches can mark attendance" ON "public"."session_attendance" FOR INSERT WITH CHECK ((("auth"."uid"() = "marked_by") AND "public"."is_coach"("auth"."uid"())));



CREATE POLICY "Coaches can update attendance" ON "public"."session_attendance" FOR UPDATE USING (("auth"."uid"() = "marked_by"));



CREATE POLICY "Creators can add tournament members" ON "public"."tournament_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Creators can create tournament invites" ON "public"."tournament_invites" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Creators can delete own sessions" ON "public"."group_sessions" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Creators can delete their tournaments" ON "public"."tournaments" FOR DELETE TO "authenticated" USING ((("creator_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Creators can delete tournament rounds" ON "public"."tournament_rounds" FOR DELETE TO "authenticated" USING ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Creators can remove tournament members" ON "public"."tournament_members" FOR DELETE TO "authenticated" USING ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Creators can update their tournaments" ON "public"."tournaments" FOR UPDATE TO "authenticated" USING ((("creator_id")::"text" = ("auth"."uid"())::"text")) WITH CHECK ((("creator_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Creators can update tournament invites" ON "public"."tournament_invites" FOR UPDATE TO "authenticated" USING ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Creators can view tournament invites" ON "public"."tournament_invites" FOR SELECT TO "authenticated" USING ("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text"));



CREATE POLICY "Event creators can manage their events" ON "public"."events" USING (("auth"."uid"() = "creator_id")) WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "Event participants can view events" ON "public"."events" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."copenhagen_games"
  WHERE (("copenhagen_games"."event_id" = "events"."id") AND ("copenhagen_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."best_ball_games"
  WHERE (("best_ball_games"."event_id" = "events"."id") AND ("best_ball_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."match_play_games"
  WHERE (("match_play_games"."event_id" = "events"."id") AND ("match_play_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."scramble_games"
  WHERE (("scramble_games"."event_id" = "events"."id") AND ("scramble_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."skins_games"
  WHERE (("skins_games"."event_id" = "events"."id") AND ("skins_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."umbriago_games"
  WHERE (("umbriago_games"."event_id" = "events"."id") AND ("umbriago_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."wolf_games"
  WHERE (("wolf_games"."event_id" = "events"."id") AND ("wolf_games"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."rounds"
  WHERE (("rounds"."event_id" = "events"."id") AND ("rounds"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."rounds" "r"
     JOIN "public"."round_players" "rp" ON (("rp"."round_id" = "r"."id")))
  WHERE (("r"."event_id" = "events"."id") AND ("rp"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Friends can view holes in friends rounds" ON "public"."holes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "holes"."round_id") AND (("r"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "r"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "r"."user_id"))))))))));



CREATE POLICY "Friends can view round players" ON "public"."round_players" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "round_players"."round_id") AND (("r"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "r"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "r"."user_id"))))))))));



CREATE POLICY "Friends can view sg_rounds" ON "public"."sg_rounds" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."friendships"
  WHERE (("friendships"."status" = 'accepted'::"public"."friend_status") AND ((("friendships"."requester" = "auth"."uid"()) AND ("friendships"."addressee" = "sg_rounds"."user_id")) OR (("friendships"."addressee" = "auth"."uid"()) AND ("friendships"."requester" = "sg_rounds"."user_id"))))))));



CREATE POLICY "Game likes are viewable by everyone" ON "public"."game_likes" FOR SELECT USING (true);



CREATE POLICY "Group members can insert activity" ON "public"."group_activity" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_activity"."group_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Group members can read activity" ON "public"."group_activity" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "group_activity"."group_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Group members can read activity comments" ON "public"."group_activity_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."group_activity" "ga"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("ga"."id" = "group_activity_comments"."activity_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Group members can read activity likes" ON "public"."group_activity_likes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."group_activity" "ga"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("ga"."id" = "group_activity_likes"."activity_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Group members can read comment likes" ON "public"."group_activity_comment_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."group_activity_comments" "c"
     JOIN "public"."group_activity" "ga" ON (("ga"."id" = "c"."activity_id")))
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("c"."id" = "group_activity_comment_likes"."comment_id") AND ("gm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Group members can view attendance" ON "public"."session_attendance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_attendance"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"())) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id"))))));



CREATE POLICY "Group members can view session notes" ON "public"."session_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_notes"."session_id") AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")))));



CREATE POLICY "Group members can view sessions" ON "public"."group_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_members"
  WHERE (("group_members"."group_id" = "group_sessions"."group_id") AND ("group_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Group members can view templates" ON "public"."session_templates" FOR SELECT USING ("public"."is_group_member"("auth"."uid"(), "group_id"));



CREATE POLICY "Members can create tournament rounds" ON "public"."tournament_rounds" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text") OR "public"."is_tournament_member"(("tournament_id")::"text", ("auth"."uid"())::"text")));



CREATE POLICY "Members can update tournament rounds" ON "public"."tournament_rounds" FOR UPDATE TO "authenticated" USING (("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text") OR "public"."is_tournament_member"(("tournament_id")::"text", ("auth"."uid"())::"text")));



CREATE POLICY "Members can view tournament members" ON "public"."tournament_members" FOR SELECT TO "authenticated" USING (("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text") OR "public"."is_tournament_member"(("tournament_id")::"text", ("auth"."uid"())::"text")));



CREATE POLICY "Members can view tournament rounds" ON "public"."tournament_rounds" FOR SELECT TO "authenticated" USING (("public"."is_tournament_creator"(("tournament_id")::"text", ("auth"."uid"())::"text") OR "public"."is_tournament_member"(("tournament_id")::"text", ("auth"."uid"())::"text")));



CREATE POLICY "Participants can insert holes" ON "public"."holes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."round_players" "rp"
  WHERE (("rp"."round_id" = "holes"."round_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can update holes" ON "public"."holes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."round_players" "rp"
  WHERE (("rp"."round_id" = "holes"."round_id") AND ("rp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."round_players" "rp"
  WHERE (("rp"."round_id" = "holes"."round_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can update rounds they're in" ON "public"."rounds" FOR UPDATE USING ("public"."is_round_participant"("auth"."uid"(), "id")) WITH CHECK ("public"."is_round_participant"("auth"."uid"(), "id"));



CREATE POLICY "Participants can view their own round_players" ON "public"."round_players" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Players can delete own round_player" ON "public"."round_players" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Round owner can delete game_groups" ON "public"."game_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "game_groups"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can delete holes for all players" ON "public"."holes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "holes"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can delete round_players" ON "public"."round_players" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "round_players"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can delete round_status" ON "public"."round_status" FOR DELETE TO "authenticated" USING ("public"."is_round_owner"(("round_id")::"text"));



CREATE POLICY "Round owner can insert game_groups" ON "public"."game_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "game_groups"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can insert round_players" ON "public"."round_players" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "round_players"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can manage status" ON "public"."round_status" USING ((EXISTS ( SELECT 1
   FROM "public"."rounds"
  WHERE (("rounds"."id" = "round_status"."round_id") AND ("rounds"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rounds"
  WHERE (("rounds"."id" = "round_status"."round_id") AND ("rounds"."user_id" = "auth"."uid"())))));



CREATE POLICY "Round owner can update game_groups" ON "public"."game_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "game_groups"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Template creator can delete" ON "public"."session_templates" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Template creator can update" ON "public"."session_templates" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Tournament admins can manage groups" ON "public"."tournament_groups" USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text")))));



CREATE POLICY "Tournament admins can manage point config" ON "public"."tournament_point_config" USING ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."creator_id" = "auth"."uid"()))) OR ("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text")))))) WITH CHECK ((("tournament_id" IN ( SELECT "tournaments"."id"
   FROM "public"."tournaments"
  WHERE ("tournaments"."creator_id" = "auth"."uid"()))) OR ("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Tournament admins can manage round points" ON "public"."tournament_round_points" USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text")))));



CREATE POLICY "Tournament admins can manage teams" ON "public"."tournament_teams" USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text")))));



CREATE POLICY "Tournament admins can send announcements" ON "public"."tournament_messages" FOR INSERT WITH CHECK ((("channel" = 'announcement'::"text") AND ("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE (("tournament_members"."user_id" = "auth"."uid"()) AND ("tournament_members"."role" = 'admin'::"text")))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Tournament members can send general messages" ON "public"."tournament_messages" FOR INSERT WITH CHECK ((("channel" = 'general'::"text") AND ("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Tournament members can send team messages" ON "public"."tournament_messages" FOR INSERT WITH CHECK ((("channel" ~~ 'team_%'::"text") AND ("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Tournament members can view groups" ON "public"."tournament_groups" FOR SELECT USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tournament members can view messages" ON "public"."tournament_messages" FOR SELECT USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tournament members can view point config" ON "public"."tournament_point_config" FOR SELECT USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tournament members can view round points" ON "public"."tournament_round_points" FOR SELECT USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Tournament members can view teams" ON "public"."tournament_teams" FOR SELECT USING (("tournament_id" IN ( SELECT "tournament_members"."tournament_id"
   FROM "public"."tournament_members"
  WHERE ("tournament_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can add participants to conversations" ON "public"."conversation_participants" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "conversation_participants"."conversation_id") AND ("cp"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can add players to their rounds" ON "public"."round_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rounds" "r"
  WHERE (("r"."id" = "round_players"."round_id") AND ("r"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can comment on group activity" ON "public"."group_activity_comments" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."group_activity" "ga"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("ga"."id" = "group_activity_comments"."activity_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create banker games" ON "public"."banker_games" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can create own activity posts" ON "public"."activity_posts" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can create their own posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create tournaments" ON "public"."tournaments" FOR INSERT TO "authenticated" WITH CHECK ((("creator_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Users can delete banker hole scores" ON "public"."banker_hole_scores" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_hole_scores"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete banker holes" ON "public"."banker_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_holes"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete banker players" ON "public"."banker_players" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_players"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete best ball holes" ON "public"."best_ball_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."best_ball_games" "g"
  WHERE (("g"."id" = "best_ball_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_event_creator"("g"."event_id"))))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete best_ball_worst_ball_games" ON "public"."best_ball_worst_ball_games" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete best_ball_worst_ball_holes" ON "public"."best_ball_worst_ball_holes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."best_ball_worst_ball_games" "g"
  WHERE (("g"."id" = "best_ball_worst_ball_holes"."game_id") AND (("auth"."uid"() = "g"."created_by") OR ("auth"."uid"() = ANY ("g"."team_a_players")) OR ("auth"."uid"() = ANY ("g"."team_b_players")))))));



CREATE POLICY "Users can delete copenhagen holes" ON "public"."copenhagen_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."copenhagen_games" "g"
  WHERE (("g"."id" = "copenhagen_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete holes of their best ball taliban games" ON "public"."best_ball_taliban_holes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."best_ball_taliban_games" "g"
  WHERE (("g"."id" = "best_ball_taliban_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_round_participant"(("g"."id")::"text"))))));



CREATE POLICY "Users can delete match play holes" ON "public"."match_play_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."match_play_games" "g"
  WHERE (("g"."id" = "match_play_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete nine points holes" ON "public"."nine_points_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."nine_points_games" "g"
  WHERE (("g"."id" = "nine_points_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete nine_points holes" ON "public"."nine_points_holes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."nine_points_games"
  WHERE (("nine_points_games"."id" = "nine_points_holes"."game_id") AND ("nine_points_games"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own activity" ON "public"."group_activity" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own activity posts" ON "public"."activity_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own comments" ON "public"."group_activity_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own comments" ON "public"."scorecard_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own likes" ON "public"."game_feed_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own likes" ON "public"."scorecard_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts" ON "public"."game_feed_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own round_status" ON "public"."round_status" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete scramble holes" ON "public"."scramble_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."scramble_games" "g"
  WHERE (("g"."id" = "scramble_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete skins holes" ON "public"."skins_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."skins_games" "g"
  WHERE (("g"."id" = "skins_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete their own banker games" ON "public"."banker_games" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can delete their own best ball games" ON "public"."best_ball_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."round_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own copenhagen games" ON "public"."copenhagen_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own drill results" ON "public"."drill_results" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own favorite courses" ON "public"."favorite_courses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own favorites" ON "public"."user_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own level progress" ON "public"."user_level_progress" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own match play games" ON "public"."match_play_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own nine_points games" ON "public"."nine_points_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own posts" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reactions" ON "public"."post_likes" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own replies" ON "public"."post_comment_replies" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own replies" ON "public"."round_comment_replies" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own rounds" ON "public"."rounds" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own scramble games" ON "public"."scramble_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own skins games" ON "public"."skins_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own stats mode" ON "public"."player_game_stats_mode" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own umbriago games" ON "public"."umbriago_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own wolf games" ON "public"."wolf_games" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete umbriago holes" ON "public"."umbriago_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."umbriago_games" "g"
  WHERE (("g"."id" = "umbriago_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can delete wolf holes" ON "public"."wolf_holes" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."wolf_games" "g"
  WHERE (("g"."id" = "wolf_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert banker hole scores" ON "public"."banker_hole_scores" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_hole_scores"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert banker holes" ON "public"."banker_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_holes"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert banker players" ON "public"."banker_players" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_players"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert best ball holes" ON "public"."best_ball_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."best_ball_games" "g"
  WHERE (("g"."id" = "best_ball_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_event_creator"("g"."event_id"))))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert best_ball_worst_ball_games" ON "public"."best_ball_worst_ball_games" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can insert best_ball_worst_ball_holes" ON "public"."best_ball_worst_ball_holes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."best_ball_worst_ball_games" "g"
  WHERE (("g"."id" = "best_ball_worst_ball_holes"."game_id") AND (("auth"."uid"() = "g"."created_by") OR ("auth"."uid"() = ANY ("g"."team_a_players")) OR ("auth"."uid"() = ANY ("g"."team_b_players")))))));



CREATE POLICY "Users can insert copenhagen holes" ON "public"."copenhagen_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."copenhagen_games" "g"
  WHERE (("g"."id" = "copenhagen_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert holes" ON "public"."holes" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_write_hole"("round_id", "player_id"));



CREATE POLICY "Users can insert holes to their best ball taliban games" ON "public"."best_ball_taliban_holes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."best_ball_taliban_games" "g"
  WHERE (("g"."id" = "best_ball_taliban_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_round_participant"(("g"."id")::"text"))))));



CREATE POLICY "Users can insert likes" ON "public"."game_feed_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert match play holes" ON "public"."match_play_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."match_play_games" "g"
  WHERE (("g"."id" = "match_play_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_event_creator"("g"."event_id"))))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert messages in their conversations" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "c"."group_id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("gm"."user_id" = "auth"."uid"()))))) AND (NOT (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."conversation_participants" "cp_other" ON ((("cp_other"."conversation_id" = "c"."id") AND ("cp_other"."user_id" <> "auth"."uid"()))))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."type" = 'friend'::"text") AND "public"."is_blocked_either_way"("cp_other"."user_id")))))));



CREATE POLICY "Users can insert nine points holes" ON "public"."nine_points_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."nine_points_games" "g"
  WHERE (("g"."id" = "nine_points_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert nine_points holes" ON "public"."nine_points_holes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."nine_points_games"
  WHERE (("nine_points_games"."id" = "nine_points_holes"."game_id") AND ("nine_points_games"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own chat reads" ON "public"."tournament_chat_reads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own milestones" ON "public"."user_milestones" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert posts" ON "public"."game_feed_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert scramble holes" ON "public"."scramble_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."scramble_games" "g"
  WHERE (("g"."id" = "scramble_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert skins holes" ON "public"."skins_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."skins_games" "g"
  WHERE (("g"."id" = "skins_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert their own best ball games" ON "public"."best_ball_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own comments" ON "public"."round_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own copenhagen games" ON "public"."copenhagen_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own drill results" ON "public"."drill_results" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own favorite courses" ON "public"."favorite_courses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own favorites" ON "public"."user_favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own level progress" ON "public"."user_level_progress" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own match play games" ON "public"."match_play_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own nine_points games" ON "public"."nine_points_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notification preferences" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own round status" ON "public"."round_status" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can insert their own rounds" ON "public"."rounds" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own scramble games" ON "public"."scramble_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own skins games" ON "public"."skins_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own stats mode" ON "public"."player_game_stats_mode" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own umbriago games" ON "public"."umbriago_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own wolf games" ON "public"."wolf_games" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert umbriago holes" ON "public"."umbriago_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."umbriago_games" "g"
  WHERE (("g"."id" = "umbriago_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can insert wolf holes" ON "public"."wolf_holes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."wolf_games" "g"
  WHERE (("g"."id" = "wolf_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can like comments on accessible posts" ON "public"."post_comment_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."post_comments" "pc"
     JOIN "public"."posts" "p" ON (("p"."id" = "pc"."post_id")))
  WHERE (("pc"."id" = "post_comment_likes"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "Users can like comments on accessible rounds" ON "public"."round_comment_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."round_comments" "rc"
     JOIN "public"."rounds" "r" ON (("r"."id" = "rc"."round_id")))
  WHERE (("rc"."id" = "round_comment_likes"."comment_id") AND (("r"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "r"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "r"."user_id")))))))))));



CREATE POLICY "Users can like games as themselves" ON "public"."game_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can like group activity" ON "public"."group_activity_likes" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."group_activity" "ga"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("ga"."id" = "group_activity_likes"."activity_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can like group activity comments" ON "public"."group_activity_comment_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM (("public"."group_activity_comments" "c"
     JOIN "public"."group_activity" "ga" ON (("ga"."id" = "c"."activity_id")))
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "ga"."group_id")))
  WHERE (("c"."id" = "group_activity_comment_likes"."comment_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their own best_ball_taliban_games" ON "public"."best_ball_taliban_games" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can react to visible posts" ON "public"."post_likes" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_likes"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "Users can read all best_ball_taliban_games" ON "public"."best_ball_taliban_games" FOR SELECT USING (true);



CREATE POLICY "Users can read own chat reads" ON "public"."tournament_chat_reads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own and friends' level progress" ON "public"."user_level_progress" FOR SELECT TO "authenticated" USING ("public"."can_read_user_level_progress"("user_id"));



CREATE POLICY "Users can remove themselves from rounds" ON "public"."round_players" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can reply to comments on accessible posts" ON "public"."post_comment_replies" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."post_comments" "pc"
     JOIN "public"."posts" "p" ON (("p"."id" = "pc"."post_id")))
  WHERE (("pc"."id" = "post_comment_replies"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "Users can reply to comments on accessible rounds" ON "public"."round_comment_replies" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."round_comments" "rc"
  WHERE ("rc"."id" = "round_comment_replies"."comment_id")))));



CREATE POLICY "Users can unlike group activity" ON "public"."group_activity_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike group activity comments" ON "public"."group_activity_comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their own game likes" ON "public"."game_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their own likes" ON "public"."post_comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their own likes" ON "public"."round_comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update banker games" ON "public"."banker_games" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update banker hole scores" ON "public"."banker_hole_scores" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_hole_scores"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update banker holes" ON "public"."banker_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_holes"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update banker players" ON "public"."banker_players" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_players"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update best ball games" ON "public"."best_ball_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_event_creator"("event_id")));



CREATE POLICY "Users can update best ball holes" ON "public"."best_ball_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."best_ball_games" "g"
  WHERE (("g"."id" = "best_ball_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_event_creator"("g"."event_id"))))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update best_ball_worst_ball_games they are in" ON "public"."best_ball_worst_ball_games" FOR UPDATE USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() = ANY ("team_a_players")) OR ("auth"."uid"() = ANY ("team_b_players"))));



CREATE POLICY "Users can update best_ball_worst_ball_holes" ON "public"."best_ball_worst_ball_holes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."best_ball_worst_ball_games" "g"
  WHERE (("g"."id" = "best_ball_worst_ball_holes"."game_id") AND (("auth"."uid"() = "g"."created_by") OR ("auth"."uid"() = ANY ("g"."team_a_players")) OR ("auth"."uid"() = ANY ("g"."team_b_players")))))));



CREATE POLICY "Users can update copenhagen games" ON "public"."copenhagen_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update copenhagen holes" ON "public"."copenhagen_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."copenhagen_games" "g"
  WHERE (("g"."id" = "copenhagen_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update holes" ON "public"."holes" FOR UPDATE TO "authenticated" USING ("public"."can_write_hole"("round_id", "player_id")) WITH CHECK ("public"."can_write_hole"("round_id", "player_id"));



CREATE POLICY "Users can update holes of their best ball taliban games" ON "public"."best_ball_taliban_holes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."best_ball_taliban_games" "g"
  WHERE (("g"."id" = "best_ball_taliban_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_round_participant"(("g"."id")::"text"))))));



CREATE POLICY "Users can update match play games" ON "public"."match_play_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_event_creator"("event_id")));



CREATE POLICY "Users can update match play holes" ON "public"."match_play_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."match_play_games" "g"
  WHERE (("g"."id" = "match_play_holes"."game_id") AND (("g"."user_id" = "auth"."uid"()) OR "public"."is_event_creator"("g"."event_id"))))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update nine points games" ON "public"."nine_points_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update nine points holes" ON "public"."nine_points_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."nine_points_games" "g"
  WHERE (("g"."id" = "nine_points_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update nine_points holes" ON "public"."nine_points_holes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."nine_points_games"
  WHERE (("nine_points_games"."id" = "nine_points_holes"."game_id") AND ("nine_points_games"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own chat reads" ON "public"."tournament_chat_reads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own comments" ON "public"."post_comments" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own milestones" ON "public"."user_milestones" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."game_feed_posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update scramble games" ON "public"."scramble_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update scramble holes" ON "public"."scramble_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."scramble_games" "g"
  WHERE (("g"."id" = "scramble_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update skins games" ON "public"."skins_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update skins holes" ON "public"."skins_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."skins_games" "g"
  WHERE (("g"."id" = "skins_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update their conversations" ON "public"."conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "conversations"."id") AND ("cp"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own drill results" ON "public"."drill_results" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own nine_points games" ON "public"."nine_points_games" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notification preferences" ON "public"."notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reactions" ON "public"."post_likes" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own round status" ON "public"."round_status" FOR UPDATE TO "authenticated" USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update their own rounds" ON "public"."rounds" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own stats mode" ON "public"."player_game_stats_mode" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update umbriago games" ON "public"."umbriago_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update umbriago holes" ON "public"."umbriago_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."umbriago_games" "g"
  WHERE (("g"."id" = "umbriago_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can update wolf games" ON "public"."wolf_games" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text")));



CREATE POLICY "Users can update wolf holes" ON "public"."wolf_holes" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."wolf_games" "g"
  WHERE (("g"."id" = "wolf_holes"."game_id") AND ("g"."user_id" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can view banker games" ON "public"."banker_games" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("created_by") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view banker hole scores" ON "public"."banker_hole_scores" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_hole_scores"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can view banker holes" ON "public"."banker_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view banker players" ON "public"."banker_players" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."banker_games" "g"
  WHERE ((("g"."id")::"text" = ("banker_players"."game_id")::"text") AND ("g"."created_by" = "auth"."uid"())))) OR "public"."can_access_game"(("game_id")::"text")));



CREATE POLICY "Users can view best ball games" ON "public"."best_ball_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view best ball holes" ON "public"."best_ball_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view best ball worst ball games" ON "public"."best_ball_worst_ball_games" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("created_by") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view best_ball_taliban_holes" ON "public"."best_ball_taliban_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view best_ball_worst_ball_games they are in" ON "public"."best_ball_worst_ball_games" FOR SELECT USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() = ANY ("team_a_players")) OR ("auth"."uid"() = ANY ("team_b_players"))));



CREATE POLICY "Users can view best_ball_worst_ball_holes" ON "public"."best_ball_worst_ball_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view conversations they're part of" ON "public"."conversation_participants" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view copenhagen games" ON "public"."copenhagen_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view copenhagen holes" ON "public"."copenhagen_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view game groups" ON "public"."game_groups" FOR SELECT USING ("public"."can_read_round"("round_id"));



CREATE POLICY "Users can view holes" ON "public"."holes" FOR SELECT USING ("public"."can_read_hole"("round_id"));



CREATE POLICY "Users can view likes on accessible comments" ON "public"."post_comment_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."post_comments" "pc"
     JOIN "public"."posts" "p" ON (("p"."id" = "pc"."post_id")))
  WHERE (("pc"."id" = "post_comment_likes"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



CREATE POLICY "Users can view likes on accessible comments" ON "public"."round_comment_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."round_comments" "rc"
  WHERE (("rc"."id" = "round_comment_likes"."comment_id") AND (("rc"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."rounds" "r"
          WHERE (("r"."id" = "rc"."round_id") AND (("r"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
                   FROM "public"."friends_pairs" "fp"
                  WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "r"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "r"."user_id"))))))))))))));



CREATE POLICY "Users can view match play games" ON "public"."match_play_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view match play holes" ON "public"."match_play_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING ((((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."conversations" "c"
     JOIN "public"."group_members" "gm" ON (("gm"."group_id" = "c"."group_id")))
  WHERE (("c"."id" = "messages"."conversation_id") AND ("gm"."user_id" = "auth"."uid"()))))) AND (NOT "public"."is_blocked_either_way"("sender_id"))));



CREATE POLICY "Users can view nine points games" ON "public"."nine_points_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view nine points holes" ON "public"."nine_points_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view nine_points holes" ON "public"."nine_points_holes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."nine_points_games"
  WHERE (("nine_points_games"."id" = "nine_points_holes"."game_id") AND ("nine_points_games"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own and friends activity posts" ON "public"."activity_posts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_friend_of"("user_id") OR (EXISTS ( SELECT 1
   FROM "jsonb_array_elements_text"(("activity_posts"."metadata" -> 'participant_ids'::"text")) "pid"("value")
  WHERE (("pid"."value" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'::"text") AND "public"."is_friend_of"(("pid"."value")::"uuid"))))));



CREATE POLICY "Users can view reactions on visible posts" ON "public"."post_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_likes"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



CREATE POLICY "Users can view replies on accessible comments" ON "public"."post_comment_replies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."post_comments" "pc"
     JOIN "public"."posts" "p" ON (("p"."id" = "pc"."post_id")))
  WHERE (("pc"."id" = "post_comment_replies"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



CREATE POLICY "Users can view replies on accessible comments" ON "public"."round_comment_replies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."round_comments" "rc"
  WHERE ("rc"."id" = "round_comment_replies"."comment_id"))));



CREATE POLICY "Users can view round comments" ON "public"."round_comments" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_read_round"("round_id") OR "public"."can_access_game"(("round_id")::"text")));



CREATE POLICY "Users can view round players" ON "public"."round_players" FOR SELECT USING ("public"."can_read_round"("round_id"));



CREATE POLICY "Users can view round_status" ON "public"."round_status" FOR SELECT USING ("public"."can_read_round_status"("round_id", "user_id"));



CREATE POLICY "Users can view rounds" ON "public"."rounds" FOR SELECT USING ("public"."can_read_round"("id"));



CREATE POLICY "Users can view scramble games" ON "public"."scramble_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view scramble holes" ON "public"."scramble_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view skins games" ON "public"."skins_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view skins holes" ON "public"."skins_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "conversations"."id") AND ("cp"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm"
  WHERE (("gm"."group_id" = "conversations"."group_id") AND ("gm"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own and friends posts" ON "public"."posts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."friends_pairs" "fp"
  WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "posts"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "posts"."user_id")))))));



CREATE POLICY "Users can view their own favorite courses" ON "public"."favorite_courses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own favorites" ON "public"."user_favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own nine_points games" ON "public"."nine_points_games" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notification preferences" ON "public"."notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own stats mode" ON "public"."player_game_stats_mode" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view tournaments they created or belong to" ON "public"."tournaments" FOR SELECT TO "authenticated" USING (((("creator_id")::"text" = ("auth"."uid"())::"text") OR "public"."is_tournament_member"(("id")::"text", ("auth"."uid"())::"text")));



CREATE POLICY "Users can view umbriago games" ON "public"."umbriago_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view umbriago holes" ON "public"."umbriago_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users can view wolf games" ON "public"."wolf_games" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."can_access_game"(("id")::"text") OR "public"."is_friend_of"("user_id") OR "public"."is_friend_of_game_participant"(("id")::"text")));



CREATE POLICY "Users can view wolf holes" ON "public"."wolf_holes" FOR SELECT USING ("public"."can_read_game_hole"(("game_id")::"text"));



CREATE POLICY "Users manage own tokens" ON "public"."device_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."_debug_round_status_deletes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banker_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banker_hole_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banker_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."banker_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_taliban_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_taliban_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_worst_ball_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."best_ball_worst_ball_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blocks_delete_own" ON "public"."blocks" FOR DELETE USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "blocks_insert_own" ON "public"."blocks" FOR INSERT WITH CHECK (("auth"."uid"() = "blocker_id"));



CREATE POLICY "blocks_select_own" ON "public"."blocks" FOR SELECT USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "bucket_delete_own" ON "public"."user_bucket_courses" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bucket_insert_own" ON "public"."user_bucket_courses" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bucket_select_all_authenticated" ON "public"."user_bucket_courses" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."coach_ai_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_drill_generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_drills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_drills_delete_own" ON "public"."coach_drills" FOR DELETE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_drills_insert_own" ON "public"."coach_drills" FOR INSERT WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_drills_select_own" ON "public"."coach_drills" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_drills_update_own" ON "public"."coach_drills" FOR UPDATE USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "contest_entries_insert_own" ON "public"."tournament_round_contest_entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "contest_entries_read" ON "public"."tournament_round_contest_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tournament_members" "tm"
  WHERE (("tm"."tournament_id" = "tournament_round_contest_entries"."tournament_id") AND ("tm"."user_id" = "auth"."uid"())))));



CREATE POLICY "contest_entries_update_own" ON "public"."tournament_round_contest_entries" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."copenhagen_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."copenhagen_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_hole_distances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_hole_distances_select_all" ON "public"."course_hole_distances" FOR SELECT USING (true);



ALTER TABLE "public"."course_holes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_holes_read_all" ON "public"."course_holes" FOR SELECT USING (true);



ALTER TABLE "public"."course_tees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "course_tees_select_all" ON "public"."course_tees" FOR SELECT USING (true);



ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courses_read_all" ON "public"."courses" FOR SELECT USING (true);



ALTER TABLE "public"."custom_level_maps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "custom_level_maps_delete_own" ON "public"."custom_level_maps" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "custom_level_maps_insert_own" ON "public"."custom_level_maps" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "custom_level_maps_select_own" ON "public"."custom_level_maps" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "custom_level_maps_update_own" ON "public"."custom_level_maps" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drill_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "drills_read_all" ON "public"."drills" FOR SELECT USING (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorite_courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert_own" ON "public"."coach_ai_feedback" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "feedback_select_own" ON "public"."coach_ai_feedback" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "feedback_update_own" ON "public"."coach_ai_feedback" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_delete_involving_me" ON "public"."friendships" FOR DELETE USING ((("auth"."uid"() = "requester") OR ("auth"."uid"() = "addressee") OR ("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



CREATE POLICY "friendships_insert_no_blocks" ON "public"."friendships" FOR INSERT WITH CHECK ((("auth"."uid"() = "requester") AND (NOT "public"."is_blocked_either_way"("addressee"))));



CREATE POLICY "friendships_insert_self" ON "public"."friendships" FOR INSERT WITH CHECK (("auth"."uid"() = "requester"));



CREATE POLICY "friendships_read_member" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")));



CREATE POLICY "friendships_select_involving_me" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "requester") OR ("auth"."uid"() = "addressee")));



CREATE POLICY "friendships_update_involving_me" ON "public"."friendships" FOR UPDATE USING ((("auth"."uid"() = "requester") OR ("auth"."uid"() = "addressee"))) WITH CHECK ((("auth"."uid"() = "requester") OR ("auth"."uid"() = "addressee")));



ALTER TABLE "public"."game_feed_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_feed_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_activity_comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_activity_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_activity_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_challenges_delete_manager" ON "public"."group_challenges" FOR DELETE TO "authenticated" USING (("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"()))));



CREATE POLICY "group_challenges_insert_manager" ON "public"."group_challenges" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))));



CREATE POLICY "group_challenges_select_member" ON "public"."group_challenges" FOR SELECT TO "authenticated" USING ("public"."is_group_member"("auth"."uid"(), "group_id"));



CREATE POLICY "group_challenges_update_manager" ON "public"."group_challenges" FOR UPDATE TO "authenticated" USING (("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))) WITH CHECK (("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"()))));



ALTER TABLE "public"."group_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_invites_delete_owner_admin" ON "public"."group_invites" FOR DELETE TO "authenticated" USING ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id"));



CREATE POLICY "group_invites_insert_owner_admin" ON "public"."group_invites" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "created_by") AND "public"."is_group_owner_or_admin"("auth"."uid"(), "group_id")));



CREATE POLICY "group_invites_select_owner_admin" ON "public"."group_invites" FOR SELECT TO "authenticated" USING ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id"));



CREATE POLICY "group_invites_update_owner_admin" ON "public"."group_invites" FOR UPDATE TO "authenticated" USING ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id")) WITH CHECK ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id"));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members_delete_safe" ON "public"."group_members" FOR DELETE TO "authenticated" USING (("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "group_members_insert_safe" ON "public"."group_members" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."groups"
  WHERE (("groups"."id" = "group_members"."group_id") AND ("groups"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."group_members" "gm_check"
  WHERE (("gm_check"."group_id" = "group_members"."group_id") AND ("gm_check"."user_id" = "auth"."uid"()) AND ("gm_check"."role" = ANY (ARRAY['owner'::"public"."group_role", 'admin'::"public"."group_role"])))))));



CREATE POLICY "group_members_select_safe" ON "public"."group_members" FOR SELECT TO "authenticated" USING ("public"."is_group_member"("auth"."uid"(), "group_id"));



CREATE POLICY "group_members_update_safe" ON "public"."group_members" FOR UPDATE TO "authenticated" USING ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id")) WITH CHECK ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id"));



ALTER TABLE "public"."group_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_sessions_delete_coach_or_admin" ON "public"."group_sessions" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ((("group_id" IS NOT NULL) AND ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))) OR (("group_id" IS NULL) AND "public"."is_coach"("auth"."uid"())))));



CREATE POLICY "group_sessions_insert_coach_or_admin" ON "public"."group_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ((("group_id" IS NOT NULL) AND ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))) OR (("group_id" IS NULL) AND "public"."is_coach"("auth"."uid"())))));



CREATE POLICY "group_sessions_select_member" ON "public"."group_sessions" FOR SELECT TO "authenticated" USING (((("group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "group_id")) OR "public"."is_session_invited"("auth"."uid"(), "id") OR (("group_id" IS NULL) AND ("created_by" = "auth"."uid"()))));



CREATE POLICY "group_sessions_update_creator" ON "public"."group_sessions" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND ((("group_id" IS NOT NULL) AND ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))) OR (("group_id" IS NULL) AND "public"."is_coach"("auth"."uid"()))))) WITH CHECK ((("created_by" = "auth"."uid"()) AND ((("group_id" IS NOT NULL) AND ("public"."is_group_owner_or_admin"("auth"."uid"(), "group_id") OR ("public"."is_group_member"("auth"."uid"(), "group_id") AND "public"."is_coach"("auth"."uid"())))) OR (("group_id" IS NULL) AND "public"."is_coach"("auth"."uid"())))));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_delete_owner" ON "public"."groups" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "groups_insert_authenticated" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "groups_select_owner_or_member" ON "public"."groups" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_group_member"("auth"."uid"(), "id")));



CREATE POLICY "groups_update_members" ON "public"."groups" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_members"
  WHERE (("group_members"."group_id" = "groups"."id") AND ("group_members"."user_id" = "auth"."uid"())))))) WITH CHECK ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_members"
  WHERE (("group_members"."group_id" = "groups"."id") AND ("group_members"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "levels_delete_own_custom" ON "public"."levels" FOR DELETE USING ((("created_by" IS NOT NULL) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "levels_select_builtin" ON "public"."levels" FOR SELECT USING (("created_by" IS NULL));



CREATE POLICY "levels_select_in_battle" ON "public"."levels" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."map_battles" "b"
  WHERE (("levels"."id" = ANY ("b"."level_ids")) AND "public"."is_active_battle_participant"("b"."id", "auth"."uid"())))));



CREATE POLICY "levels_select_own_custom" ON "public"."levels" FOR SELECT USING ((("created_by" IS NOT NULL) AND ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."map_battle_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "map_battle_participants_insert_self" ON "public"."map_battle_participants" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "map_battle_participants_select_visible" ON "public"."map_battle_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_active_battle_participant"("battle_id", "auth"."uid"()) OR "public"."is_battle_owner"("battle_id", "auth"."uid"())));



CREATE POLICY "map_battle_participants_update_self" ON "public"."map_battle_participants" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."map_battle_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "map_battle_progress_insert_self" ON "public"."map_battle_progress" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "map_battle_progress_select_visible" ON "public"."map_battle_progress" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."map_battle_participants" "p"
  WHERE (("p"."battle_id" = "map_battle_progress"."battle_id") AND ("p"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."map_battles" "b"
  WHERE (("b"."id" = "map_battle_progress"."battle_id") AND ("b"."owner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."map_battles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "map_battles_delete_own" ON "public"."map_battles" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "map_battles_insert_own" ON "public"."map_battles" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "map_battles_select_visible" ON "public"."map_battles" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."map_battle_participants" "p"
  WHERE (("p"."battle_id" = "map_battles"."id") AND ("p"."user_id" = "auth"."uid"()))))));



CREATE POLICY "map_battles_update_own" ON "public"."map_battles" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."match_play_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_play_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete_own" ON "public"."messages" FOR DELETE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_update_own" ON "public"."messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "messages"."conversation_id") AND ("cp"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."nine_points_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nine_points_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_settings" ON "public"."user_conversation_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."player_game_stats_mode" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_comment_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_comment_likes_delete_policy" ON "public"."post_comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_comment_likes_insert_policy" ON "public"."post_comment_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."post_comments" "c"
     JOIN "public"."posts" "p" ON (("p"."id" = "c"."post_id")))
  WHERE (("c"."id" = "post_comment_likes"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "post_comment_likes_select_policy" ON "public"."post_comment_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."post_comments" "c"
     JOIN "public"."posts" "p" ON (("p"."id" = "c"."post_id")))
  WHERE (("c"."id" = "post_comment_likes"."comment_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



ALTER TABLE "public"."post_comment_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_comments_delete_policy" ON "public"."post_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_comments_insert_policy" ON "public"."post_comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_comments"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "post_comments_select_policy" ON "public"."post_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_comments"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_likes_delete_policy" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "post_likes_insert_policy" ON "public"."post_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_likes"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id")))))))))));



CREATE POLICY "post_likes_select_policy" ON "public"."post_likes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."posts" "p"
  WHERE (("p"."id" = "post_likes"."post_id") AND (("p"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."friends_pairs" "fp"
          WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "p"."user_id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "p"."user_id"))))))))));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pro_stats_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pro_stats_rounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_read_all_authenticated" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("id" = "auth"."uid"()) OR (NOT "public"."is_blocked_either_way"("id")))));



CREATE POLICY "profiles_read_friends" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."friends_pairs" "fp"
  WHERE ((("fp"."a" = "auth"."uid"()) AND ("fp"."b" = "profiles"."id")) OR (("fp"."b" = "auth"."uid"()) AND ("fp"."a" = "profiles"."id"))))));



CREATE POLICY "profiles_read_game_coparticipants" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."round_status" "rs1"
     JOIN "public"."round_status" "rs2" ON (("rs2"."round_id" = "rs1"."round_id")))
  WHERE (("rs1"."user_id" = "auth"."uid"()) AND ("rs2"."user_id" = "profiles"."id")))));



CREATE POLICY "profiles_read_group_members" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."group_members" "gm1"
     JOIN "public"."group_members" "gm2" ON (("gm2"."group_id" = "gm1"."group_id")))
  WHERE (("gm1"."user_id" = "auth"."uid"()) AND ("gm2"."user_id" = "profiles"."id")))));



CREATE POLICY "profiles_read_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_read_pending_requests" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."friendships" "f"
  WHERE (("f"."status" = 'pending'::"public"."friend_status") AND ((("f"."requester" = "auth"."uid"()) AND ("f"."addressee" = "profiles"."id")) OR (("f"."addressee" = "auth"."uid"()) AND ("f"."requester" = "profiles"."id")))))));



CREATE POLICY "profiles_read_public" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "profiles_read_round_participants" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."round_players" "rp1"
     JOIN "public"."round_players" "rp2" ON (("rp2"."round_id" = "rp1"."round_id")))
  WHERE (("rp1"."user_id" = "auth"."uid"()) AND ("rp2"."user_id" = "profiles"."id")))));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "ps_holes_insert_own" ON "public"."pro_stats_holes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pro_stats_rounds" "pr"
  WHERE (("pr"."id" = "pro_stats_holes"."pro_round_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "ps_holes_select_own" ON "public"."pro_stats_holes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pro_stats_rounds" "pr"
  WHERE (("pr"."id" = "pro_stats_holes"."pro_round_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "ps_holes_update_own" ON "public"."pro_stats_holes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pro_stats_rounds" "pr"
  WHERE (("pr"."id" = "pro_stats_holes"."pro_round_id") AND ("pr"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pro_stats_rounds" "pr"
  WHERE (("pr"."id" = "pro_stats_holes"."pro_round_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "ps_rounds_delete_own" ON "public"."pro_stats_rounds" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ps_rounds_insert_own" ON "public"."pro_stats_rounds" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ps_rounds_select_own" ON "public"."pro_stats_rounds" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ps_rounds_update_own" ON "public"."pro_stats_rounds" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ranked_delete_own" ON "public"."user_ranked_courses" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ranked_insert_own" ON "public"."user_ranked_courses" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ranked_select_all_authenticated" ON "public"."user_ranked_courses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ranked_update_own" ON "public"."user_ranked_courses" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."round_comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."round_comment_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."round_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."round_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."round_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rounds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scorecard_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scorecard_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scramble_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scramble_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_drills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_drills_delete_manager" ON "public"."session_drills" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_drills"."session_id") AND ("gs"."created_by" = "auth"."uid"())))));



CREATE POLICY "session_drills_insert_manager" ON "public"."session_drills" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_drills"."session_id") AND ("gs"."created_by" = "auth"."uid"())))));



CREATE POLICY "session_drills_select_member" ON "public"."session_drills" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_drills"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"())) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id"))))));



CREATE POLICY "session_drills_update_manager" ON "public"."session_drills" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_drills"."session_id") AND ("gs"."created_by" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_drills"."session_id") AND ("gs"."created_by" = "auth"."uid"())))));



ALTER TABLE "public"."session_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_invites_delete_coach" ON "public"."session_invites" FOR DELETE TO "authenticated" USING ("public"."is_session_coach"("auth"."uid"(), "session_id"));



CREATE POLICY "session_invites_insert_coach" ON "public"."session_invites" FOR INSERT TO "authenticated" WITH CHECK ((("invited_by" = "auth"."uid"()) AND "public"."is_session_coach"("auth"."uid"(), "session_id")));



CREATE POLICY "session_invites_select" ON "public"."session_invites" FOR SELECT TO "authenticated" USING ((("invited_user_id" = "auth"."uid"()) OR ("invited_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_invites"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"()))))))));



CREATE POLICY "session_invites_update" ON "public"."session_invites" FOR UPDATE TO "authenticated" USING ((("invited_user_id" = "auth"."uid"()) OR "public"."is_session_coach"("auth"."uid"(), "session_id"))) WITH CHECK ((("invited_user_id" = "auth"."uid"()) OR "public"."is_session_coach"("auth"."uid"(), "session_id")));



ALTER TABLE "public"."session_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_responses_delete_own" ON "public"."session_responses" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "session_responses_insert" ON "public"."session_responses" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_responses"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"())) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id")))))));



CREATE POLICY "session_responses_select" ON "public"."session_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_responses"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"())) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id"))))));



CREATE POLICY "session_responses_update_own" ON "public"."session_responses" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."session_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_scores_insert_member" ON "public"."session_scores" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_scores"."session_id") AND ("gs"."status" = ANY (ARRAY['scheduled'::"text", 'open'::"text"])) AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR ("gs"."created_by" = "auth"."uid"()) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id")))))));



CREATE POLICY "session_scores_select_member" ON "public"."session_scores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."group_sessions" "gs"
  WHERE (("gs"."id" = "session_scores"."session_id") AND ((("gs"."group_id" IS NOT NULL) AND "public"."is_group_member"("auth"."uid"(), "gs"."group_id")) OR (("gs"."group_id" IS NULL) AND ("gs"."created_by" = "auth"."uid"())) OR "public"."is_session_invited"("auth"."uid"(), "gs"."id"))))));



CREATE POLICY "session_scores_update_own" ON "public"."session_scores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."session_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sg_rounds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sg_rounds_delete_own" ON "public"."sg_rounds" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "sg_rounds_insert_own" ON "public"."sg_rounds" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "sg_rounds_update_own" ON "public"."sg_rounds" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."skins_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skins_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_chat_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_invites_creator_all" ON "public"."tournament_invites" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_invites"."tournament_id") AND ("t"."creator_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_invites"."tournament_id") AND ("t"."creator_id" = "auth"."uid"())))));



ALTER TABLE "public"."tournament_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_members_creator_all" ON "public"."tournament_members" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_members"."tournament_id") AND ("t"."creator_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_members"."tournament_id") AND ("t"."creator_id" = "auth"."uid"())))));



CREATE POLICY "tournament_members_member_select" ON "public"."tournament_members" FOR SELECT USING ("public"."is_tournament_member"("tournament_id", "auth"."uid"()));



ALTER TABLE "public"."tournament_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_point_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_round_contest_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_round_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_rounds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_rounds_creator_all" ON "public"."tournament_rounds" USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_rounds"."tournament_id") AND ("t"."creator_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "tournament_rounds"."tournament_id") AND ("t"."creator_id" = "auth"."uid"())))));



CREATE POLICY "tournament_rounds_member_select" ON "public"."tournament_rounds" FOR SELECT USING (("public"."is_tournament_member"("tournament_id", "auth"."uid"()) OR "public"."is_tournament_creator"("tournament_id", "auth"."uid"())));



ALTER TABLE "public"."tournament_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_creator_all" ON "public"."tournaments" USING (("auth"."uid"() = "creator_id")) WITH CHECK (("auth"."uid"() = "creator_id"));



CREATE POLICY "tournaments_member_select" ON "public"."tournaments" FOR SELECT USING ("public"."is_tournament_member"("id", "auth"."uid"()));



ALTER TABLE "public"."umbriago_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."umbriago_holes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_bucket_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_conversation_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_level_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_ranked_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_settings_self_rw" ON "public"."user_settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."wolf_games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wolf_holes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_debug_log_round_status_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."_debug_log_round_status_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_debug_log_round_status_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_group_invite"("invite_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_group_invite"("invite_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_group_invite"("invite_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_tournament_invite"("invite_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_tournament_invite"("invite_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_tournament_invite"("invite_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_remove_played_from_bucket"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_remove_played_from_bucket"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_remove_played_from_bucket"() TO "service_role";



GRANT ALL ON FUNCTION "public"."best_ball_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."best_ball_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."best_ball_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."block_user"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."block_user"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_user"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_post_scorecard_snapshot"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_post_scorecard_snapshot"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_post_scorecard_snapshot"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_game"("_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_game"("_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_game"("_game_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_game_hole"("_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_game_hole"("_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_game_hole"("_game_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_hole"("_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_hole"("_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_hole"("_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_round"("_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_round"("_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_round"("_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_round_status"("_round_id" "uuid", "_row_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_round_status"("_round_id" "uuid", "_row_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_round_status"("_round_id" "uuid", "_row_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_user_level_progress"("p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_user_level_progress"("p_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_user_level_progress"("p_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_write_hole"("_round_id" "uuid", "_player_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_write_hole"("_round_id" "uuid", "_player_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write_hole"("_round_id" "uuid", "_player_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_favourite_groups_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_favourite_groups_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_favourite_groups_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_device_token_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_device_token_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_device_token_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_notification_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_notification_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_notification_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_expired_battles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_expired_battles"() TO "anon";
GRANT ALL ON FUNCTION "public"."close_expired_battles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_expired_battles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."conversations_overview"() TO "anon";
GRANT ALL ON FUNCTION "public"."conversations_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."conversations_overview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows_rpc"("p_drill_id" "uuid", "p_attempts_json" "jsonb", "p_exclude_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows_rpc"("p_drill_id" "uuid", "p_attempts_json" "jsonb", "p_exclude_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_21_points_participant_rows_rpc"("p_drill_id" "uuid", "p_attempts_json" "jsonb", "p_exclude_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_drill_high_score_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_drill_high_score_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_drill_high_score_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_group_chat"("p_name" "text", "p_participant_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_group_chat"("p_name" "text", "p_participant_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_group_chat"("p_name" "text", "p_participant_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_round"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_round"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_round"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_round_activity_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_round_activity_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_round_activity_post"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_tournament_round"("p_tr_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_friend_conversation"("friend_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_friend_conversation"("friend_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_friend_conversation"("friend_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_friendship"("u1" "uuid", "u2" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_friendship"("u1" "uuid", "u2" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_friendship"("u1" "uuid", "u2" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_friendship_by_pair"("u1" "uuid", "u2" "uuid", "ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_friendship_by_pair"("u1" "uuid", "u2" "uuid", "ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_friendship_by_pair"("u1" "uuid", "u2" "uuid", "ts" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_group_conversation"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_group_conversation"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_group_conversation"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_notification_preferences"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_profile"("p_user_id" "uuid", "p_email" "text", "p_display_name" "text", "p_handicap" "text", "p_home_club" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile"("p_user_id" "uuid", "p_email" "text", "p_display_name" "text", "p_handicap" "text", "p_home_club" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile"("p_user_id" "uuid", "p_email" "text", "p_display_name" "text", "p_handicap" "text", "p_home_club" "text", "p_country" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."favourite_group_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."favourite_group_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."favourite_group_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."favourite_groups_level_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."favourite_groups_level_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."favourite_groups_level_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."friends_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."friends_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."friends_leaderboard_for_drill_by_title"("p_drill_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."friends_level_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."friends_level_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."friends_level_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_hole_averages"("p_user_id" "uuid", "p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_course_hole_averages"("p_user_id" "uuid", "p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_course_hole_averages"("p_user_id" "uuid", "p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_score_distribution"("p_user_id" "uuid", "p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_course_score_distribution"("p_user_id" "uuid", "p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_course_score_distribution"("p_user_id" "uuid", "p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_scoring_overview"("p_user_id" "uuid", "p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_course_scoring_overview"("p_user_id" "uuid", "p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_course_scoring_overview"("p_user_id" "uuid", "p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_tees_with_distances"("p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_course_tees_with_distances"("p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_course_tees_with_distances"("p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dream_round"("p_user_id" "uuid", "p_course_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dream_round"("p_user_id" "uuid", "p_course_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dream_round"("p_user_id" "uuid", "p_course_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friend_stats_aggregate"("p_user_id" "uuid", "p_min_rounds" integer, "p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friend_stats_aggregate"("p_user_id" "uuid", "p_min_rounds" integer, "p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friend_stats_aggregate"("p_user_id" "uuid", "p_min_rounds" integer, "p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friends_for_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_friends_for_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friends_for_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_courses"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_courses"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_courses"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_played_courses_with_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_played_courses_with_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_played_courses_with_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_notification_preferences"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_notification_preferences"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notification_preferences"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_drill_by_title"("p_title" "text", "p_shot_area" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_drill_by_title"("p_title" "text", "p_shot_area" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_drill_by_title"("p_title" "text", "p_shot_area" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_personal_bests_for_drills"("p_drills" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_personal_bests_for_drills"("p_drills" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_personal_bests_for_drills"("p_drills" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_profile"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_profile"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_tournaments_for_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_tournaments_for_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_tournaments_for_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recommended_coach_drills"("p_focus_area" "text", "p_difficulty" "text", "p_exclude_ids" "uuid"[], "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recommended_coach_drills"("p_focus_area" "text", "p_difficulty" "text", "p_exclude_ids" "uuid"[], "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recommended_coach_drills"("p_focus_area" "text", "p_difficulty" "text", "p_exclude_ids" "uuid"[], "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_round_stats_summary"("p_round_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_round_stats_summary"("p_round_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_round_stats_summary"("p_round_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top3_friends_for_drills"("p_drills" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."get_top3_friends_for_drills"("p_drills" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top3_friends_for_drills"("p_drills" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tournament_leaderboard"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_leaderboard"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_leaderboard"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tournament_members_public"("target_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_members_public"("target_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_members_public"("target_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tournament_public"("target_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_public"("target_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_public"("target_tournament_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."tournament_rounds" TO "anon";
GRANT ALL ON TABLE "public"."tournament_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_rounds" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tournament_rounds_public"("target_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tournament_rounds_public"("target_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tournament_rounds_public"("target_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_counts"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_counts"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_counts"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."global_leaderboard_for_drill"("p_drill_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."global_leaderboard_for_drill"("p_drill_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."global_leaderboard_for_drill"("p_drill_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."group_level_leaderboard"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."group_level_leaderboard"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."group_level_leaderboard"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_battle_participant"("p_battle_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_battle_owner"("p_battle_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_blocked_either_way"("other" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_blocked_either_way"("other" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_blocked_either_way"("other" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_creator"("_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_creator"("_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_creator"("_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_friend_of"("_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_friend_of"("_owner_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_friend_of"("_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_friend_of_game_participant"("_game_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_friend_of_game_participant"("_game_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_friend_of_game_participant"("_game_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_friend_of_round_participant"("_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_friend_of_round_participant"("_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_friend_of_round_participant"("_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("_user_id" "uuid", "_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("_user_id" "uuid", "_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("_user_id" "uuid", "_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_owner_or_admin"("_user_id" "uuid", "_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_owner_or_admin"("_user_id" "uuid", "_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_owner_or_admin"("_user_id" "uuid", "_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_round_owner"("_round_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_round_owner"("_round_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_round_owner"("_round_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_round_participant"("p_round_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_round_participant"("p_round_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_round_participant"("p_round_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_round_participant"("_user_id" "uuid", "_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_round_participant"("_user_id" "uuid", "_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_round_participant"("_user_id" "uuid", "_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_session_coach"("uid" "uuid", "sid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_session_coach"("uid" "uuid", "sid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_session_coach"("uid" "uuid", "sid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_session_invited"("uid" "uuid", "sid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_session_invited"("uid" "uuid", "sid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_session_invited"("uid" "uuid", "sid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_creator"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "text", "p_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "text", "p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "text", "p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tournament_member"("p_tournament_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_round"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_round"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_round"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_my_blocks"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_my_blocks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_my_blocks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_as_read"("p_conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalized_friendship_pair"("a" "uuid", "b" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."normalized_friendship_pair"("a" "uuid", "b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalized_friendship_pair"("a" "uuid", "b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_battle_finished"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_battle_finished"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_battle_finished"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_challenge_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_challenge_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_challenge_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_drill_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_drill_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_drill_leaderboard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friend_finished_round"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friend_finished_round"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friend_finished_round"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friend_started_round"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friend_started_round"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friend_started_round"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_group_session_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_group_session_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_group_session_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_round_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_round_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_round_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_scorecard_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_scorecard_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_scorecard_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_scorecard_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_scorecard_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_scorecard_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_session_attendance_reminder"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_session_attendance_reminder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_session_attendance_reminder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_session_coach_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_session_coach_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_session_coach_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_session_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_session_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_session_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_session_starting_soon"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_session_starting_soon"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_session_starting_soon"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_friendship_pair"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_friendship_pair"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_friendship_pair"() TO "service_role";



GRANT ALL ON FUNCTION "public"."putting_score_average"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."putting_score_average"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."putting_score_average"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rebuild_round_scorecard_snapshot"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebuild_round_scorecard_snapshot"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebuild_round_scorecard_snapshot"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_friendship"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_friendship"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_friendship"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."round_has_scores"("p_round_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."round_has_scores"("p_round_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."round_has_scores"("p_round_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_profiles"("q" "text", "max_results" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_profiles"("q" "text", "max_results" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_profiles"("q" "text", "max_results" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."should_send_notification"("_user_id" "uuid", "_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."should_send_notification"("_user_id" "uuid", "_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_send_notification"("_user_id" "uuid", "_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_tournament_round_point_config"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_tournament_round_point_config"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_tournament_round_point_config"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_coach_feedback"("p_drill_id" "uuid", "p_vote" smallint, "p_reason_tag" "text", "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_coach_feedback"("p_drill_id" "uuid", "p_vote" smallint, "p_reason_tag" "text", "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_coach_feedback"("p_drill_id" "uuid", "p_vote" smallint, "p_reason_tag" "text", "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suggested_friends"() TO "anon";
GRANT ALL ON FUNCTION "public"."suggested_friends"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."suggested_friends"() TO "service_role";



GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill"("p_drill" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill"("p_drill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill"("p_drill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill_by_title"("p_drill_title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill_by_title"("p_drill_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."top3_favourite_group_for_drill_by_title"("p_drill_title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."top3_friends_for_drill"("p_drill" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."top3_friends_for_drill"("p_drill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."top3_friends_for_drill"("p_drill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."top3_friends_for_drill_by_title"("p_drill_titles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."top3_friends_for_drill_by_title"("p_drill_titles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."top3_friends_for_drill_by_title"("p_drill_titles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."tournament_contests_touch_edited"() TO "anon";
GRANT ALL ON FUNCTION "public"."tournament_contests_touch_edited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tournament_contests_touch_edited"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_coach_drill_completed"("p_drill_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."track_coach_drill_completed"("p_drill_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_coach_drill_completed"("p_drill_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."track_coach_drill_used"("p_drill_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."track_coach_drill_used"("p_drill_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_coach_drill_used"("p_drill_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_rebuild_scorecard_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_rebuild_scorecard_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_rebuild_scorecard_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."umbriago_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."umbriago_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."umbriago_update_my_stats"("p_game_id" "uuid", "p_stats_mode" "text", "p_track_basic" boolean, "p_track_sg" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."unblock_user"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unblock_user"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unblock_user"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_battle_participant_on_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_battle_participant_on_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_battle_participant_on_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_high_score_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_related_id" "uuid", "p_related_user_id" "uuid", "p_context_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_high_score_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_related_id" "uuid", "p_related_user_id" "uuid", "p_context_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_high_score_notification"("p_user_id" "uuid", "p_title" "text", "p_message" "text", "p_related_id" "uuid", "p_related_user_id" "uuid", "p_context_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."_debug_round_status_deletes" TO "anon";
GRANT ALL ON TABLE "public"."_debug_round_status_deletes" TO "authenticated";
GRANT ALL ON TABLE "public"."_debug_round_status_deletes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."_debug_round_status_deletes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."_debug_round_status_deletes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."_debug_round_status_deletes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."activity_posts" TO "anon";
GRANT ALL ON TABLE "public"."activity_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_posts" TO "service_role";



GRANT ALL ON TABLE "public"."banker_games" TO "anon";
GRANT ALL ON TABLE "public"."banker_games" TO "authenticated";
GRANT ALL ON TABLE "public"."banker_games" TO "service_role";



GRANT ALL ON TABLE "public"."banker_hole_scores" TO "anon";
GRANT ALL ON TABLE "public"."banker_hole_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."banker_hole_scores" TO "service_role";



GRANT ALL ON TABLE "public"."banker_holes" TO "anon";
GRANT ALL ON TABLE "public"."banker_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."banker_holes" TO "service_role";



GRANT ALL ON TABLE "public"."banker_players" TO "anon";
GRANT ALL ON TABLE "public"."banker_players" TO "authenticated";
GRANT ALL ON TABLE "public"."banker_players" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_games" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_games" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_games" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_holes" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_holes" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_taliban_games" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_taliban_games" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_taliban_games" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_taliban_holes" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_taliban_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_taliban_holes" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_worst_ball_games" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_worst_ball_games" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_worst_ball_games" TO "service_role";



GRANT ALL ON TABLE "public"."best_ball_worst_ball_holes" TO "anon";
GRANT ALL ON TABLE "public"."best_ball_worst_ball_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."best_ball_worst_ball_holes" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."coach_ai_feedback" TO "anon";
GRANT ALL ON TABLE "public"."coach_ai_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_ai_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."coach_drill_generations" TO "anon";
GRANT ALL ON TABLE "public"."coach_drill_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_drill_generations" TO "service_role";



GRANT ALL ON TABLE "public"."coach_drills" TO "anon";
GRANT ALL ON TABLE "public"."coach_drills" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_drills" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."copenhagen_games" TO "anon";
GRANT ALL ON TABLE "public"."copenhagen_games" TO "authenticated";
GRANT ALL ON TABLE "public"."copenhagen_games" TO "service_role";



GRANT ALL ON TABLE "public"."copenhagen_holes" TO "anon";
GRANT ALL ON TABLE "public"."copenhagen_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."copenhagen_holes" TO "service_role";



GRANT ALL ON TABLE "public"."course_hole_distances" TO "anon";
GRANT ALL ON TABLE "public"."course_hole_distances" TO "authenticated";
GRANT ALL ON TABLE "public"."course_hole_distances" TO "service_role";



GRANT ALL ON TABLE "public"."course_holes" TO "anon";
GRANT ALL ON TABLE "public"."course_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."course_holes" TO "service_role";



GRANT ALL ON TABLE "public"."course_tees" TO "anon";
GRANT ALL ON TABLE "public"."course_tees" TO "authenticated";
GRANT ALL ON TABLE "public"."course_tees" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."custom_level_maps" TO "anon";
GRANT ALL ON TABLE "public"."custom_level_maps" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_level_maps" TO "service_role";



GRANT ALL ON TABLE "public"."device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."drill_results" TO "anon";
GRANT ALL ON TABLE "public"."drill_results" TO "authenticated";
GRANT ALL ON TABLE "public"."drill_results" TO "service_role";



GRANT ALL ON TABLE "public"."drills" TO "anon";
GRANT ALL ON TABLE "public"."drills" TO "authenticated";
GRANT ALL ON TABLE "public"."drills" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."favorite_courses" TO "anon";
GRANT ALL ON TABLE "public"."favorite_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_courses" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."friends_pairs" TO "anon";
GRANT ALL ON TABLE "public"."friends_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."friends_pairs" TO "service_role";



GRANT ALL ON TABLE "public"."game_feed_likes" TO "anon";
GRANT ALL ON TABLE "public"."game_feed_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."game_feed_likes" TO "service_role";



GRANT ALL ON TABLE "public"."game_feed_posts" TO "anon";
GRANT ALL ON TABLE "public"."game_feed_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."game_feed_posts" TO "service_role";



GRANT ALL ON TABLE "public"."game_groups" TO "anon";
GRANT ALL ON TABLE "public"."game_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."game_groups" TO "service_role";



GRANT ALL ON TABLE "public"."game_likes" TO "anon";
GRANT ALL ON TABLE "public"."game_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."game_likes" TO "service_role";



GRANT ALL ON TABLE "public"."group_activity" TO "anon";
GRANT ALL ON TABLE "public"."group_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."group_activity" TO "service_role";



GRANT ALL ON TABLE "public"."group_activity_comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."group_activity_comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."group_activity_comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."group_activity_comments" TO "anon";
GRANT ALL ON TABLE "public"."group_activity_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."group_activity_comments" TO "service_role";



GRANT ALL ON TABLE "public"."group_activity_likes" TO "anon";
GRANT ALL ON TABLE "public"."group_activity_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."group_activity_likes" TO "service_role";



GRANT ALL ON TABLE "public"."group_challenges" TO "anon";
GRANT ALL ON TABLE "public"."group_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."group_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."group_invites" TO "anon";
GRANT ALL ON TABLE "public"."group_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."group_invites" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_sessions" TO "anon";
GRANT ALL ON TABLE "public"."group_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."group_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."holes" TO "anon";
GRANT ALL ON TABLE "public"."holes" TO "authenticated";
GRANT ALL ON TABLE "public"."holes" TO "service_role";



GRANT ALL ON TABLE "public"."levels" TO "anon";
GRANT ALL ON TABLE "public"."levels" TO "authenticated";
GRANT ALL ON TABLE "public"."levels" TO "service_role";



GRANT ALL ON TABLE "public"."map_battle_participants" TO "anon";
GRANT ALL ON TABLE "public"."map_battle_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."map_battle_participants" TO "service_role";



GRANT ALL ON TABLE "public"."map_battle_progress" TO "anon";
GRANT ALL ON TABLE "public"."map_battle_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."map_battle_progress" TO "service_role";



GRANT ALL ON TABLE "public"."map_battles" TO "anon";
GRANT ALL ON TABLE "public"."map_battles" TO "authenticated";
GRANT ALL ON TABLE "public"."map_battles" TO "service_role";



GRANT ALL ON TABLE "public"."match_play_games" TO "anon";
GRANT ALL ON TABLE "public"."match_play_games" TO "authenticated";
GRANT ALL ON TABLE "public"."match_play_games" TO "service_role";



GRANT ALL ON TABLE "public"."match_play_holes" TO "anon";
GRANT ALL ON TABLE "public"."match_play_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."match_play_holes" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."nine_points_games" TO "anon";
GRANT ALL ON TABLE "public"."nine_points_games" TO "authenticated";
GRANT ALL ON TABLE "public"."nine_points_games" TO "service_role";



GRANT ALL ON TABLE "public"."nine_points_holes" TO "anon";
GRANT ALL ON TABLE "public"."nine_points_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."nine_points_holes" TO "service_role";



GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."player_game_stats_mode" TO "anon";
GRANT ALL ON TABLE "public"."player_game_stats_mode" TO "authenticated";
GRANT ALL ON TABLE "public"."player_game_stats_mode" TO "service_role";



GRANT ALL ON TABLE "public"."post_comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."post_comment_replies" TO "anon";
GRANT ALL ON TABLE "public"."post_comment_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comment_replies" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."pro_stats_holes" TO "anon";
GRANT ALL ON TABLE "public"."pro_stats_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."pro_stats_holes" TO "service_role";



GRANT ALL ON TABLE "public"."pro_stats_rounds" TO "anon";
GRANT ALL ON TABLE "public"."pro_stats_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."pro_stats_rounds" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."round_comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."round_comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."round_comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."round_comment_replies" TO "anon";
GRANT ALL ON TABLE "public"."round_comment_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."round_comment_replies" TO "service_role";



GRANT ALL ON TABLE "public"."round_comments" TO "anon";
GRANT ALL ON TABLE "public"."round_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."round_comments" TO "service_role";



GRANT ALL ON TABLE "public"."round_players" TO "anon";
GRANT ALL ON TABLE "public"."round_players" TO "authenticated";
GRANT ALL ON TABLE "public"."round_players" TO "service_role";



GRANT ALL ON TABLE "public"."round_status" TO "anon";
GRANT ALL ON TABLE "public"."round_status" TO "authenticated";
GRANT ALL ON TABLE "public"."round_status" TO "service_role";



GRANT ALL ON SEQUENCE "public"."round_status_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."round_status_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."round_status_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rounds" TO "anon";
GRANT ALL ON TABLE "public"."rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."rounds" TO "service_role";



GRANT ALL ON TABLE "public"."round_summaries" TO "anon";
GRANT ALL ON TABLE "public"."round_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."round_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."scorecard_comments" TO "anon";
GRANT ALL ON TABLE "public"."scorecard_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."scorecard_comments" TO "service_role";



GRANT ALL ON TABLE "public"."scorecard_likes" TO "anon";
GRANT ALL ON TABLE "public"."scorecard_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."scorecard_likes" TO "service_role";



GRANT ALL ON TABLE "public"."scramble_games" TO "anon";
GRANT ALL ON TABLE "public"."scramble_games" TO "authenticated";
GRANT ALL ON TABLE "public"."scramble_games" TO "service_role";



GRANT ALL ON TABLE "public"."scramble_holes" TO "anon";
GRANT ALL ON TABLE "public"."scramble_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."scramble_holes" TO "service_role";



GRANT ALL ON TABLE "public"."session_attendance" TO "anon";
GRANT ALL ON TABLE "public"."session_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."session_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."session_drills" TO "anon";
GRANT ALL ON TABLE "public"."session_drills" TO "authenticated";
GRANT ALL ON TABLE "public"."session_drills" TO "service_role";



GRANT ALL ON TABLE "public"."session_invites" TO "anon";
GRANT ALL ON TABLE "public"."session_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."session_invites" TO "service_role";



GRANT ALL ON TABLE "public"."session_notes" TO "anon";
GRANT ALL ON TABLE "public"."session_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."session_notes" TO "service_role";



GRANT ALL ON TABLE "public"."session_responses" TO "anon";
GRANT ALL ON TABLE "public"."session_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."session_responses" TO "service_role";



GRANT ALL ON TABLE "public"."session_scores" TO "anon";
GRANT ALL ON TABLE "public"."session_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."session_scores" TO "service_role";



GRANT ALL ON TABLE "public"."session_templates" TO "anon";
GRANT ALL ON TABLE "public"."session_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."session_templates" TO "service_role";



GRANT ALL ON TABLE "public"."sg_rounds" TO "anon";
GRANT ALL ON TABLE "public"."sg_rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."sg_rounds" TO "service_role";



GRANT ALL ON TABLE "public"."skins_games" TO "anon";
GRANT ALL ON TABLE "public"."skins_games" TO "authenticated";
GRANT ALL ON TABLE "public"."skins_games" TO "service_role";



GRANT ALL ON TABLE "public"."skins_holes" TO "anon";
GRANT ALL ON TABLE "public"."skins_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."skins_holes" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_chat_reads" TO "anon";
GRANT ALL ON TABLE "public"."tournament_chat_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_chat_reads" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_groups" TO "anon";
GRANT ALL ON TABLE "public"."tournament_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_groups" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_invites" TO "anon";
GRANT ALL ON TABLE "public"."tournament_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_invites" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_members" TO "anon";
GRANT ALL ON TABLE "public"."tournament_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_members" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_messages" TO "anon";
GRANT ALL ON TABLE "public"."tournament_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_messages" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_point_config" TO "anon";
GRANT ALL ON TABLE "public"."tournament_point_config" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_point_config" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_round_contest_entries" TO "anon";
GRANT ALL ON TABLE "public"."tournament_round_contest_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_round_contest_entries" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_round_points" TO "anon";
GRANT ALL ON TABLE "public"."tournament_round_points" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_round_points" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_teams" TO "anon";
GRANT ALL ON TABLE "public"."tournament_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_teams" TO "service_role";



GRANT ALL ON TABLE "public"."umbriago_games" TO "anon";
GRANT ALL ON TABLE "public"."umbriago_games" TO "authenticated";
GRANT ALL ON TABLE "public"."umbriago_games" TO "service_role";



GRANT ALL ON TABLE "public"."umbriago_holes" TO "anon";
GRANT ALL ON TABLE "public"."umbriago_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."umbriago_holes" TO "service_role";



GRANT ALL ON TABLE "public"."user_bucket_courses" TO "anon";
GRANT ALL ON TABLE "public"."user_bucket_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_bucket_courses" TO "service_role";



GRANT ALL ON TABLE "public"."user_conversation_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_conversation_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_conversation_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorites" TO "anon";
GRANT ALL ON TABLE "public"."user_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."user_level_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_level_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_level_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_milestones" TO "anon";
GRANT ALL ON TABLE "public"."user_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."user_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."wolf_games" TO "anon";
GRANT ALL ON TABLE "public"."wolf_games" TO "authenticated";
GRANT ALL ON TABLE "public"."wolf_games" TO "service_role";



GRANT ALL ON TABLE "public"."user_played_courses_v1" TO "anon";
GRANT ALL ON TABLE "public"."user_played_courses_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."user_played_courses_v1" TO "service_role";



GRANT ALL ON TABLE "public"."user_ranked_courses" TO "anon";
GRANT ALL ON TABLE "public"."user_ranked_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ranked_courses" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."wolf_holes" TO "anon";
GRANT ALL ON TABLE "public"."wolf_holes" TO "authenticated";
GRANT ALL ON TABLE "public"."wolf_holes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







