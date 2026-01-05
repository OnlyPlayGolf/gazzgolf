
-- Update PGA West – Mountain Course location to remove ", USA"
UPDATE public.courses 
SET location = 'La Quinta, California'
WHERE name = 'PGA West – Mountain Course';
