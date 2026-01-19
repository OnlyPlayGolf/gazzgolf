import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScorecardCommentsSheet } from "@/components/ScorecardCommentsSheet";

const loggedGameLikesErrors = new Set<string>();
const logGameLikesErrorOnce = (key: string, error: unknown) => {
  if (loggedGameLikesErrors.has(key)) return;
  loggedGameLikesErrors.add(key);
  console.error(key, error);
};

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
  const hasFetchedUserRef = useRef(false);

  // Helper to validate IDs
  const isValidId = (id: string | undefined | null): id is string => {
    return !!id && typeof id === 'string' && id.trim() !== '';
  };

  useEffect(() => {
    // Never block render: if required IDs aren't ready, just reset likes UI to safe defaults.
    if (!isValidId(gameId) || !isValidId(gameType) || !isValidId(scorecardPlayerId)) {
      setHasLiked(false);
      setLikesCount(0);
      // Comments are also tied to these IDs, so we can't fetch them either.
      setCommentsCount(0);
      return;
    }

    fetchCounts();
    if (!hasFetchedUserRef.current) {
      hasFetchedUserRef.current = true;
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, gameType, scorecardPlayerId]);

  const fetchUser = async () => {
    // Likes-by-me is optional; never block scorecard UI.
    if (!isValidId(gameId) || !isValidId(gameType)) {
      setCurrentUserId(null);
      setHasLiked(false);
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    if (user && isValidId(user.id)) {
      checkUserLike(user.id);
    } else {
      setHasLiked(false);
    }
  };

  const fetchCounts = async () => {
    if (!isValidId(gameId) || !isValidId(gameType) || !isValidId(scorecardPlayerId)) {
      setLikesCount(0);
      setCommentsCount(0);
      return;
    }

    try {
      // Likes are per-game (game_id is UUID). Treat likes as optional.
      const { count: likes, error: likesError } = await supabase
        .from("game_likes")
        .select("id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("game_type", gameType);

      if (likesError) {
        logGameLikesErrorOnce(
          `[ScorecardActions] game_likes count failed (${gameType}:${gameId})`,
          likesError
        );
        setLikesCount(0);
      } else {
        setLikesCount(likes || 0);
      }
    } catch (error) {
      logGameLikesErrorOnce(
        `[ScorecardActions] game_likes count exception (${gameType}:${gameId})`,
        error
      );
      setLikesCount(0);
    }

    try {
      // Fetch comments count for this specific scorecard (exclude activity items)
      const { count: comments, error: commentsError } = await supabase
        .from("round_comments")
        .select("id", { count: "exact", head: true })
        .eq("round_id", gameId)
        .eq("game_type", gameType)
        .eq("scorecard_player_id", scorecardPlayerId)
        .is("is_activity_item", false);

      if (commentsError) {
        console.error("Error fetching comments count:", commentsError);
        return;
      }

      setCommentsCount(comments || 0);
    } catch (error) {
      console.error("Unexpected error in fetchCounts:", error);
    }
  };

  const checkUserLike = async (userId: string) => {
    // likedByMe is optional, never block UI.
    if (!isValidId(gameId) || !isValidId(gameType) || !isValidId(userId)) {
      setHasLiked(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("game_likes")
        .select("id")
        .eq("game_id", gameId)
        .eq("game_type", gameType)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        logGameLikesErrorOnce(
          `[ScorecardActions] game_likes likedByMe failed (${gameType}:${gameId}:${userId})`,
          error
        );
        setHasLiked(false);
        return;
      }

      setHasLiked(!!data);
    } catch (error) {
      logGameLikesErrorOnce(
        `[ScorecardActions] game_likes likedByMe exception (${gameType}:${gameId}:${userId})`,
        error
      );
      setHasLiked(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isValidId(currentUserId) || !isValidId(gameId) || !isValidId(gameType)) {
      if (!isValidId(currentUserId)) {
        toast({ title: "Please sign in to like", variant: "destructive" });
      }
      return;
    }

    setIsLiking(true);
    try {
      if (hasLiked) {
        await supabase
          .from("game_likes")
          .delete()
          .eq("game_id", gameId)
          .eq("game_type", gameType)
          .eq("user_id", currentUserId);
        
        setHasLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
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
      logGameLikesErrorOnce(
        `[ScorecardActions] game_likes toggle failed (${gameType}:${gameId}:${currentUserId})`,
        error
      );
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
