-- Create posts table
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Users can view posts from friends and themselves
CREATE POLICY "Users can view their own and friends posts"
ON public.posts
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.friends_pairs fp
    WHERE (fp.a = auth.uid() AND fp.b = posts.user_id)
       OR (fp.b = auth.uid() AND fp.a = posts.user_id)
  )
);

-- Users can insert their own posts
CREATE POLICY "Users can create their own posts"
ON public.posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
ON public.posts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post images
CREATE POLICY "Anyone can view post images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);