import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardActionsProps {
  gameId: string;
  gameType: 'round' | 'match_play' | 'best_ball' | 'umbriago' | 'wolf' | 'scramble' | 'copenhagen' | 'skins';
  feedPath: string;
}

export function LeaderboardActions({ gameId, gameType, feedPath }: LeaderboardActionsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    fetchCounts();
    fetchUser();
  }, [gameId, gameType]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    if (user) {
      checkUserLike(user.id);
    }
  };

  const fetchCounts = async () => {
    // Fetch likes count
    const { count: likes } = await supabase
      .from("game_likes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("game_type", gameType);

    setLikesCount(likes || 0);

    // Fetch comments count
    const { count: comments } = await supabase
      .from("round_comments")
      .select("*", { count: "exact", head: true })
      .eq("round_id", gameId)
      .eq("game_type", gameType);

    setCommentsCount(comments || 0);
  };

  const checkUserLike = async (userId: string) => {
    const { data } = await supabase
      .from("game_likes")
      .select("id")
      .eq("game_id", gameId)
      .eq("game_type", gameType)
      .eq("user_id", userId)
      .maybeSingle();

    setHasLiked(!!data);
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast({ title: "Please sign in to like", variant: "destructive" });
      return;
    }

    setIsLiking(true);
    try {
      if (hasLiked) {
        // Unlike
        await supabase
          .from("game_likes")
          .delete()
          .eq("game_id", gameId)
          .eq("game_type", gameType)
          .eq("user_id", currentUserId);
        
        setHasLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        // Like
        await supabase
          .from("game_likes")
          .insert({
            game_id: gameId,
            game_type: gameType,
            user_id: currentUserId,
          });
        
        setHasLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({ title: "Error", description: "Failed to update like", variant: "destructive" });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-6 py-4 border-t">
      <Button
        variant="ghost"
        size="sm"
        className={`flex-col h-auto gap-1 ${hasLiked ? 'text-red-500' : ''}`}
        onClick={handleLike}
        disabled={isLiking}
      >
        <Heart size={20} fill={hasLiked ? "currentColor" : "none"} />
        <span className="text-xs">{likesCount > 0 ? likesCount : 'Like'}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="flex-col h-auto gap-1"
        onClick={() => navigate(feedPath)}
      >
        <MessageCircle size={20} className="text-primary" />
        <span className="text-xs">{commentsCount > 0 ? commentsCount : 'Comment'}</span>
      </Button>
    </div>
  );
}
