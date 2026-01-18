import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { GameHeader } from "@/components/GameHeader";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  hole_number: number | null;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export default function ScrambleFeed() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useGameAdminStatus('scramble', gameId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (gameId) {
      fetchComments();
      getCurrentUser();
      fetchGameData();
    }
  }, [gameId]);

  const fetchGameData = async () => {
    const { data } = await supabase
      .from("scramble_games")
      .select("round_name, course_name")
      .eq("id", gameId)
      .maybeSingle();
    if (data) setGameData(data);
  };

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('round_comments')
      .select('*, hole_number')
      .eq('game_id', gameId)
      .eq('game_type', 'scramble')
      .order('created_at', { ascending: false });

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
    try {
      const { data, error } = await supabase
        .from('round_comments')
        .insert({
          game_id: gameId,
          round_id: gameId!,
          game_type: 'scramble',
          user_id: currentUserId,
          content: newComment.trim()
        })
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        throw new Error("Comment was not saved. Please try again.");
      }

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      console.error("Error posting comment:", error);
      toast.error(error.message || "Failed to post comment");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishGame = async () => {
    try {
      await supabase.from("scramble_games").update({ is_finished: true }).eq("id", gameId);
      toast.success("Game finished!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("scramble_holes").delete().eq("game_id", gameId);
      await supabase.from("scramble_games").delete().eq("id", gameId);
      toast.success("Game deleted");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <GameHeader
        gameTitle={gameData?.round_name || "Scramble"}
        courseName={gameData?.course_name || ""}
        pageTitle="Game feed"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Scramble Game"
      />

      <div className="p-4 space-y-4">
        {/* Comment input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  const textarea = commentTextareaRef.current;
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                  }
                }}
                className="min-h-[2.5rem] resize-none overflow-hidden"
                rows={1}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {comment.profile?.display_name || comment.profile?.username || 'Unknown'}
                        </p>
                        {comment.hole_number && (
                          <Badge variant="secondary" className="text-xs">
                            Hole {comment.hole_number}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
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
