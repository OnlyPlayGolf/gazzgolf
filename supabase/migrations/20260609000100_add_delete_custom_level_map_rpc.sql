-- Atomic, owner-checked deletion of a custom level map together with its child
-- levels and their progress rows.
--
-- Bug: deleting a map from "My Levels" did not stick. The iOS path did a plain
-- DELETE on custom_level_maps and ASSUMED an `ON DELETE CASCADE` on
-- levels.custom_map_id — but neither that cascade nor any DELETE policy for
-- these tables is tracked in migrations (the schema was provisioned out of
-- band). A missing DELETE policy makes the delete a silent zero-row no-op, and
-- even if the map deleted, child levels / user_level_progress rows could orphan.
--
-- Fix: a SECURITY DEFINER RPC removes all three tables in one transaction and
-- checks ownership itself (owner_id = auth.uid()), so it works regardless of
-- cascade/policy state and a non-owner (or other failure) RAISEs instead of
-- silently doing nothing. This is the project's canonical pattern for
-- multi-table deletes. iOS calls it via LevelsManager.deleteCustomMap.

CREATE OR REPLACE FUNCTION public.delete_custom_level_map(p_map_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner check: a user may only delete their OWN map.
  IF NOT EXISTS (
    SELECT 1 FROM public.custom_level_maps
    WHERE id = p_map_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized to delete map %', p_map_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Children first (progress rows reference levels; levels reference the map).
  DELETE FROM public.user_level_progress
   WHERE level_id IN (
     SELECT id FROM public.levels WHERE custom_map_id = p_map_id
   );

  DELETE FROM public.levels WHERE custom_map_id = p_map_id;

  DELETE FROM public.custom_level_maps WHERE id = p_map_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_custom_level_map(uuid) TO authenticated;
