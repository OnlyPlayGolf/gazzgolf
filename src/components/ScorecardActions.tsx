import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScorecardCommentsSheet } from "@/components/ScorecardCommentsSheet";

const loggedErrors = new Set<string>();
const logErrorOnce = (key: string, error: unknown) => {
  if (loggedErrors.has(key)) return;
  loggedErrors.add(key);
  console.error(key, error);
};

/** Stable unique id per scorecard (e.g. one per player card in round leaderboard). */
export function getScorecardId(
  gameType: string,
  gameId: string,
  scorecardPlayerId: string
): string {
  return `${gameType}:${gameId}:${scorecardPlayerId}`;
}

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
  /** While non-null, ignore checkUserLike/fetchCounts results so optimistic like isn't overwritten. */
  const pendingLikeRef = useRef<boolean | null>(null);
  /** Prevent double-fire (e.g. touch + click) from reverting the like. */
  const likeInProgressRef = useRef(false);
  /** Scorecards the user has liked this session; never let server "false" overwrite these. */
  const userLikedInSessionRef = useRef<Set<string>>(new Set());

  const isValidId = (id: string | undefined | null): id is string =>
    !!id && typeof id === 'string' && id.trim() !== '';

  const scorecardId = isValidId(gameType) && isValidId(gameId) && isValidId(scorecardPlayerId)
    ? getScorecardId(gameType, gameId, scorecardPlayerId)
    : null;

  useEffect(() => {
    if (!scorecardId) {
      setHasLiked(false);
      setLikesCount(0);
      setCommentsCount(0);
      return;
    }
    fetchCounts();
    fetchUser();
  }, [scorecardId, gameId, gameType, scorecardPlayerId]);

  const fetchUser = async () => {
    if (!scorecardId) {
      setCurrentUserId(null);
      setHasLiked(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);
    if (user?.id) {
      checkUserLike(user.id);
    } else {
      setHasLiked(false);
    }
  };

  const fetchCounts = async () => {
    if (!scorecardId || !isValidId(gameId) || !isValidId(scorecardPlayerId)) {
      setLikesCount(0);
      setCommentsCount(0);
      return;
    }

    try {
      const { count: likes, error: likesError } = await supabase
        .from("scorecard_likes")
        .select("id", { count: "exact", head: true })
        .eq("scorecard_id", scorecardId);

      if (likesError) {
        logErrorOnce(`[ScorecardActions] scorecard_likes count (${scorecardId})`, likesError);
        if (pendingLikeRef.current === null) setLikesCount(0);
      } else {
        if (pendingLikeRef.current === null) setLikesCount(likes ?? 0);
      }
    } catch (error) {
      logErrorOnce(`[ScorecardActions] scorecard_likes count exception (${scorecardId})`, error);
      setLikesCount(0);
    }

    try {
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
      setCommentsCount(comments ?? 0);
    } catch (error) {
      console.error("Unexpected error in fetchCounts:", error);
    }
  };

  const checkUserLike = async (userId: string) => {
    if (!scorecardId || !isValidId(userId)) {
      if (pendingLikeRef.current === null && !(scorecardId && userLikedInSessionRef.current.has(scorecardId))) setHasLiked(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("scorecard_likes")
        .select("id")
        .eq("scorecard_id", scorecardId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        logErrorOnce(`[ScorecardActions] scorecard_likes likedByMe (${scorecardId})`, error);
        if (pendingLikeRef.current === null && !userLikedInSessionRef.current.has(scorecardId)) setHasLiked(false);
        return;
      }
      if (data) {
        setHasLiked(true);
      } else if (pendingLikeRef.current === null && !userLikedInSessionRef.current.has(scorecardId)) {
        setHasLiked(false);
      }
    } catch (error) {
      logErrorOnce(`[ScorecardActions] scorecard_likes likedByMe exception (${scorecardId})`, error);
      if (pendingLikeRef.current === null && !userLikedInSessionRef.current.has(scorecardId)) setHasLiked(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!scorecardId) return;
    if (!currentUserId) {
      toast({ title: "Please sign in to like", variant: "destructive" });
      return;
    }
    if (likeInProgressRef.current) return;
    likeInProgressRef.current = true;

    setIsLiking(true);
    const wasLiked = hasLiked;
    const newLiked = !wasLiked;
    pendingLikeRef.current = newLiked;
    setHasLiked(newLiked);
    setLikesCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("scorecard_likes")
          .delete()
          .eq("scorecard_id", scorecardId)
          .eq("user_id", currentUserId);
        if (error) throw error;
        userLikedInSessionRef.current.delete(scorecardId);
      } else {
        const { error } = await supabase
          .from("scorecard_likes")
          .insert({ scorecard_id: scorecardId, user_id: currentUserId });
        if (error) {
          const isDuplicate = (error as { code?: string }).code === "23505";
          if (!isDuplicate) throw error;
        }
        userLikedInSessionRef.current.add(scorecardId);
      }
    } catch (error) {
      logErrorOnce(`[ScorecardActions] scorecard_likes toggle (${scorecardId})`, error);
      setHasLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
      toast({ title: "Error", description: "Failed to update like", variant: "destructive" });
    } finally {
      pendingLikeRef.current = null;
      likeInProgressRef.current = false;
      setIsLiking(false);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCommentsSheetOpen(true);
  };

  return (
    <>
      {/* Wrapper stops propagation so clicking Like/Comment never expands/collapses card or navigates */}
      <div
        className="relative z-10 flex items-center gap-1 py-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
        role="group"
        aria-label="Scorecard actions"
      >
        <button
          type="button"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer touch-manipulation ${
            hasLiked
              ? 'text-red-500 bg-red-50 dark:bg-red-950/30'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          onClick={handleLike}
          disabled={isLiking}
          aria-pressed={hasLiked}
          aria-label={hasLiked ? 'Unlike' : 'Like'}
        >
          <Heart size={18} fill={hasLiked ? "currentColor" : "none"} strokeWidth={1.5} />
          <span className="text-sm font-medium">{likesCount} {likesCount === 1 ? "Like" : "Likes"}</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer touch-manipulation"
          onClick={handleComment}
          aria-label="Comments"
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium">{commentsCount} {commentsCount === 1 ? "Comment" : "Comments"}</span>
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
