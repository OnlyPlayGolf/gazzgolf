-- Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create course_holes table
CREATE TABLE IF NOT EXISTS public.course_holes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hole_number integer NOT NULL,
  par integer NOT NULL,
  stroke_index integer NOT NULL,
  white_distance integer,
  yellow_distance integer,
  blue_distance integer,
  red_distance integer,
  orange_distance integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id, hole_number)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_holes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - courses are public for reading
CREATE POLICY "courses_read_all" ON public.courses FOR SELECT USING (true);
CREATE POLICY "course_holes_read_all" ON public.course_holes FOR SELECT USING (true);

-- Insert Djursholms GK
INSERT INTO public.courses (name, location) 
VALUES ('Djursholms GK', 'Stockholm, Sweden')
ON CONFLICT DO NOTHING;

-- Insert course holes for Djursholms GK
WITH course AS (
  SELECT id FROM public.courses WHERE name = 'Djursholms GK' LIMIT 1
)
INSERT INTO public.course_holes (course_id, hole_number, white_distance, yellow_distance, blue_distance, red_distance, orange_distance, stroke_index, par)
SELECT 
  course.id,
  hole_number,
  white_distance,
  yellow_distance,
  blue_distance,
  red_distance,
  orange_distance,
  stroke_index,
  par
FROM course, (VALUES
  (1, 328, 323, 323, 295, 210, 11, 4),
  (2, 461, 437, 396, 396, 321, 7, 5),
  (3, 362, 348, 348, 322, 236, 5, 4),
  (4, 308, 308, 252, 252, 198, 13, 4),
  (5, 377, 345, 319, 315, 245, 3, 4),
  (6, 175, 163, 163, 149, 102, 15, 3),
  (7, 504, 479, 423, 423, 322, 9, 5),
  (8, 138, 125, 125, 112, 90, 17, 3),
  (9, 380, 370, 370, 298, 258, 1, 4),
  (10, 293, 271, 258, 223, 194, 18, 4),
  (11, 156, 146, 131, 131, 101, 14, 3),
  (12, 466, 436, 436, 380, 298, 4, 5),
  (13, 338, 308, 308, 275, 239, 8, 4),
  (14, 335, 335, 287, 287, 238, 2, 4),
  (15, 203, 180, 162, 162, 126, 16, 3),
  (16, 350, 337, 337, 294, 253, 10, 4),
  (17, 342, 337, 292, 292, 234, 6, 4),
  (18, 336, 325, 325, 293, 240, 12, 4)
) AS data(hole_number, white_distance, yellow_distance, blue_distance, red_distance, orange_distance, stroke_index, par)
ON CONFLICT (course_id, hole_number) DO NOTHING;