-- Allow users to see events where they participate in a round (round_players),
-- not only events where they own a round/game.
-- This way e.g. "Will Berg" sees the event in View Rounds when they were added to a round in the event.

DROP POLICY IF EXISTS "Event participants can view events" ON public.events;

CREATE POLICY "Event participants can view events"
ON public.events
FOR SELECT
USING (
  -- User owns a round/game in this event
  EXISTS (SELECT 1 FROM public.copenhagen_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.best_ball_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.match_play_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.scramble_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.skins_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.umbriago_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.wolf_games WHERE event_id = events.id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.rounds WHERE event_id = events.id AND user_id = auth.uid())
  -- User is a participant in a stroke-play round in this event (round_players)
  OR EXISTS (
    SELECT 1 FROM public.rounds r
    INNER JOIN public.round_players rp ON rp.round_id = r.id
    WHERE r.event_id = events.id AND rp.user_id = auth.uid()
  )
);
