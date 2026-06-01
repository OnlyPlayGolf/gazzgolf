-- Add mulligan column to holes table
ALTER TABLE public.holes ADD COLUMN mulligan boolean NOT NULL DEFAULT false;