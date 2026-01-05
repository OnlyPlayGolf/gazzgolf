
-- Update course name from Djursholms GK to Djursholms Golf Klubb
UPDATE public.courses 
SET name = 'Djursholms Golf Klubb'
WHERE name = 'Djursholms GK';
