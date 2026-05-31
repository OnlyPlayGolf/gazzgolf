-- Add image_url column to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for group images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload group images
CREATE POLICY "Authenticated users can upload group images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'group-images');

-- Allow public read access to group images
CREATE POLICY "Public can view group images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-images');

-- Allow users to update their own group images
CREATE POLICY "Users can update their own group images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'group-images');

-- Allow users to delete their own group images
CREATE POLICY "Users can delete their own group images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'group-images');
