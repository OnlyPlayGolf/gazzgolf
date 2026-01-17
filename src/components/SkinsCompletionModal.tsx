import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkinsPlayer {
  id?: string;
  odId?: string;
  name: string;
  displayName?: string;
  handicap?: number | null;
  tee?: string | null;
  avatarUrl?: string | null;
}

interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  player_scores: Record<string, number>;
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

interface SkinsGame {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  round_name: string | null;
  user_id: string;
  is_finished: boolean;
  skin_value: number;
  carryover_enabled: boolean;
  use_handicaps: boolean;
  players: any;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface SkinsCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: SkinsGame;
  holes: SkinsHole[];
  players: SkinsPlayer[];
  courseHoles: CourseHole[];
}

export function SkinsCompletionModal({
  open,
  onOpenChange,
  game,
  holes,
  players,
  courseHoles,
}: SkinsCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset textarea height when share form is closed
  useEffect(() => {
    if (!showShareForm && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = '2.5rem';
      setComment("");
    }
  }, [showShareForm]);
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'skins');

  const getPlayerId = (player: SkinsPlayer) => {
    return player.odId || player.id || player.name;
  };

  const getPlayerName = (player: SkinsPlayer) => {
    return player.displayName || player.name || "Player";
  };

  const getPlayerSkinCount = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    return holes
      .filter(h => h.winner_player === playerId)
      .reduce((sum, h) => sum + h.skins_available, 0);
  };

  const getPlayerTotalScore = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    let total = 0;
    for (const hole of holes) {
      const score = hole.player_scores[playerId];
      if (score && score > 0) {
        total += score;
      }
    }
    return total;
  };

  // Sort players by skin count for display
  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b) - getPlayerSkinCount(a)
  );

  const winner = sortedPlayers[0];
  const winnerName = winner ? getPlayerName(winner) : 'N/A';
  const winnerSkins = winner ? getPlayerSkinCount(winner) : 0;

  // Prepare stroke play data
  const strokePlayPlayers = players.map(player => {
    const playerId = getPlayerId(player);
    const scores = new Map<number, number>();
    let total = 0;
    
    holes.forEach(hole => {
      const score = hole.player_scores[playerId];
      if (score && score > 0) {
        scores.set(hole.hole_number, score);
        total += score;
      }
    });
    
    return { name: getPlayerName(player), scores, totalScore: total };
  });

  // Build course holes from skins holes if not provided
  const effectiveCourseHoles: CourseHole[] = courseHoles.length > 0 
    ? courseHoles 
    : holes.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: 0 }));

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Mark game as finished first
      await supabase
        .from("skins_games")
        .update({ is_finished: true })
        .eq("id", game.id);

      // Build scorecard data for the post
      const playerScoresData: Record<string, { name: string; skins: number; total: number }> = {};
      players.forEach(player => {
        const playerId = getPlayerId(player);
        playerScoresData[playerId] = {
          name: getPlayerName(player),
          skins: getPlayerSkinCount(player),
          total: getPlayerTotalScore(player),
        };
      });

      const holeResultsData: Record<number, { winnerId: string | null; skinsAvailable: number; par: number }> = {};
      holes.forEach(hole => {
        holeResultsData[hole.hole_number] = {
          winnerId: hole.winner_player,
          skinsAvailable: hole.skins_available,
          par: hole.par,
        };
      });

      const scorecardJson = JSON.stringify({
        playerScores: playerScoresData,
        holeResults: holeResultsData,
      });

      // Create structured skins scorecard marker
      // Format: [SKINS_SCORECARD]roundName|courseName|date|winnerId|winnerName|winnerSkins|gameId|scorecardJson[/SKINS_SCORECARD]
      const winnerId = winner ? getPlayerId(winner) : '';
      const skinsScorecard = `[SKINS_SCORECARD]${game.round_name || 'Skins'}|${game.course_name}|${game.date_played}|${winnerId}|${winnerName}|${winnerSkins}|${game.id}|${scorecardJson}[/SKINS_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${skinsScorecard}`
        : skinsScorecard;

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: postContent,
      });

      if (error) throw error;

      toast({ title: "Shared!", description: "Your round has been posted" });
      setShowShareForm(false);
      setComment("");
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Error sharing:", error);
      toast({ title: "Error", description: "Failed to share round", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDone = async () => {
    try {
      // Mark game as finished before navigating
      await supabase
        .from("skins_games")
        .update({ is_finished: true })
        .eq("id", game.id);
      
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Error finishing game:", error);
      // Still navigate even if update fails
      onOpenChange(false);
      navigate("/");
    }
  };

  // Skins scorecard component
  const SkinsScorecardView = () => {
    const frontNine = effectiveCourseHoles.filter(h => h.hole_number <= 9);
    const backNine = effectiveCourseHoles.filter(h => h.hole_number > 9);
    const hasBackNine = backNine.length > 0;

    const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
      if (nineHoles.length === 0) return null;

      const nineLabel = isBackNine ? 'In' : 'Out';

      return (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">{nineLabel}</TableHead>
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Par row */}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                  {hole.par}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {nineHoles.reduce((sum, h) => sum + h.par, 0)}
              </TableCell>
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {isBackNine ? effectiveCourseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
              </TableCell>
            </TableRow>

            {/* Player rows */}
            {sortedPlayers.map((player, index) => {
              const playerId = getPlayerId(player);
              let nineTotal = 0;
              
              nineHoles.forEach(hole => {
                const holeData = holes.find(h => h.hole_number === hole.hole_number);
                if (holeData) {
                  const score = holeData.player_scores[playerId];
                  if (score && score > 0) {
                    nineTotal += score;
                  }
                }
              });

              const totalScore = getPlayerTotalScore(player);
              const skinCount = getPlayerSkinCount(player);

              return (
                <TableRow key={index}>
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
                    {getPlayerName(player).split(' ')[0]}
                  </TableCell>
                  {nineHoles.map(hole => {
                    const holeData = holes.find(h => h.hole_number === hole.hole_number);
                    const score = holeData?.player_scores[playerId];
                    const isWinner = holeData?.winner_player === playerId;
                    
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-[10px] px-0 py-1 ${isWinner ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : ''}`}
                      >
                        {score && score > 0 ? score : ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {nineTotal > 0 ? nineTotal : ''}
                  </TableCell>
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {(isBackNine || !hasBackNine) && totalScore > 0 ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span>{totalScore}</span>
                        {skinCount > 0 && (
                          <Trophy size={10} className="text-amber-600" />
                        )}
                      </div>
                    ) : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      );
    };

    return (
      <div className="border rounded-lg overflow-hidden">
        {renderNine(frontNine, false)}
        {hasBackNine && (
          <div className="border-t">
            {renderNine(backNine, true)}
          </div>
        )}
        {/* Skins summary */}
        <div className="border-t p-2 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Skins Won:</span>
            <div className="flex gap-2">
              {sortedPlayers.map((player, idx) => (
                <span key={idx} className="text-xs font-bold">
                  {getPlayerName(player).split(' ')[0]}: {getPlayerSkinCount(player)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Round Card Style Header - Matching Profile Round Cards */}
        <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: Winner with trophy and skins count */}
            <div className="flex-shrink-0 w-14 text-center">
              <Trophy className="h-6 w-6 mx-auto text-foreground mb-1" />
              <div className="text-sm font-bold text-foreground">
                {winnerSkins}
              </div>
              <div className="text-xs text-muted-foreground">
                skin{winnerSkins !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-foreground">
                {game.round_name || 'Skins'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <span className="truncate">{game.course_name}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(game.date_played), "MMM d")}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="text-muted-foreground">Winner: </span>
                <span className="font-semibold text-amber-600">{winnerName}</span>
                <span className="text-muted-foreground"> · {winnerSkins} skin{winnerSkins !== 1 ? 's' : ''} won</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Type Selector */}
        <ScorecardTypeSelector
          primaryLabel="Skins"
          selectedType={scorecardType}
          onTypeChange={setScorecardType}
          strokePlayEnabled={strokePlayEnabled}
        />

        {/* Scorecard */}
        {effectiveCourseHoles.length > 0 && (
          <div className="px-4 pt-3">
            {scorecardType === 'stroke_play' ? (
              <StrokePlayScorecardView
                players={strokePlayPlayers}
                courseHoles={effectiveCourseHoles}
              />
            ) : (
              <SkinsScorecardView />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="p-4">
          {showShareForm ? (
            <div className="space-y-3">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Add your post-round thoughts..."
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  const textarea = commentTextareaRef.current;
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                  }
                }}
                className="min-h-[2.5rem] resize-none overflow-hidden"
                rows={1}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowShareForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Post"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowShareForm(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={handleDone}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
