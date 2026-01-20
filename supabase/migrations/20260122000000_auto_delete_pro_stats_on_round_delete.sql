-- Auto-delete pro_stats_rounds when rounds are deleted
-- This ensures that when a round is deleted, its associated pro_stats_rounds (and pro_stats_holes) are also deleted

-- Create function to delete pro_stats_rounds when a round is deleted
CREATE OR REPLACE FUNCTION public.delete_pro_stats_on_round_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete pro_stats_holes first (child records)
  DELETE FROM public.pro_stats_holes
  WHERE pro_round_id IN (
    SELECT id FROM public.pro_stats_rounds
    WHERE external_round_id = OLD.id
  );
  
  -- Delete pro_stats_rounds that reference the deleted round
  DELETE FROM public.pro_stats_rounds
  WHERE external_round_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Create trigger on rounds table
DROP TRIGGER IF EXISTS trigger_delete_pro_stats_on_round_delete ON public.rounds;
CREATE TRIGGER trigger_delete_pro_stats_on_round_delete
  AFTER DELETE ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_pro_stats_on_round_delete();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_pro_stats_on_round_delete() TO authenticated;
