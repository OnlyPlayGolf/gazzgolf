-- Drop the existing INSERT policy for round_comment_replies
DROP POLICY IF EXISTS "Users can reply to comments on accessible rounds" ON public.round_comment_replies;

-- Create a new INSERT policy that checks for both rounds and game tables
CREATE POLICY "Users can reply to comments on accessible rounds" 
ON public.round_comment_replies 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM round_comments rc
    WHERE rc.id = round_comment_replies.comment_id
    AND (
      -- Check if user owns the comment
      rc.user_id = auth.uid()
      -- Or check access via rounds table
      OR EXISTS (
        SELECT 1 FROM rounds r
        WHERE r.id = rc.round_id
        AND (
          r.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = r.user_id)
               OR (fp.b = auth.uid() AND fp.a = r.user_id)
          )
        )
      )
      -- Or check access via match_play_games
      OR EXISTS (
        SELECT 1 FROM match_play_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via umbriago_games
      OR EXISTS (
        SELECT 1 FROM umbriago_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via wolf_games
      OR EXISTS (
        SELECT 1 FROM wolf_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via copenhagen_games
      OR EXISTS (
        SELECT 1 FROM copenhagen_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via best_ball_games
      OR EXISTS (
        SELECT 1 FROM best_ball_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via scramble_games
      OR EXISTS (
        SELECT 1 FROM scramble_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
      -- Or check access via skins_games
      OR EXISTS (
        SELECT 1 FROM skins_games g
        WHERE g.id = rc.game_id
        AND (
          g.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM friends_pairs fp
            WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
               OR (fp.b = auth.uid() AND fp.a = g.user_id)
          )
        )
      )
    )
  )
);