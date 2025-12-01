import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface FeedPostProps {
  post: any;
  currentUserId: string;
}

export const FeedPost = ({ post, currentUserId }: FeedPostProps) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLikes();
    loadComments();
  }, [post.id]);

  const loadLikes = async () => {
    const { data: likes } = await supabase
      .from("post_likes")
      .select("*")
      .eq("post_id", post.id);

    if (likes) {
      setLikeCount(likes.length);
      setLiked(likes.some((like) => like.user_id === currentUserId));
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select(`
        *,
        profiles:user_id (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data) {
      setComments(data);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        setLiked(false);
        setLikeCount((prev) => prev - 1);
      } else {
        await supabase
          .from("post_likes")
          .insert({ post_id: post.id, user_id: currentUserId });
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      await loadComments();
      toast.success("Comment added");
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = post.profile?.display_name || post.profile?.username || "User";
  const initials = displayName.charAt(0).toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Post Header */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {post.profile?.avatar_url ? (
              <img src={post.profile.avatar_url} alt={displayName} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>

        {/* Post Content */}
        {post.content && (
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Post Image */}
        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post"
            className="w-full rounded-lg object-cover max-h-96"
          />
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={liked ? "text-red-500" : ""}
          >
            <Heart size={18} className={`mr-2 ${liked ? "fill-current" : ""}`} />
            {likeCount} {likeCount === 1 ? "Like" : "Likes"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle size={18} className="mr-2" />
            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-3 border-t">
            {/* Existing Comments */}
            {comments.map((comment) => {
              const commentName = comment.profiles?.display_name || comment.profiles?.username || "User";
              const commentInitials = commentName.charAt(0).toUpperCase();
              const commentTime = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

              return (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {comment.profiles?.avatar_url ? (
                      <img
                        src={comment.profiles.avatar_url}
                        alt={commentName}
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {commentInitials}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-sm font-semibold">{commentName}</p>
                      <p className="text-sm text-foreground">{comment.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-2">{commentTime}</p>
                  </div>
                </div>
              );
            })}

            {/* New Comment Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
