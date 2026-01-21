import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Image, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";

interface PostBoxProps {
  profile: any;
  userId: string;
  onPostCreated?: () => void;
}

export const PostBox = ({ profile, userId, onPostCreated }: PostBoxProps) => {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageFile) {
      toast.error("Please add some text or an image");
      return;
    }

    setIsPosting(true);
    try {
      let imageUrl = null;

      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: userId,
        content: content.trim() || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      setContent("");
      setImageFile(null);
      setImagePreview(null);
      toast.success("Post shared!");
      onPostCreated?.();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error("Failed to share post");
    } finally {
      setIsPosting(false);
    }
  };

  const displayName = profile?.display_name || profile?.username || "You";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Card className="rounded-none border-x-0">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <ProfilePhoto
            src={profile?.avatar_url}
            alt={displayName}
            fallback={displayName}
            size="md"
          />
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="What's on your golf mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[40px] h-10 py-2 resize-none border-0 bg-muted/50 focus-visible:ring-1"
            />
            
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
                  onClick={removeImage}
                >
                  <X size={14} />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCameraClick}
                disabled={isPosting}
              >
                <Image size={18} className="mr-2" />
                Photo
              </Button>
              <Button
                size="sm"
                onClick={handlePost}
                disabled={isPosting || (!content.trim() && !imageFile)}
              >
                {isPosting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
