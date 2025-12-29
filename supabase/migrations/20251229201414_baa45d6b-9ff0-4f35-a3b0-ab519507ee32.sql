-- Add Bayonet Golf Course
WITH new_course AS (
  INSERT INTO public.courses (name, location, tee_names)
  VALUES (
    'Bayonet Golf Course',
    'Monterey, California 🇺🇸',
    '{"blue": "Black", "white": "Blue", "yellow": "Combo", "orange": "White", "red": "Red"}'::jsonb
  )
  RETURNING id
)
-- Add course holes with all tee distances (in yards)
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, orange_distance, red_distance)
SELECT id, hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, orange_distance, red_distance
FROM new_course,
(VALUES
  (1, 5, 7, 548, 520, 505, 505, 474),
  (2, 4, 1, 436, 423, 357, 357, 317),
  (3, 4, 17, 365, 332, 332, 317, 278),
  (4, 3, 11, 201, 176, 156, 156, 122),
  (5, 4, 15, 343, 327, 327, 306, 285),
  (6, 3, 13, 221, 189, 170, 170, 136),
  (7, 4, 9, 392, 363, 363, 336, 294),
  (8, 5, 5, 613, 593, 541, 541, 474),
  (9, 4, 3, 476, 449, 388, 388, 350),
  (10, 5, 12, 517, 510, 510, 462, 402),
  (11, 4, 8, 387, 355, 355, 331, 250),
  (12, 4, 4, 419, 378, 316, 316, 290),
  (13, 4, 2, 479, 444, 387, 387, 369),
  (14, 3, 18, 192, 170, 149, 149, 118),
  (15, 4, 14, 370, 350, 350, 320, 262),
  (16, 4, 6, 393, 364, 364, 326, 275),
  (17, 3, 16, 225, 200, 150, 150, 137),
  (18, 5, 10, 527, 498, 498, 428, 396)
) AS holes(hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, orange_distance, red_distance);