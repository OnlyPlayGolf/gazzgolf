-- Add tee_names column to courses table for custom tee naming per course
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS tee_names jsonb DEFAULT '{"black": "Black", "blue": "Blue", "white": "White", "yellow": "Yellow", "red": "Red"}'::jsonb;

-- Insert La Purisima Golf Course with custom tee names
INSERT INTO public.courses (name, location, tee_names) 
VALUES (
  'La Purisima Golf Course', 
  'Lompoc, California',
  '{"black": "Black", "blue": "Blue", "white": "Combo", "yellow": "White", "red": "Red"}'::jsonb
);

-- Get the course ID for inserting holes
DO $$
DECLARE
  course_uuid uuid;
BEGIN
  SELECT id INTO course_uuid FROM public.courses WHERE name = 'La Purisima Golf Course';
  
  -- Insert all 18 holes with data from the scorecard
  INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, red_distance) VALUES
    (course_uuid, 1, 5, 9, 529, 510, 510, 447),
    (course_uuid, 2, 4, 3, 403, 403, 365, 337),
    (course_uuid, 3, 3, 17, 130, 130, 130, 98),
    (course_uuid, 4, 4, 13, 321, 321, 321, 274),
    (course_uuid, 5, 4, 1, 400, 344, 344, 344),
    (course_uuid, 6, 5, 7, 540, 527, 527, 457),
    (course_uuid, 7, 4, 5, 400, 360, 360, 353),
    (course_uuid, 8, 4, 11, 405, 375, 375, 353),
    (course_uuid, 9, 3, 15, 201, 201, 175, 165),
    (course_uuid, 10, 4, 4, 438, 400, 400, 365),
    (course_uuid, 11, 4, 16, 371, 371, 345, 329),
    (course_uuid, 12, 5, 2, 587, 570, 570, 558),
    (course_uuid, 13, 3, 18, 149, 149, 145, 123),
    (course_uuid, 14, 4, 10, 366, 366, 320, 304),
    (course_uuid, 15, 5, 6, 503, 503, 460, 458),
    (course_uuid, 16, 4, 8, 395, 350, 350, 340),
    (course_uuid, 17, 3, 14, 145, 145, 140, 118),
    (course_uuid, 18, 4, 12, 387, 350, 350, 340);
END $$;