-- Update hole 8 to par 5 and hole 9 to par 4 for Black Horse Golf Course
UPDATE public.course_holes
SET par = 5
WHERE course_id = (SELECT id FROM public.courses WHERE name = 'Black Horse Golf Course')
AND hole_number = 8;

UPDATE public.course_holes
SET par = 4
WHERE course_id = (SELECT id FROM public.courses WHERE name = 'Black Horse Golf Course')
AND hole_number = 9;