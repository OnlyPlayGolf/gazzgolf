-- Add country, handicap, and home_club fields to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS handicap text,
  ADD COLUMN IF NOT EXISTS home_club text;