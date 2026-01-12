import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2, Trophy } from "lucide-react";
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

interface SkinsShareDialogWithScorecardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: SkinsGame;
  holes: SkinsHole[];
  players: SkinsPlayer[];
  courseHoles: CourseHole[];
  onContinue: () => void;
}

export function SkinsShareDialogWithScorecard({
  open,
  onOpenChange,
  game,
  holes,
  players,
  courseHoles,
  onContinue,
}: SkinsShareDialogWithScorecardProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');
  const { toast } = useToast();
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'skins');

  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

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

      toast({ title: "Shared to feed!" });
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Error sharing:", error);
      toast({ title: "Failed to share", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    navigate("/");
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
            <TableRow className="bg-primary/5">
              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">{nineLabel}</TableHead>
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
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
                  <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        {/* Amber Header - Skins Style */}
        <div className="bg-amber-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: Winner with trophy */}
            <div className="flex-shrink-0 w-14 text-center">
              <Trophy className="h-6 w-6 mx-auto text-amber-200" />
              <div className="text-xs opacity-75 mt-0.5">
                {winnerSkins} skin{winnerSkins !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {game.round_name || 'Skins'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm opacity-90">
                <span className="truncate">{game.course_name}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(game.date_played), "MMM d")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs opacity-75 mt-1">
                <span>Skins</span>
                <span>·</span>
                <span>{players.length} players</span>
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

        <ScrollArea className="max-h-[calc(90vh-220px)] px-4">
          <div className="space-y-4 pb-4 pt-4">
            {/* Scorecard */}
            {scorecardType === 'stroke_play' ? (
              <StrokePlayScorecardView
                players={strokePlayPlayers}
                courseHoles={effectiveCourseHoles}
              />
            ) : (
              <SkinsScorecardView />
            )}

            {showShareForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a comment (optional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[80px]"
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
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Share2 className="h-4 w-4 mr-2" />
                    )}
                    Post
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowShareForm(true)}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={handleContinue}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
