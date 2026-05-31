-- Add round_type column to rounds table
ALTER TABLE public.rounds 
ADD COLUMN round_type text DEFAULT 'fun_practice';

-- Add a comment to document the valid values
COMMENT ON COLUMN public.rounds.round_type IS 'Round type: fun_practice, qualifying, or tournament';