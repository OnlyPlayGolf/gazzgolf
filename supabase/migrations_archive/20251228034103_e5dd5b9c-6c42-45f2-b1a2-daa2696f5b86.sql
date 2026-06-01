
-- Insert Del Monte Golf Course
INSERT INTO courses (name, location, tee_names)
VALUES (
  'Del Monte Golf Course',
  'Pebble Beach, CA',
  '{"blue": "Blue", "white": "White", "yellow": "Combo", "red": "Green"}'::jsonb
);

-- Insert all 18 holes (using the course id from the insert above)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, red_distance)
SELECT 
  c.id,
  h.hole_number,
  h.par,
  h.stroke_index,
  h.blue_distance,
  h.white_distance,
  h.yellow_distance,
  h.red_distance
FROM courses c
CROSS JOIN (VALUES
  (1, 5, 9, 505, 486, 486, 424),
  (2, 4, 13, 328, 311, 311, 295),
  (3, 4, 3, 373, 359, 349, 349),
  (4, 3, 15, 178, 158, 158, 137),
  (5, 4, 17, 326, 299, 299, 283),
  (6, 3, 5, 194, 180, 152, 152),
  (7, 4, 1, 376, 362, 296, 296),
  (8, 4, 11, 383, 364, 311, 311),
  (9, 5, 7, 533, 517, 426, 426),
  (10, 4, 18, 293, 279, 279, 266),
  (11, 4, 6, 329, 322, 322, 310),
  (12, 3, 16, 166, 143, 143, 126),
  (13, 5, 10, 517, 495, 408, 408),
  (14, 3, 2, 215, 201, 180, 180),
  (15, 4, 12, 327, 312, 312, 293),
  (16, 4, 4, 420, 414, 351, 351),
  (17, 5, 14, 502, 481, 481, 449),
  (18, 4, 8, 391, 365, 323, 323)
) AS h(hole_number, par, stroke_index, blue_distance, white_distance, yellow_distance, red_distance)
WHERE c.name = 'Del Monte Golf Course';
