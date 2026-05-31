-- Allow friends to view game tables so games can appear in profile "Rounds" lists

-- Helper snippet inline: friend-of-owner check
-- (kept inline to avoid extra functions)

-- Copenhagen
DROP POLICY IF EXISTS "Friends can view copenhagen games" ON public.copenhagen_games;
CREATE POLICY "Friends can view copenhagen games"
ON public.copenhagen_games
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = copenhagen_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = copenhagen_games.user_id)
  )
);

DROP POLICY IF EXISTS "Friends can view copenhagen holes" ON public.copenhagen_holes;
CREATE POLICY "Friends can view copenhagen holes"
ON public.copenhagen_holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.copenhagen_games g
    WHERE g.id = copenhagen_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
             OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
  )
);

-- Scramble
DROP POLICY IF EXISTS "Friends can view scramble games" ON public.scramble_games;
CREATE POLICY "Friends can view scramble games"
ON public.scramble_games
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = scramble_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = scramble_games.user_id)
  )
);

DROP POLICY IF EXISTS "Friends can view scramble holes" ON public.scramble_holes;
CREATE POLICY "Friends can view scramble holes"
ON public.scramble_holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.scramble_games g
    WHERE g.id = scramble_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
             OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
  )
);

-- Skins
DROP POLICY IF EXISTS "Friends can view skins games" ON public.skins_games;
CREATE POLICY "Friends can view skins games"
ON public.skins_games
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = skins_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = skins_games.user_id)
  )
);

DROP POLICY IF EXISTS "Friends can view skins holes" ON public.skins_holes;
CREATE POLICY "Friends can view skins holes"
ON public.skins_holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.skins_games g
    WHERE g.id = skins_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
             OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
  )
);

-- Umbriago
DROP POLICY IF EXISTS "Friends can view umbriago games" ON public.umbriago_games;
CREATE POLICY "Friends can view umbriago games"
ON public.umbriago_games
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = umbriago_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = umbriago_games.user_id)
  )
);

DROP POLICY IF EXISTS "Friends can view umbriago holes" ON public.umbriago_holes;
CREATE POLICY "Friends can view umbriago holes"
ON public.umbriago_holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.umbriago_games g
    WHERE g.id = umbriago_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
             OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
  )
);

-- Wolf
DROP POLICY IF EXISTS "Friends can view wolf games" ON public.wolf_games;
CREATE POLICY "Friends can view wolf games"
ON public.wolf_games
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = wolf_games.user_id)
       OR (fp.b = auth.uid() AND fp.a = wolf_games.user_id)
  )
);

DROP POLICY IF EXISTS "Friends can view wolf holes" ON public.wolf_holes;
CREATE POLICY "Friends can view wolf holes"
ON public.wolf_holes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.wolf_games g
    WHERE g.id = wolf_holes.game_id
      AND (
        g.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.friends_pairs fp
          WHERE (fp.a = auth.uid() AND fp.b = g.user_id)
             OR (fp.b = auth.uid() AND fp.a = g.user_id)
        )
      )
  )
);
