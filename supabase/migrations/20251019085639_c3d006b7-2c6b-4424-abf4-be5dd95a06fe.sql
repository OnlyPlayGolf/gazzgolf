-- Step 1: Convert column to text temporarily
ALTER TABLE public.holes ALTER COLUMN approach_bucket TYPE text;

-- Step 2: Drop the old enum type
DROP TYPE IF EXISTS public.approach_bucket CASCADE;

-- Step 3: Create new enum with updated values
CREATE TYPE public.approach_bucket AS ENUM (
  '<40m',
  '40-80m',
  '80-120m',
  '120-160',
  '160-200',
  '200+'
);

-- Step 4: Update existing data to map to new enum values
UPDATE public.holes
SET approach_bucket = CASE 
  WHEN approach_bucket = '<40' THEN '<40m'
  WHEN approach_bucket = '40-120' THEN '40-80m'
  WHEN approach_bucket = '120-200' THEN '120-160'
  WHEN approach_bucket = '200+' THEN '200+'
  ELSE NULL
END
WHERE approach_bucket IS NOT NULL;

-- Step 5: Convert column back to enum type
ALTER TABLE public.holes 
ALTER COLUMN approach_bucket TYPE public.approach_bucket 
USING approach_bucket::public.approach_bucket;