-- Insert Rustic Canyon Golf Course
INSERT INTO public.courses (name, location, tee_names)
VALUES (
  'Rustic Canyon Golf Course',
  'Moorpark, California',
  '{"black": "Black", "blue": "Blue", "gold": "Hanse", "white": "White", "red": "Red"}'::jsonb
);

-- Insert all 18 holes with distances for all 5 tees
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, black_distance, blue_distance, gold_distance, white_distance, red_distance)
SELECT 
  c.id,
  h.hole_number,
  h.par,
  h.stroke_index,
  h.black_distance,
  h.blue_distance,
  h.gold_distance,
  h.white_distance,
  h.red_distance
FROM public.courses c
CROSS JOIN (VALUES
  (1, 5, 16, 540, 512, 512, 495, 460),
  (2, 4, 2, 457, 443, 424, 424, 349),
  (3, 4, 14, 315, 308, 308, 292, 253),
  (4, 3, 12, 166, 152, 152, 146, 130),
  (5, 5, 4, 570, 545, 528, 528, 493),
  (6, 3, 6, 216, 200, 200, 128, 116),
  (7, 4, 8, 362, 338, 299, 299, 254),
  (8, 3, 18, 143, 123, 123, 106, 90),
  (9, 5, 10, 565, 518, 509, 509, 432),
  (10, 5, 9, 571, 546, 542, 542, 414),
  (11, 4, 3, 452, 430, 430, 382, 310),
  (12, 4, 13, 336, 325, 336, 303, 244),
  (13, 5, 17, 582, 546, 512, 512, 464),
  (14, 4, 7, 498, 446, 364, 364, 322),
  (15, 3, 11, 147, 138, 138, 124, 111),
  (16, 4, 1, 479, 466, 466, 390, 354),
  (17, 3, 15, 189, 161, 161, 151, 134),
  (18, 4, 5, 456, 437, 437, 354, 345)
) AS h(hole_number, par, stroke_index, black_distance, blue_distance, gold_distance, white_distance, red_distance)
WHERE c.name = 'Rustic Canyon Golf Course';