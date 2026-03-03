-- Add result_text to round_status for displaying score/result in Friends on Course section
ALTER TABLE round_status
  ADD COLUMN IF NOT EXISTS result_text TEXT;
