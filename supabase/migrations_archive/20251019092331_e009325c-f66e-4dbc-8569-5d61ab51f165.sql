-- Add column to store detailed shot data for pro rounds
ALTER TABLE holes 
ADD COLUMN IF NOT EXISTS pro_shot_data JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN holes.pro_shot_data IS 'Stores detailed shot-by-shot data for pro rounds including distances, lies, and strokes gained';