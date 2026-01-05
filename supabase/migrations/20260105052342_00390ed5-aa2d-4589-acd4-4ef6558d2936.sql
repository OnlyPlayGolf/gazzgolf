
-- Add new tee distance columns to course_holes table
ALTER TABLE public.course_holes 
ADD COLUMN IF NOT EXISTS black_distance integer,
ADD COLUMN IF NOT EXISTS silver_distance integer,
ADD COLUMN IF NOT EXISTS gold_distance integer;

-- Insert PGA West – Mountain Course with auto-generated UUID
INSERT INTO public.courses (name, location, tee_names)
VALUES (
  'PGA West – Mountain Course',
  'La Quinta, California, USA',
  '{"Black": "Black", "White": "White", "Silver": "Silver", "Gold": "Gold", "Red": "Red", "Orange": "Orange"}'::jsonb
);

-- Insert all 18 holes with distances for each tee
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, black_distance, white_distance, silver_distance, gold_distance, red_distance, orange_distance)
SELECT 
  c.id,
  v.hole_number,
  v.par,
  v.stroke_index,
  v.black_distance,
  v.white_distance,
  v.silver_distance,
  v.gold_distance,
  v.red_distance,
  v.orange_distance
FROM public.courses c
CROSS JOIN (VALUES
  -- Front 9
  (1, 4, 8, 368, 352, 312, 294, 283, 235),
  (2, 3, 18, 205, 190, 170, 158, 134, 100),
  (3, 4, 14, 349, 336, 304, 263, 263, 210),
  (4, 5, 10, 508, 494, 437, 414, 384, 285),
  (5, 3, 16, 162, 151, 122, 112, 95, 93),
  (6, 4, 4, 400, 352, 321, 301, 264, 206),
  (7, 5, 12, 492, 471, 446, 404, 379, 305),
  (8, 4, 6, 400, 367, 335, 308, 279, 210),
  (9, 4, 2, 433, 403, 372, 352, 302, 200),
  -- Back 9
  (10, 4, 9, 372, 361, 324, 302, 245, 190),
  (11, 4, 7, 398, 375, 353, 346, 287, 230),
  (12, 4, 13, 373, 343, 332, 311, 300, 225),
  (13, 3, 15, 183, 162, 140, 134, 108, 95),
  (14, 4, 1, 389, 377, 358, 310, 303, 215),
  (15, 5, 5, 517, 502, 490, 464, 456, 370),
  (16, 3, 17, 167, 157, 89, 89, 89, 69),
  (17, 4, 3, 446, 412, 371, 323, 274, 215),
  (18, 5, 11, 504, 475, 456, 407, 399, 292)
) AS v(hole_number, par, stroke_index, black_distance, white_distance, silver_distance, gold_distance, red_distance, orange_distance)
WHERE c.name = 'PGA West – Mountain Course';
