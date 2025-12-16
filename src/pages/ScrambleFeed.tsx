import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { Send } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export default function ScrambleFeed() {
  const { gameId } = useParams<{ gameId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      fetchComments();
      getCurrentUser();
    }
  }, [gameId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('round_comments')
      .select('*')
      .eq('game_id', gameId)
      .eq('game_type', 'scramble')
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch profiles for comments
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', userIds);

      const commentsWithProfiles = data.map(comment => ({
        ...comment,
        profile: profiles?.find(p => p.id === comment.user_id)
      }));

      setComments(commentsWithProfiles);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !currentUserId) return;

    setLoading(true);
    const { error } = await supabase
      .from('round_comments')
      .insert({
        game_id: gameId,
        round_id: gameId!, // Using gameId as round_id for compatibility
        game_type: 'scramble',
        user_id: currentUserId,
        content: newComment.trim()
      });

    if (error) {
      toast.error("Failed to post comment");
    } else {
      setNewComment("");
      fetchComments();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <h1 className="text-xl font-bold text-center">Game Feed</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Comment input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px]"
              />
              <Button
                onClick={submitComment}
                disabled={!newComment.trim() || loading}
                size="icon"
              >
                <Send size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments list */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No comments yet</p>
            <p className="text-sm">Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                      {(comment.profile?.display_name || comment.profile?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {comment.profile?.display_name || comment.profile?.username || 'Unknown'}
                      </p>
                      <p className="text-sm mt-1">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ScrambleBottomTabBar gameId={gameId!} />
    </div>
  );
}
