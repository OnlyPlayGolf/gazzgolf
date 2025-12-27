import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Send, Trophy, Target, MapPin, MoreHorizontal, Pencil, Trash2, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// Parse drill result from post content
const parseDrillResult = (content: string) => {
  // Extended format with resultId: [DRILL_RESULT]title|score|unit|isPB|resultId[/DRILL_RESULT]
  const extendedMatch = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (extendedMatch) {
    return {
      drillTitle: extendedMatch[1],
      score: extendedMatch[2],
      unit: extendedMatch[3],
      isPersonalBest: extendedMatch[4] === 'true',
      resultId: extendedMatch[5],
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  // Original format without resultId
  const match = content?.match(/\[DRILL_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\[\/DRILL_RESULT\]/);
  if (match) {
    return {
      drillTitle: match[1],
      score: match[2],
      unit: match[3],
      isPersonalBest: match[4] === 'true',
      resultId: null,
      textContent: content.replace(/\[DRILL_RESULT\].+?\[\/DRILL_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse round result from post content
const parseRoundResult = (content: string) => {
  // Extended format with roundId: [ROUND_RESULT]name|course|score|vspar|holes|roundId[/ROUND_RESULT]
  const extendedMatch = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (extendedMatch) {
    return {
      roundName: extendedMatch[1],
      courseName: extendedMatch[2],
      score: parseInt(extendedMatch[3]),
      scoreVsPar: parseInt(extendedMatch[4]),
      holesPlayed: parseInt(extendedMatch[5]),
      roundId: extendedMatch[6],
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  // Original format without roundId
  const match = content?.match(/\[ROUND_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/ROUND_RESULT\]/);
  if (match) {
    return {
      roundName: match[1],
      courseName: match[2],
      score: parseInt(match[3]),
      scoreVsPar: parseInt(match[4]),
      holesPlayed: parseInt(match[5]),
      roundId: null,
      textContent: content.replace(/\[ROUND_RESULT\].+?\[\/ROUND_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse Umbriago result from post content
const parseUmbriagioResult = (content: string) => {
  // Extended format with gameId
  const extendedMatch = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (extendedMatch) {
    return {
      courseName: extendedMatch[1],
      teamAPoints: parseInt(extendedMatch[2]),
      teamBPoints: parseInt(extendedMatch[3]),
      winningTeam: extendedMatch[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: extendedMatch[5],
      teamBPlayers: extendedMatch[6],
      gameId: extendedMatch[7],
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  // Original format without gameId
  const match = content?.match(/\[UMBRIAGO_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/UMBRIAGO_RESULT\]/);
  if (match) {
    return {
      courseName: match[1],
      teamAPoints: parseInt(match[2]),
      teamBPoints: parseInt(match[3]),
      winningTeam: match[4] as 'A' | 'B' | 'TIE' | 'null',
      teamAPlayers: match[5],
      teamBPlayers: match[6],
      gameId: null,
      textContent: content.replace(/\[UMBRIAGO_RESULT\].+?\[\/UMBRIAGO_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Parse game result from post content (for Best Ball, Match Play, Skins, etc.)
const parseGameResult = (content: string) => {
  const match = content?.match(/\[GAME_RESULT\](.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\|(.+?)\[\/GAME_RESULT\]/);
  if (match) {
    return {
      gameType: match[1],
      courseName: match[2],
      winner: match[3] || null,
      resultText: match[4] || null,
      additionalInfo: match[5] || null,
      gameId: match[6] || null,
      textContent: content.replace(/\[GAME_RESULT\].+?\[\/GAME_RESULT\]/, '').trim()
    };
  }
  return null;
};

// Drill Result Card Component
const DrillResultCard = ({ drillTitle, score, unit, isPersonalBest, onClick }: { 
  drillTitle: string; 
  score: string; 
  unit: string; 
  isPersonalBest: boolean;
  onClick?: () => void;
}) => (
  <div 
    className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 transition-all cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] group"
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Drill Result</span>
      </div>
      <div className="flex items-center gap-2">
        {isPersonalBest && (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
            <Trophy className="h-3 w-3" />
            PB
          </span>
        )}
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{drillTitle}</h3>
    <div className="flex items-baseline gap-2">
      <span className="text-4xl font-bold text-primary">{score}</span>
      <span className="text-sm text-muted-foreground font-medium">{unit}</span>
    </div>
  </div>
);

// Round Result Card Component
const RoundResultCard = ({ roundName, courseName, score, scoreVsPar, holesPlayed, onClick }: { 
  roundName: string;
  courseName: string; 
  score: number; 
  scoreVsPar: number; 
  holesPlayed: number;
  onClick?: () => void;
}) => {
  const formatScoreVsPar = (diff: number) => {
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const getScoreColor = (diff: number) => {
    if (diff <= 0) return "text-green-500";
    if (diff <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div 
      className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 transition-all cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Round Result</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{holesPlayed} holes</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{roundName}</h3>
      <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {courseName}
      </p>
      <div className="flex items-center gap-6">
        <div>
          <span className="text-4xl font-bold text-primary">{score}</span>
          <span className="text-sm text-muted-foreground ml-1.5">strokes</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <span className={`text-4xl font-bold ${getScoreColor(scoreVsPar)}`}>
            {formatScoreVsPar(scoreVsPar)}
          </span>
          <span className="text-sm text-muted-foreground ml-1.5">vs par</span>
        </div>
      </div>
    </div>
  );
};

// Umbriago Result Card Component - styled to match RoundResultCard
const UmbriagioResultCard = ({ courseName, teamAPoints, teamBPoints, winningTeam, teamAPlayers, teamBPlayers, onClick }: { 
  courseName: string; 
  teamAPoints: number; 
  teamBPoints: number; 
  winningTeam: string;
  teamAPlayers: string;
  teamBPlayers: string;
  onClick?: () => void;
}) => {
  const getWinnerNames = () => {
    if (winningTeam === 'TIE') return 'Tie Game';
    if (winningTeam === 'A') return `${teamAPlayers} Win`;
    if (winningTeam === 'B') return `${teamBPlayers} Win`;
    return '';
  };

  return (
    <div 
      className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 transition-all cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Round Result</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Umbriago</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{courseName}</h3>
      {winningTeam !== 'null' && (
        <p className="text-sm text-primary font-semibold mt-1 flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          {getWinnerNames()}
        </p>
      )}
      <div className="flex items-center gap-6 mt-3">
        <div>
          <span className="text-4xl font-bold text-primary">{teamAPoints}</span>
          <span className="text-sm text-muted-foreground ml-1.5">pts</span>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <span className="text-4xl font-bold text-muted-foreground">{teamBPoints}</span>
          <span className="text-sm text-muted-foreground ml-1.5">pts</span>
        </div>
      </div>
    </div>
  );
};

// Game Result Card Component (for Best Ball, Match Play, Skins, Wolf, Copenhagen, Scramble)
// Now styled to match RoundResultCard for consistency
const GameResultCard = ({ gameType, courseName, winner, resultText, additionalInfo, onClick }: { 
  gameType: string;
  courseName: string; 
  winner: string | null;
  resultText: string | null;
  additionalInfo: string | null;
  onClick?: () => void;
}) => {
  return (
    <div 
      className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 transition-all cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Round Result</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{gameType}</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{courseName}</h3>
      {winner && (
        <p className="text-sm text-primary font-semibold mt-1 flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          {winner}
        </p>
      )}
      {resultText && (
        <p className="text-sm text-muted-foreground mt-1">{resultText}</p>
      )}
      {additionalInfo && (
        <p className="text-xs text-muted-foreground mt-2">{additionalInfo}</p>
      )}
    </div>
  );
};

interface FeedPostProps {
  post: any;
  currentUserId: string;
  onPostDeleted?: () => void;
}

export const FeedPost = ({ post, currentUserId, onPostDeleted }: FeedPostProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnPost = post.user_id === currentUserId;

  const handleProfileClick = (userId: string) => {
    navigate(`/user/${userId}`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Post deleted");
      onPostDeleted?.();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Check if this post contains a drill result, round result, umbriago result, or game result
  const drillResult = parseDrillResult(post.content);
  const roundResult = parseRoundResult(post.content);
  const umbriagioResult = parseUmbriagioResult(post.content);
  const gameResult = parseGameResult(post.content);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Post Header */}
        <div className="flex items-center gap-3">
          <Avatar 
            className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleProfileClick(post.user_id)}
          >
            {post.profile?.avatar_url ? (
              <img src={post.profile.avatar_url} alt={displayName} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <p 
              className="font-semibold text-foreground cursor-pointer hover:underline"
              onClick={() => handleProfileClick(post.user_id)}
            >
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                >
                  <MoreHorizontal size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Edit feature coming soon!")}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Post Content */}
        {drillResult ? (
          <div className="space-y-3">
            {drillResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{drillResult.textContent}</p>
            )}
            <DrillResultCard 
              drillTitle={drillResult.drillTitle}
              score={drillResult.score}
              unit={drillResult.unit}
              isPersonalBest={drillResult.isPersonalBest}
              onClick={async () => {
                if (drillResult.resultId) {
                  navigate(`/drill-result/${drillResult.resultId}`);
                } else {
                  // Try to find the result by matching drill title, user, and score
                  const { data: drillData } = await supabase
                    .rpc('get_or_create_drill_by_title', { p_title: drillResult.drillTitle });
                  if (drillData) {
                    const { data: results } = await supabase
                      .from('drill_results')
                      .select('id')
                      .eq('drill_id', drillData)
                      .eq('user_id', post.user_id)
                      .eq('total_points', parseInt(drillResult.score))
                      .order('created_at', { ascending: false })
                      .limit(1);
                    if (results && results.length > 0) {
                      navigate(`/drill-result/${results[0].id}`);
                      return;
                    }
                  }
                  toast.error("Result details not found");
                }
              }}
            />
          </div>
        ) : roundResult ? (
          <div className="space-y-3">
            {roundResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{roundResult.textContent}</p>
            )}
            <RoundResultCard 
              roundName={roundResult.roundName}
              courseName={roundResult.courseName}
              score={roundResult.score}
              scoreVsPar={roundResult.scoreVsPar}
              holesPlayed={roundResult.holesPlayed}
              onClick={async () => {
                if (roundResult.roundId) {
                  sessionStorage.setItem(`spectator_return_${roundResult.roundId}`, location.pathname);
                  navigate(`/rounds/${roundResult.roundId}/leaderboard`);
                } else {
                  // Try to find the round by matching course, user, and score
                  try {
                    const { data: rounds, error } = await supabase
                      .from('rounds')
                      .select('id')
                      .eq('user_id', post.user_id)
                      .eq('course_name', roundResult.courseName)
                      .order('created_at', { ascending: false })
                      .limit(5);
                    
                    if (error) throw error;
                    
                    if (rounds && rounds.length > 0) {
                      // Try to find exact match with score from round_summaries
                      for (const round of rounds) {
                        const { data: summary } = await supabase
                          .from('round_summaries')
                          .select('total_score')
                          .eq('round_id', round.id)
                          .single();
                        
                        if (summary?.total_score === roundResult.score) {
                          sessionStorage.setItem(`spectator_return_${round.id}`, location.pathname);
                          navigate(`/rounds/${round.id}/leaderboard`);
                          return;
                        }
                      }
                      // If no exact score match, navigate to first match by course
                      sessionStorage.setItem(`spectator_return_${rounds[0].id}`, location.pathname);
                      navigate(`/rounds/${rounds[0].id}/leaderboard`);
                      return;
                    }
                    toast.error("Round details not found");
                  } catch (error) {
                    console.error('Error finding round:', error);
                    toast.error("Round details not found");
                  }
                }
              }}
            />
          </div>
        ) : umbriagioResult ? (
          <div className="space-y-3">
            {umbriagioResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{umbriagioResult.textContent}</p>
            )}
            <UmbriagioResultCard 
              courseName={umbriagioResult.courseName}
              teamAPoints={umbriagioResult.teamAPoints}
              teamBPoints={umbriagioResult.teamBPoints}
              winningTeam={umbriagioResult.winningTeam}
              teamAPlayers={umbriagioResult.teamAPlayers}
              teamBPlayers={umbriagioResult.teamBPlayers}
              onClick={async () => {
                if (umbriagioResult.gameId) {
                  navigate(`/umbriago/${umbriagioResult.gameId}/summary`);
                } else {
                  // Try to find the game by matching course and user
                  const { data: games } = await supabase
                    .from('umbriago_games')
                    .select('id')
                    .eq('user_id', post.user_id)
                    .eq('course_name', umbriagioResult.courseName)
                    .order('created_at', { ascending: false })
                    .limit(1);
                  if (games && games.length > 0) {
                    navigate(`/umbriago/${games[0].id}/summary`);
                    return;
                  }
                  toast.error("Game details not found");
                }
              }}
            />
          </div>
        ) : gameResult ? (
          <div className="space-y-3">
            {gameResult.textContent && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{gameResult.textContent}</p>
            )}
            <GameResultCard 
              gameType={gameResult.gameType}
              courseName={gameResult.courseName}
              winner={gameResult.winner}
              resultText={gameResult.resultText}
              additionalInfo={gameResult.additionalInfo}
              onClick={() => {
                if (gameResult.gameId) {
                  // Route to appropriate summary based on game type
                  const gameType = gameResult.gameType.toLowerCase().replace(/\s+/g, '-');
                  const routeMap: Record<string, string> = {
                    'best-ball': 'best-ball',
                    'match-play': 'match-play',
                    'skins': 'skins',
                    'wolf': 'wolf',
                    'copenhagen': 'copenhagen',
                    'scramble': 'scramble',
                  };
                  const route = routeMap[gameType] || gameType;
                  navigate(`/${route}/${gameResult.gameId}/summary`);
                } else {
                  toast.error("Game details not found");
                }
              }}
            />
          </div>
        ) : post.content && (
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
                  <Avatar 
                    className="h-8 w-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleProfileClick(comment.user_id)}
                  >
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
                      <p 
                        className="text-sm font-semibold cursor-pointer hover:underline"
                        onClick={() => handleProfileClick(comment.user_id)}
                      >
                        {commentName}
                      </p>
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
