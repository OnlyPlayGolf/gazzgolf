import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { WolfGame, WolfHole } from "@/types/wolf";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface WolfCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: WolfGame;
  holes: WolfHole[];
  courseHoles: CourseHole[];
}

export function WolfCompletionModal({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
}: WolfCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset textarea height when share form is closed
  useEffect(() => {
    if (!showShareForm && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = '2.5rem';
      setComment("");
    }
  }, [showShareForm]);

  const getPlayerCount = () => {
    let count = 4;
    if (game.player_4) count = 5;
    if (game.player_5) count = 6;
    return count;
  };

  const getPlayerName = (num: number): string => {
    switch (num) {
      case 1: return game.player_1;
      case 2: return game.player_2;
      case 3: return game.player_3;
      case 4: return game.player_4 || '';
      case 5: return game.player_5 || '';
      case 6: return game.player_6 || '';
      default: return '';
    }
  };

  const getPlayerPoints = (num: number): number => {
    switch (num) {
      case 1: return game.player_1_points;
      case 2: return game.player_2_points;
      case 3: return game.player_3_points;
      case 4: return game.player_4_points;
      case 5: return game.player_5_points;
      case 6: return game.player_6_points;
      default: return 0;
    }
  };

  const getHoleScore = (holeNumber: number, playerNum: number): number | null => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_score;
      case 2: return hole.player_2_score;
      case 3: return hole.player_3_score;
      case 4: return hole.player_4_score;
      case 5: return hole.player_5_score;
      case 6: return hole.player_6_score;
      default: return null;
    }
  };

  const getHolePoints = (holeNumber: number, playerNum: number): number | null => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_hole_points;
      case 2: return hole.player_2_hole_points;
      case 3: return hole.player_3_hole_points;
      case 4: return hole.player_4_hole_points;
      case 5: return hole.player_5_hole_points;
      case 6: return hole.player_6_hole_points;
      default: return null;
    }
  };

  const playerCount = getPlayerCount();
  const players = Array.from({ length: playerCount }, (_, i) => ({
    num: i + 1,
    name: getPlayerName(i + 1),
    points: getPlayerPoints(i + 1),
  })).sort((a, b) => b.points - a.points);

  const winner = players[0];

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

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
        .from("wolf_games")
        .update({ is_finished: true })
        .eq("id", game.id);

      // Build scorecard data for sharing
      const playerScoresData: Record<string, { name: string; points: number }> = {};
      Array.from({ length: playerCount }, (_, i) => {
        const num = i + 1;
        playerScoresData[num.toString()] = {
          name: getPlayerName(num),
          points: getPlayerPoints(num),
        };
      });

      const holeResultsData: Record<number, { scores: Record<number, number | null>; points: Record<number, number | null> }> = {};
      holes.forEach(hole => {
        holeResultsData[hole.hole_number] = {
          scores: {
            1: hole.player_1_score,
            2: hole.player_2_score,
            3: hole.player_3_score,
            4: hole.player_4_score,
            5: hole.player_5_score,
            6: hole.player_6_score,
          },
          points: {
            1: hole.player_1_hole_points,
            2: hole.player_2_hole_points,
            3: hole.player_3_hole_points,
            4: hole.player_4_hole_points,
            5: hole.player_5_hole_points,
            6: hole.player_6_hole_points,
          },
        };
      });

      const scorecardJson = JSON.stringify({
        playerScores: playerScoresData,
        holeResults: holeResultsData,
      });

      const wolfScorecard = `[WOLF_SCORECARD]${game.round_name || 'Wolf'}|${game.course_name}|${game.date_played}|${winner.name}|${winner.points}|${game.id}|${scorecardJson}[/WOLF_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${wolfScorecard}`
        : wolfScorecard;

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
    // Mark game as finished before navigating
    await supabase
      .from("wolf_games")
      .update({ is_finished: true })
      .eq("id", game.id)
      .catch((error) => {
        console.error("Error finishing game:", error);
      });
    
    onOpenChange(false);
    navigate("/");
  };

  // Wolf scorecard component - matches WolfLeaderboard style
  const WolfScorecardView = () => {
    return (
      <div className="space-y-4">
        {players.map((player) => {
          const frontNineTotal = frontNine.reduce((sum, h) => {
            const s = getHoleScore(h.hole_number, player.num);
            if (s === null || s === -1) return sum;
            return sum + s;
          }, 0);

          const backNineTotal = backNine.reduce((sum, h) => {
            const s = getHoleScore(h.hole_number, player.num);
            if (s === null || s === -1) return sum;
            return sum + s;
          }, 0);

          const fullTotal = frontNineTotal + backNineTotal;

          const frontNinePoints = frontNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0);
          const backNinePoints = backNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0);
          const fullPoints = frontNinePoints + backNinePoints;

          return (
            <div key={player.num} className="border rounded-lg overflow-hidden">
              {/* Front 9 */}
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px] bg-primary text-primary-foreground">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">Out</TableHead>
                    {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">HCP</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                        {hole.stroke_index}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                    {backNine.length > 0 && <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                    {frontNine.map(hole => {
                      const rawScore = getHoleScore(hole.hole_number, player.num);
                      const score = rawScore === -1 ? null : rawScore;
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className="text-center px-0 py-1"
                        >
                          {score !== null ? (
                            <ScorecardScoreCell score={score} par={hole.par} />
                          ) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNineTotal > 0 ? frontNineTotal : ''}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getHolePoints(hole.hole_number, player.num);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-[10px] px-0 py-1 ${
                            points !== null && points > 0 ? 'text-green-600' : 
                            points !== null && points < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNinePoints || ''}
                    </TableCell>
                    {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                  </TableRow>
                </TableBody>
              </Table>

              {/* Back 9 */}
              {backNine.length > 0 && (
                <div className="border-t">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-primary">
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px] bg-primary text-primary-foreground">Hole</TableHead>
                        {backNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">In</TableHead>
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">Tot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">HCP</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                            {hole.stroke_index}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNine.reduce((sum, h) => sum + h.par, 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {frontNine.reduce((sum, h) => sum + h.par, 0) + backNine.reduce((sum, h) => sum + h.par, 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px] max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                        {backNine.map(hole => {
                          const rawScore = getHoleScore(hole.hole_number, player.num);
                          const score = rawScore === -1 ? null : rawScore;
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className="text-center px-0 py-1"
                            >
                              {score !== null ? (
                                <ScorecardScoreCell score={score} par={hole.par} />
                              ) : ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNineTotal > 0 ? backNineTotal : ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {fullTotal > 0 ? fullTotal : ''}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Points</TableCell>
                        {backNine.map(hole => {
                          const points = getHolePoints(hole.hole_number, player.num);
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className={`text-center font-bold text-[10px] px-0 py-1 ${
                                points !== null && points > 0 ? 'text-green-600' : 
                                points !== null && points < 0 ? 'text-red-600' : ''
                              }`}
                            >
                              {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNinePoints || ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {fullPoints || ''}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Round Card Style Header - Matching Profile Round Cards */}
        <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: Winner with trophy and points */}
            <div className="flex-shrink-0 w-14 text-center">
              <Trophy className="h-6 w-6 mx-auto text-amber-600 mb-1" />
              <div className="text-sm font-bold text-foreground">
                {winner.points}
              </div>
              <div className="text-xs text-muted-foreground">
                points
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate text-foreground">
                {game.round_name || 'Wolf'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <span className="truncate">{game.course_name}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(game.date_played), "MMM d")}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="text-muted-foreground">Winner: </span>
                <span className="font-semibold text-amber-600">{winner.name}</span>
                <span className="text-muted-foreground"> · {winner.points} points</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard */}
        {courseHoles.length > 0 && (
          <div className="px-4 pt-4">
            <WolfScorecardView />
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
                className="flex-1"
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
