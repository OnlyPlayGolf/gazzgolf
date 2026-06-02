-- Fix: create_drill_high_score_post() created a "drill_high_score" activity-feed
-- post on every personal best — and a user's FIRST score on a private drill is a
-- PB — so building a private drill and entering a score leaked it into friends'
-- activity feeds (the same root issue as the leaderboard-notification spam).
--
-- Fix: skip the post for a PRIVATE custom drill (one only the creator has).
--   • Built-in catalog drills are never saved to coach_drills, so they are
--     always treated as public (unchanged behavior).
--   • A custom drill (it has at least one coach_drills row) is "shared" once
--     ANOTHER user has saved it (coach_drills) OR recorded a result for it
--     (drill_results). Until then it's private and gets no feed post.
--
-- Everything else is reproduced verbatim from the baseline definition.

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
  v_is_custom_drill   boolean;
  v_others_have_drill boolean;
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

    -- 3b. Privacy gate: don't post about a private custom drill. Built-in
    --     catalog drills are never in coach_drills (always public). A custom
    --     drill is shared once another user has saved or played it.
    SELECT EXISTS (
      SELECT 1 FROM public.coach_drills WHERE title = v_drill_title
    )
    INTO v_is_custom_drill;

    IF v_is_custom_drill THEN
      SELECT
        EXISTS (SELECT 1 FROM public.coach_drills
                WHERE title = v_drill_title AND coach_id != NEW.user_id)
        OR EXISTS (SELECT 1 FROM public.drill_results
                   WHERE drill_id = NEW.drill_id AND user_id != NEW.user_id)
      INTO v_others_have_drill;

      IF NOT COALESCE(v_others_have_drill, false) THEN
        RETURN NEW;  -- private, unshared custom drill → no activity post
      END IF;
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
