-- Insert Presidio Golf Course
INSERT INTO public.courses (id, name, location)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Presidio Golf Course', 'San Francisco, USA');

-- Insert all 18 holes with converted distances (yards to meters)
-- Using Men's Hdcp for stroke_index
INSERT INTO public.course_holes (course_id, hole_number, par, stroke_index, white_distance, yellow_distance, blue_distance, red_distance)
VALUES 
  -- Hole 1: Par 4, SI 10, Black 372, White 349, Blue 339, Red 319
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1, 4, 10, 319, 340, 310, 292),
  -- Hole 2: Par 5, SI 16, Black 472, White 435, Blue 411, Red 350
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 5, 16, 398, 432, 376, 320),
  -- Hole 3: Par 4, SI 2, Black 385, White 365, Blue 348, Red 300
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 3, 4, 2, 334, 352, 318, 274),
  -- Hole 4: Par 3, SI 18, Black 130, White 118, Blue 108, Red 86
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 4, 3, 18, 108, 119, 99, 79),
  -- Hole 5: Par 4, SI 14, Black 307, White 298, Blue 289, Red 256
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 5, 4, 14, 272, 281, 264, 234),
  -- Hole 6: Par 4, SI 4, Black 388, White 361, Blue 347, Red 295
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 6, 4, 4, 330, 355, 317, 270),
  -- Hole 7: Par 3, SI 6, Black 219, White 184, Blue 175, Red 145
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 7, 3, 6, 168, 200, 160, 133),
  -- Hole 8: Par 4, SI 8, Black 378, White 356, Blue 348, Red 269
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 8, 4, 8, 326, 346, 318, 246),
  -- Hole 9: Par 5, SI 12, Black 524, White 493, Blue 440, Red 371
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 9, 5, 12, 451, 479, 402, 339),
  -- Hole 10: Par 5, SI 9, Black 501, White 486, Blue 469, Red 391
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 10, 5, 9, 444, 458, 429, 357),
  -- Hole 11: Par 4, SI 3, Black 419, White 387, Blue 373, Red 298
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 11, 4, 3, 354, 383, 341, 272),
  -- Hole 12: Par 4, SI 1, Black 453, White 442, Blue 368, Red 282
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 12, 4, 1, 404, 414, 336, 258),
  -- Hole 13: Par 3, SI 13, Black 180, White 169, Blue 156, Red 120
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 13, 3, 13, 155, 165, 143, 110),
  -- Hole 14: Par 4, SI 11, Black 344, White 326, Blue 304, Red 295
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 14, 4, 11, 298, 315, 278, 270),
  -- Hole 15: Par 3, SI 17, Black 171, White 147, Blue 133, Red 129
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 15, 3, 17, 134, 156, 122, 118),
  -- Hole 16: Par 4, SI 7, Black 382, White 364, Blue 338, Red 276
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 16, 4, 7, 333, 349, 309, 252),
  -- Hole 17: Par 4, SI 5, Black 350, White 343, Blue 335, Red 281
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 17, 4, 5, 314, 320, 306, 257),
  -- Hole 18: Par 5, SI 15, Black 506, White 480, Blue 465, Red 413
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 18, 5, 15, 439, 463, 425, 378);