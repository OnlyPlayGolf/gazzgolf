-- Insert Stanford Golf Course
INSERT INTO public.courses (id, name, location, tee_names)
VALUES (
  gen_random_uuid(),
  'Stanford Golf Course',
  'Stanford, California',
  '["Cardinal", "Black", "White", "Blue", "Family"]'
);

-- Insert all 18 holes with distances for all tee boxes
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, gold_distance, black_distance, white_distance, blue_distance, red_distance)
SELECT 
  c.id,
  h.hole_number,
  h.par,
  h.stroke_index,
  h.gold_distance,
  h.black_distance,
  h.white_distance,
  h.blue_distance,
  h.red_distance
FROM courses c
CROSS JOIN (VALUES
  -- Hole, Par, SI, Cardinal, Black, White, Blue, Family
  (1, 5, 13, 520, 505, 488, 480, 320),
  (2, 4, 3, 478, 418, 382, 348, 250),
  (3, 3, 9, 214, 192, 164, 134, 136),
  (4, 3, 15, 167, 143, 120, 101, 102),
  (5, 4, 5, 444, 385, 346, 335, 250),
  (6, 4, 1, 426, 403, 386, 324, 268),
  (7, 5, 11, 536, 478, 447, 427, 287),
  (8, 3, 17, 186, 145, 130, 117, 117),
  (9, 4, 7, 364, 350, 333, 325, 224),
  (10, 4, 4, 430, 401, 376, 338, 250),
  (11, 4, 14, 360, 350, 338, 332, 240),
  (12, 4, 2, 474, 442, 425, 403, 265),
  (13, 4, 6, 437, 403, 384, 352, 240),
  (14, 3, 16, 188, 160, 136, 117, 117),
  (15, 4, 12, 363, 351, 322, 299, 299),
  (16, 5, 8, 505, 492, 442, 431, 300),
  (17, 3, 18, 196, 175, 158, 141, 141),
  (18, 4, 10, 454, 420, 394, 359, 258)
) AS h(hole_number, par, stroke_index, gold_distance, black_distance, white_distance, blue_distance, red_distance)
WHERE c.name = 'Stanford Golf Course';