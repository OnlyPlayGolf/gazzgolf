-- Insert Black Horse Golf Course with auto-generated UUID
WITH new_course AS (
  INSERT INTO public.courses (name, location, tee_names)
  VALUES (
    'Black Horse Golf Course',
    'Monterey, California',
    '{"black": "Black", "blue": "Blue", "white": "Combo", "yellow": "White", "red": "Red"}'::jsonb
  )
  RETURNING id
)
-- Insert all 18 holes with distances for each tee
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, black_distance, blue_distance, white_distance, yellow_distance, red_distance)
SELECT 
  new_course.id,
  hole_data.hole_number,
  hole_data.par,
  hole_data.stroke_index,
  hole_data.black_distance,
  hole_data.blue_distance,
  hole_data.white_distance,
  hole_data.yellow_distance,
  hole_data.red_distance
FROM new_course,
(VALUES
  -- Front 9
  (1, 5, 3, 538, 511, 454, 454, 412),
  (2, 3, 9, 246, 213, 182, 182, 127),
  (3, 4, 11, 397, 361, 361, 336, 236),
  (4, 4, 1, 444, 402, 402, 353, 314),
  (5, 3, 17, 197, 177, 152, 152, 107),
  (6, 4, 15, 265, 265, 265, 228, 192),
  (7, 4, 13, 388, 367, 367, 318, 287),
  (8, 4, 5, 551, 520, 520, 484, 384),
  (9, 5, 7, 422, 400, 362, 362, 300),
  -- Back 9
  (10, 4, 10, 416, 392, 370, 370, 344),
  (11, 4, 4, 448, 418, 388, 388, 308),
  (12, 5, 8, 508, 482, 508, 445, 401),
  (13, 4, 2, 459, 422, 370, 370, 329),
  (14, 4, 12, 396, 363, 363, 343, 320),
  (15, 3, 16, 223, 178, 137, 137, 93),
  (16, 4, 14, 325, 307, 307, 291, 263),
  (17, 3, 18, 192, 176, 157, 157, 124),
  (18, 5, 6, 610, 588, 545, 545, 499)
) AS hole_data(hole_number, par, stroke_index, black_distance, blue_distance, white_distance, yellow_distance, red_distance);