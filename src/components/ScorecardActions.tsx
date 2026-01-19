import { useState, useEffect } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScorecardCommentsSheet } from "@/components/ScorecardCommentsSheet";

interface ScorecardActionsProps {
  gameId: string;
  gameType: 'round' | 'match_play' | 'best_ball' | 'umbriago' | 'wolf' | 'scramble' | 'copenhagen' | 'skins';
  scorecardPlayerId: string;
  scorecardPlayerName: string;
}

export function ScorecardActions({ 
  gameId, 
  gameType, 
  scorecardPlayerId,
  scorecardPlayerName,
}: ScorecardActionsProps) {
  const { toast } = useToast();
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false);

  // Create a unique key for this specific scorecard
  const scorecardKey = `${gameId}_${scorecardPlayerId}`;

  useEffect(() => {
    fetchCounts();
    fetchUser();
  }, [gameId, gameType, scorecardPlayerId]);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    if (user) {
      checkUserLike(user.id);
    }
  };

  const fetchCounts = async () => {
    // Fetch likes count for this specific scorecard
    const { count: likes } = await supabase
      .from("game_likes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", scorecardKey)
      .eq("game_type", gameType);

    setLikesCount(likes || 0);

    // Fetch comments count for this specific scorecard (exclude activity items)
    const { count: comments } = await supabase
      .from("round_comments")
      .select("*", { count: "exact", head: true })
      .eq("round_id", gameId)
      .eq("game_type", gameType)
      .eq("scorecard_player_id", scorecardPlayerId)
      .is("is_activity_item", false);

    setCommentsCount(comments || 0);
  };

  const checkUserLike = async (userId: string) => {
    const { data } = await supabase
      .from("game_likes")
      .select("id")
      .eq("game_id", scorecardKey)
      .eq("game_type", gameType)
      .eq("user_id", userId)
      .maybeSingle();

    setHasLiked(!!data);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!currentUserId) {
      toast({ title: "Please sign in to like", variant: "destructive" });
      return;
    }

    setIsLiking(true);
    try {
      if (hasLiked) {
        await supabase
          .from("game_likes")
          .delete()
          .eq("game_id", scorecardKey)
          .eq("game_type", gameType)
          .eq("user_id", currentUserId);
        
        setHasLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from("game_likes")
          .insert({
            game_id: scorecardKey,
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

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentsSheetOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-1 py-2">
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            hasLiked 
              ? 'text-red-500 bg-red-50 dark:bg-red-950/30' 
              : 'text-muted-foreground hover:bg-muted'
          }`}
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart size={18} fill={hasLiked ? "currentColor" : "none"} strokeWidth={1.5} />
          {likesCount > 0 && <span className="text-sm font-medium">{likesCount}</span>}
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
          onClick={handleComment}
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          {commentsCount > 0 && <span className="text-sm font-medium">{commentsCount}</span>}
        </button>
      </div>

      <ScorecardCommentsSheet
        open={commentsSheetOpen}
        onOpenChange={setCommentsSheetOpen}
        gameId={gameId}
        gameType={gameType}
        scorecardPlayerId={scorecardPlayerId}
        scorecardPlayerName={scorecardPlayerName}
      />
    </>
  );
}
