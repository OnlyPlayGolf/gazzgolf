-- Remove USA flag from Bayonet Golf Course location
UPDATE public.courses
SET location = 'Monterey, California'
WHERE name = 'Bayonet Golf Course';