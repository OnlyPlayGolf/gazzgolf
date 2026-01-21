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

interface LeaderboardActionsProps {
  gameId: string;
  gameType: 'round' | 'match_play' | 'best_ball' | 'umbriago' | 'wolf' | 'scramble' | 'copenhagen' | 'skins';
  feedPath: string;
  scorecardPlayerId?: string;
  scorecardPlayerName?: string;
}

export function LeaderboardActions({ 
  gameId, 
  gameType, 
  feedPath,
  scorecardPlayerId,
  scorecardPlayerName = "Game",
}: LeaderboardActionsProps) {
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
    // Never block render: if IDs aren't ready, reset likes UI to safe defaults and keep going.
    if (!isValidId(gameId) || !isValidId(gameType)) {
      setHasLiked(false);
      setLikesCount(0);
      setCommentsCount(0);
      setCurrentUserId(null);
      return;
    }

    fetchCounts();
    if (!hasFetchedUserRef.current) {
      hasFetchedUserRef.current = true;
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, gameType]);

  const fetchUser = async () => {
    // likedByMe is optional; never block UI.
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
    if (!isValidId(gameId) || !isValidId(gameType)) {
      setLikesCount(0);
      setCommentsCount(0);
      return;
    }

    try {
      // Fetch likes count
      const { count: likes, error: likesError } = await supabase
        .from("game_likes")
        .select("id", { count: "exact", head: true })
        .eq("game_id", gameId)
        .eq("game_type", gameType);

      if (likesError) {
        logGameLikesErrorOnce(
          `[LeaderboardActions] game_likes count failed (${gameType}:${gameId})`,
          likesError
        );
        setLikesCount(0);
      } else {
        setLikesCount(likes || 0);
      }
    } catch (error) {
      logGameLikesErrorOnce(
        `[LeaderboardActions] game_likes count exception (${gameType}:${gameId})`,
        error
      );
      setLikesCount(0);
    }

    try {
      // Fetch comments count (independent from likes)
      const { count: comments, error: commentsError } = await supabase
        .from("round_comments")
        .select("id", { count: "exact", head: true })
        .eq("round_id", gameId)
        .eq("game_type", gameType);

      if (commentsError) {
        console.error("Error fetching comments count:", commentsError);
        return;
      }

      setCommentsCount(comments || 0);
    } catch (error) {
      console.error("Unexpected error fetching comments count:", error);
    }
  };

  const checkUserLike = async (userId: string) => {
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
          `[LeaderboardActions] game_likes likedByMe failed (${gameType}:${gameId}:${userId})`,
          error
        );
        setHasLiked(false);
        return;
      }

      setHasLiked(!!data);
    } catch (error) {
      logGameLikesErrorOnce(
        `[LeaderboardActions] game_likes likedByMe exception (${gameType}:${gameId}:${userId})`,
        error
      );
      setHasLiked(false);
    }
  };

  const handleLike = async () => {
    if (!isValidId(currentUserId) || !isValidId(gameId) || !isValidId(gameType)) {
      if (!isValidId(currentUserId)) {
        toast({ title: "Please sign in to like", variant: "destructive" });
      }
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
    <>
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
          onClick={() => setCommentsSheetOpen(true)}
        >
          <MessageCircle size={20} className="text-primary" />
          <span className="text-xs">{commentsCount > 0 ? commentsCount : 'Comment'}</span>
        </Button>
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
