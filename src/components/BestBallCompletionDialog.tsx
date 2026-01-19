import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2 } from "lucide-react";
import { BestBallGame, BestBallHole, BestBallPlayerScore } from "@/types/bestBall";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { BestBallScorecardView } from "@/components/BestBallScorecardView";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset textarea height when share form is closed
  useEffect(() => {
    if (!showShareForm && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = '2.5rem';
      setComment("");
    }
  }, [showShareForm]);
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');
  const { strokePlayEnabled } = useStrokePlayEnabled(gameId, 'best_ball');

  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  // Determine which team the current user is on
  const getUserTeam = (): 'A' | 'B' => {
    if (!currentUserId) return 'A'; // Default to A if unknown
    
    // Check if user is on Team A
    const isOnTeamA = game.team_a_players.some(p => p.odId === currentUserId);
    if (isOnTeamA) return 'A';
    
    // Check if user is on Team B
    const isOnTeamB = game.team_b_players.some(p => p.odId === currentUserId);
    if (isOnTeamB) return 'B';
    
    // Default to game creator's team (Team A)
    return 'A';
  };

  const userTeam = getUserTeam();

  // Calculate match status from user's perspective
  // game.match_status: positive = Team A winning, negative = Team B winning
  const userMatchStatus = userTeam === 'A' ? game.match_status : -game.match_status;

  // Determine result text from user's perspective
  let matchResult: 'W' | 'L' | 'T' = 'T';
  let resultText = '';
  
  if (userMatchStatus > 0) {
    matchResult = 'W';
    resultText = `${Math.abs(userMatchStatus)} UP`;
  } else if (userMatchStatus < 0) {
    matchResult = 'L';
    resultText = `${Math.abs(userMatchStatus)} DOWN`;
  } else {
    matchResult = 'T';
    resultText = 'AS';
  }

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

  // Build scorecard data for sharing
  const buildScorecardData = () => {
    const holeScores: Record<number, {
      teamAScores: { playerId: string; playerName: string; grossScore: number }[];
      teamBScores: { playerId: string; playerName: string; grossScore: number }[];
      matchStatusAfter: number;
    }> = {};
    
    const holePars: Record<number, number> = {};
    
    courseHoles.forEach(ch => {
      holePars[ch.hole_number] = ch.par;
      const hole = holesMap.get(ch.hole_number);
      if (hole) {
        holeScores[ch.hole_number] = {
          teamAScores: (hole.team_a_scores || []).map(s => ({
            playerId: s.playerId,
            playerName: s.playerName,
            grossScore: s.grossScore
          })),
          teamBScores: (hole.team_b_scores || []).map(s => ({
            playerId: s.playerId,
            playerName: s.playerName,
            grossScore: s.grossScore
          })),
          matchStatusAfter: hole.match_status_after
        };
      }
    });
    
    return { holeScores, holePars };
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      const scorecardData = buildScorecardData();
      const teamAPlayersData = game.team_a_players.map(p => ({ id: p.odId, name: p.displayName }));
      const teamBPlayersData = game.team_b_players.map(p => ({ id: p.odId, name: p.displayName }));
      
      // Create scorecard format that includes all data needed for exact rendering
      // Format: [BEST_BALL_SCORECARD]roundName|courseName|date|teamAName|teamBName|matchStatus|userTeam|gameId|teamAPlayers|teamBPlayers|scorecardJson[/BEST_BALL_SCORECARD]
      const scorecardJson = JSON.stringify({
        holeScores: scorecardData.holeScores,
        holePars: scorecardData.holePars,
        teamAPlayers: teamAPlayersData,
        teamBPlayers: teamBPlayersData
      });
      
      const bestBallScorecard = `[BEST_BALL_SCORECARD]${game.round_name || ''}|${game.course_name}|${game.date_played}|${game.team_a_name}|${game.team_b_name}|${userMatchStatus}|${userTeam}|${gameId}|${scorecardJson}[/BEST_BALL_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${bestBallScorecard}`
        : bestBallScorecard;

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

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = frontNinePar + backNinePar;
  const playerCount = game.team_a_players.length + game.team_b_players.length;

  // Calculate player totals for front/back nine
  const getPlayerTotal = (player: { odId: string; displayName: string }, team: 'A' | 'B', holeList: CourseHole[]) => {
    return holeList.reduce((sum, h) => {
      const scores = getPlayerScoresForHole(h.hole_number, team);
      const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
      return sum + (playerScore?.grossScore || 0);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogTitle className="sr-only">Best Ball Match Play Results</DialogTitle>
        <DialogDescription className="sr-only">View your match play scorecard and results</DialogDescription>
        <BestBallScorecardView
          roundName={game.round_name || 'Best Ball Match Play'}
          courseName={game.course_name}
          datePlayed={game.date_played}
          playerCount={playerCount}
          matchResult={matchResult}
          resultText={resultText}
          teamAPlayers={game.team_a_players}
          teamBPlayers={game.team_b_players}
          holes={holes}
          courseHoles={courseHoles}
          strokePlayEnabled={strokePlayEnabled}
          onHeaderClick={undefined}
          onScorecardClick={undefined}
        />

        {/* Legacy code - kept for reference but not rendered */}
        {false && courseHoles.length > 0 && scorecardType === 'primary' && (
          <div className="px-4 pt-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Front 9 */}
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-white">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                      {!hasBackNine ? 'Tot' : ''}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Par Row */}
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNinePar}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {!hasBackNine ? totalPar : ''}
                    </TableCell>
                  </TableRow>
                  
                  {/* Team A Players */}
                  {game.team_a_players.map((player, playerIndex) => {
                    const frontTotal = getPlayerTotal(player, 'A', frontNine);
                    const fullTotal = getPlayerTotal(player, 'A', courseHoles);
                    
                    return (
                      <TableRow key={player.odId || playerIndex}>
                        <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                          {player.displayName.split(' ')[0]}
                        </TableCell>
                        {frontNine.map(hole => {
                          const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          const score = playerScore?.grossScore;
                          return (
                            <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                              {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {frontTotal || ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {!hasBackNine ? (fullTotal || '') : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {/* Match Status Row */}
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-muted/50">Score</TableCell>
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
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
                  </TableRow>
                  
                  {/* Team B Players */}
                  {game.team_b_players.map((player, playerIndex) => {
                    const frontTotal = getPlayerTotal(player, 'B', frontNine);
                    const fullTotal = getPlayerTotal(player, 'B', courseHoles);
                    
                    return (
                      <TableRow key={player.odId || playerIndex}>
                        <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                          {player.displayName.split(' ')[0]}
                        </TableCell>
                        {frontNine.map(hole => {
                          const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                          const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                          const score = playerScore?.grossScore;
                          return (
                            <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                              {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {frontTotal || ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {!hasBackNine ? (fullTotal || '') : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Back 9 */}
              {hasBackNine && (
                <div className="border-t">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-primary">
                        <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                          {backNine.map(hole => (
                            <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-white">
                              {hole.hole_number}
                            </TableHead>
                          ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Par Row */}
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNinePar}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {totalPar}
                        </TableCell>
                      </TableRow>
                      
                      {/* Team A Players */}
                      {game.team_a_players.map((player, playerIndex) => {
                        const backTotal = getPlayerTotal(player, 'A', backNine);
                        const fullTotal = getPlayerTotal(player, 'A', courseHoles);
                        
                        return (
                          <TableRow key={player.odId || playerIndex}>
                            <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                              {player.displayName.split(' ')[0]}
                            </TableCell>
                            {backNine.map(hole => {
                              const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                              const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                              const score = playerScore?.grossScore;
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                  {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {backTotal || ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {fullTotal || ''}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      
                      {/* Match Status Row */}
                      <TableRow className="bg-muted/50">
                        <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-muted/50">Score</TableCell>
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
                        const backTotal = getPlayerTotal(player, 'B', backNine);
                        const fullTotal = getPlayerTotal(player, 'B', courseHoles);
                        
                        return (
                          <TableRow key={player.odId || playerIndex}>
                            <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                              {player.displayName.split(' ')[0]}
                            </TableCell>
                            {backNine.map(hole => {
                              const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                              const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
                              const score = playerScore?.grossScore;
                              return (
                                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                                  {score ? <ScorecardScoreCell score={score} par={hole.par} /> : ''}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {backTotal || ''}
                            </TableCell>
                            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                              {fullTotal || ''}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Actions - Same as Stroke Play */}
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
