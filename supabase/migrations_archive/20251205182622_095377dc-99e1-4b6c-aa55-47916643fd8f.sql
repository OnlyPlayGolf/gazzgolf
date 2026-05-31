-- Insert the course
INSERT INTO public.courses (name, location)
VALUES ('Stockholms GK', 'Stockholm, Sweden');

-- Insert all 18 holes
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance)
SELECT 
  c.id,
  holes.hole_number,
  holes.par,
  holes.stroke_index,
  holes.white_distance,
  holes.yellow_distance,
  holes.blue_distance,
  holes.red_distance
FROM public.courses c
CROSS JOIN (VALUES
  (1, 4, 12, 340, 325, 290, 290),
  (2, 4, 6, 405, 375, 345, 345),
  (3, 4, 2, 380, 373, 335, 335),
  (4, 3, 16, 165, 145, 145, 120),
  (5, 4, 8, 285, 255, 200, 200),
  (6, 3, 14, 183, 155, 145, 145),
  (7, 4, 4, 330, 317, 288, 288),
  (8, 4, 10, 315, 300, 300, 260),
  (9, 3, 18, 120, 115, 115, 95),
  (10, 5, 9, 535, 520, 420, 420),
  (11, 4, 5, 285, 270, 250, 250),
  (12, 3, 13, 175, 158, 158, 134),
  (13, 5, 3, 490, 465, 465, 395),
  (14, 3, 17, 140, 136, 120, 120),
  (15, 4, 1, 384, 369, 320, 320),
  (16, 3, 15, 156, 150, 130, 130),
  (17, 5, 7, 500, 448, 448, 411),
  (18, 4, 11, 353, 343, 343, 308)
) AS holes(hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance)
WHERE c.name = 'Stockholms GK';