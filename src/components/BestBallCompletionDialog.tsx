import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2, Users, ChevronRight } from "lucide-react";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface BestBallCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: BestBallGame;
  holes: BestBallHole[];
  courseHoles: CourseHole[];
  gameId: string;
}

export function BestBallCompletionDialog({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
  gameId,
}: BestBallCompletionDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

  const isMatchPlay = game.game_type === 'match';
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  // Determine winner and result text
  let winner: 'A' | 'B' | 'TIE' | null = null;
  let resultText = '';
  let matchResult: 'W' | 'L' | 'T' = 'T';
  
  if (isMatchPlay) {
    if (game.match_status > 0) {
      winner = 'A';
      matchResult = 'W';
      resultText = `${Math.abs(game.match_status)} UP`;
    } else if (game.match_status < 0) {
      winner = 'B';
      matchResult = 'L';
      resultText = `${Math.abs(game.match_status)} UP`;
    } else {
      winner = 'TIE';
      matchResult = 'T';
      resultText = 'ALL SQUARE';
    }
  }

  const winnerName = winner === 'A' ? game.team_a_name : winner === 'B' ? game.team_b_name : null;

  const getMatchResultColor = (result: 'W' | 'L' | 'T') => {
    if (result === 'W') return 'text-emerald-600';
    if (result === 'L') return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Helper functions for scorecard
  const getTeamBestScore = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return team === 'A' ? hole.team_a_best_gross : hole.team_b_best_gross;
  };

  const getPlayerScoresForHole = (holeNumber: number, team: 'A' | 'B'): BestBallPlayerScore[] => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return [];
    return team === 'A' ? (hole.team_a_scores || []) : (hole.team_b_scores || []);
  };

  const getMatchStatusAfterHole = (holeNumber: number): { text: string; leadingTeam: 'A' | 'B' | null } => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return { text: '', leadingTeam: null };
    const status = hole.match_status_after;
    if (status === 0) return { text: 'AS', leadingTeam: null };
    const upBy = Math.abs(status);
    const leadingTeam = status > 0 ? 'A' : 'B';
    return { text: `${upBy}UP`, leadingTeam };
  };

  const getScoreColor = (score: number | null, par: number) => {
    if (score === null) return '';
    if (score < par) return 'text-red-600 font-bold';
    return 'text-foreground';
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      const gameResult = `[GAME_RESULT]Best Ball|${game.course_name}|${game.round_name || ''}|${winnerName || ''}|${resultText}|${game.team_a_name} vs ${game.team_b_name}|${gameId}[/GAME_RESULT]`;
      const postContent = comment.trim()
        ? `${comment}\n\n${gameResult}`
        : gameResult;

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

  const handleDone = () => {
    onOpenChange(false);
    navigate("/");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-4 space-y-4">
            {/* Round Card Summary */}
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Left: Match Result */}
                  <div className="flex-shrink-0 w-14 text-center">
                    <div className="flex flex-col items-center">
                      <div className={`text-2xl font-bold ${getMatchResultColor(matchResult)}`}>
                        {matchResult}
                      </div>
                      {resultText && matchResult !== 'T' && (
                        <div className="text-xs text-muted-foreground">
                          {resultText}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Middle: Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {game.round_name || 'Best Ball Match Play'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <span className="truncate">{game.course_name}</span>
                      <span>·</span>
                      <span className="flex-shrink-0">{formatDate(game.date_played)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <span>Best Ball Match Play</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {game.team_a_players.length + game.team_b_players.length}
                      </span>
                    </div>
                  </div>
                  
                  {/* Right: Chevron */}
                  <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* Match Play Scorecard - Same as Leaderboard */}
            {isMatchPlay && courseHoles.length > 0 && (
              <Card className="overflow-hidden">
                {/* Scorecard Header */}
                <div className="flex items-center p-3 border-b">
                  {/* Team A Name and Players */}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 truncate">
                      {game.team_a_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {game.team_a_players.map(p => p.displayName.split(' ')[0]).join(' & ')}
                    </div>
                  </div>
                  
                  {/* Score Display in Middle */}
                  <div className="flex items-center justify-center mx-4">
                    {game.match_status === 0 ? (
                      <div className="px-6 py-2 bg-muted rounded-md">
                        <span className="text-sm font-bold text-muted-foreground">AS</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        {game.match_status > 0 && (
                          <>
                            <div className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[10px] border-r-blue-600" />
                            <div className="px-5 py-2 bg-blue-600 text-white flex items-center justify-center">
                              <span className="text-sm font-bold">{Math.abs(game.match_status)} UP</span>
                            </div>
                          </>
                        )}
                        {game.match_status < 0 && (
                          <>
                            <div className="px-5 py-2 bg-red-600 text-white flex items-center justify-center">
                              <span className="text-sm font-bold">{Math.abs(game.match_status)} UP</span>
                            </div>
                            <div className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-l-[10px] border-l-red-600" />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Team B Name and Players */}
                  <div className="flex-1 text-right">
                    <div className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">
                      {game.team_b_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {game.team_b_players.map(p => p.displayName.split(' ')[0]).join(' & ')}
                    </div>
                  </div>
                </div>

                {/* Front 9 */}
                <div className="border rounded-lg overflow-hidden mx-2 my-2">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                        {frontNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Out</TableHead>
                        {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Par Row */}
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                        {frontNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{frontNinePar}</TableCell>
                        {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                      </TableRow>
                      
                      {/* Team A Players */}
                      {game.team_a_players.map((player, playerIndex) => {
                        const playerFrontTotal = frontNine.reduce((sum, h) => {
                          const scores = getPlayerScoresForHole(h.hole_number, 'A');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          return sum + (playerScore?.grossScore || 0);
                        }, 0);
                        
                        return (
                          <TableRow key={player.odId || playerIndex}>
                            <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                              {player.displayName.split(' ')[0]}
                            </TableCell>
                            {frontNine.map(hole => {
                              const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                              const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                              const score = playerScore?.grossScore;
                              return (
                                <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}>
                                  {score || ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{playerFrontTotal || ''}</TableCell>
                            {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                          </TableRow>
                        );
                      })}
                      
                      {/* Match Status Row */}
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                        {frontNine.map(hole => {
                          const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className={`text-center font-bold text-[10px] px-0 py-1 ${
                                leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                                leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                              }`}
                            >
                              {text}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                        {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                      </TableRow>
                      
                      {/* Team B Players */}
                      {game.team_b_players.map((player, playerIndex) => {
                        const playerFrontTotal = frontNine.reduce((sum, h) => {
                          const scores = getPlayerScoresForHole(h.hole_number, 'B');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          return sum + (playerScore?.grossScore || 0);
                        }, 0);
                        
                        return (
                          <TableRow key={player.odId || playerIndex}>
                            <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                              {player.displayName.split(' ')[0]}
                            </TableCell>
                            {frontNine.map(hole => {
                              const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                              const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                              const score = playerScore?.grossScore;
                              return (
                                <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}>
                                  {score || ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{playerFrontTotal || ''}</TableCell>
                            {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Back 9 */}
                {backNine.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mx-2 mb-2">
                    <Table className="table-fixed w-full">
                      <TableHeader>
                        <TableRow className="bg-primary/5">
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                          {backNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                              {hole.hole_number}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">In</TableHead>
                          <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Tot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Par Row */}
                        <TableRow>
                          <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                          {backNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                              {hole.par}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{backNinePar}</TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{frontNinePar + backNinePar}</TableCell>
                        </TableRow>
                        
                        {/* Team A Players */}
                        {game.team_a_players.map((player, playerIndex) => {
                          const playerFrontTotal = frontNine.reduce((sum, h) => {
                            const scores = getPlayerScoresForHole(h.hole_number, 'A');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            return sum + (playerScore?.grossScore || 0);
                          }, 0);
                          const playerBackTotal = backNine.reduce((sum, h) => {
                            const scores = getPlayerScoresForHole(h.hole_number, 'A');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            return sum + (playerScore?.grossScore || 0);
                          }, 0);
                          
                          return (
                            <TableRow key={player.odId || playerIndex}>
                              <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                                {player.displayName.split(' ')[0]}
                              </TableCell>
                              {backNine.map(hole => {
                                const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                                const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                                const score = playerScore?.grossScore;
                                return (
                                  <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}>
                                    {score || ''}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{playerBackTotal || ''}</TableCell>
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{(playerFrontTotal + playerBackTotal) || ''}</TableCell>
                            </TableRow>
                          );
                        })}
                        
                        {/* Match Status Row */}
                        <TableRow className="bg-muted/30">
                          <TableCell className="font-bold text-[10px] px-0 py-1 w-[44px]">Score</TableCell>
                          {backNine.map(hole => {
                            const { text, leadingTeam } = getMatchStatusAfterHole(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className={`text-center font-bold text-[10px] px-0 py-1 ${
                                  leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                                  leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                                }`}
                              >
                                {text}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                        </TableRow>
                        
                        {/* Team B Players */}
                        {game.team_b_players.map((player, playerIndex) => {
                          const playerFrontTotal = frontNine.reduce((sum, h) => {
                            const scores = getPlayerScoresForHole(h.hole_number, 'B');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            return sum + (playerScore?.grossScore || 0);
                          }, 0);
                          const playerBackTotal = backNine.reduce((sum, h) => {
                            const scores = getPlayerScoresForHole(h.hole_number, 'B');
                            const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                            return sum + (playerScore?.grossScore || 0);
                          }, 0);
                          
                          return (
                            <TableRow key={player.odId || playerIndex}>
                              <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">
                                {player.displayName.split(' ')[0]}
                              </TableCell>
                              {backNine.map(hole => {
                                const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                                const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                                const score = playerScore?.grossScore;
                                return (
                                  <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${getScoreColor(score || null, hole.par)}`}>
                                    {score || ''}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{playerBackTotal || ''}</TableCell>
                              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">{(playerFrontTotal + playerBackTotal) || ''}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            )}

            {/* Action Buttons */}
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
                <Button className="flex-1" onClick={handleDone}>
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
