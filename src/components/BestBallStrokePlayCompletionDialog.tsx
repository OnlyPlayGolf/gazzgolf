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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
import { RoundCard, RoundCardData } from "@/components/RoundCard";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

type ScorecardTab = 'best_ball' | 'stroke_play';

interface BestBallStrokePlayCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: BestBallGame;
  holes: BestBallHole[];
  courseHoles: CourseHole[];
  gameId: string;
}

export function BestBallStrokePlayCompletionDialog({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
  gameId,
}: BestBallStrokePlayCompletionDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [scorecardTab, setScorecardTab] = useState<ScorecardTab>('best_ball');

  // Reset textarea height when share form is closed
  useEffect(() => {
    if (!showShareForm && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = '2.5rem';
      setComment("");
    }
  }, [showShareForm]);

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
    if (!currentUserId) return 'A';
    const isOnTeamA = game.team_a_players.some(p => p.odId === currentUserId);
    if (isOnTeamA) return 'A';
    const isOnTeamB = game.team_b_players.some(p => p.odId === currentUserId);
    if (isOnTeamB) return 'B';
    return 'A';
  };

  const userTeam = getUserTeam();

  // Get all players
  const allPlayers = [
    ...game.team_a_players.map(p => ({ ...p, team: 'A' as const })),
    ...game.team_b_players.map(p => ({ ...p, team: 'B' as const })),
  ];

  const getPlayerScoresForHole = (holeNumber: number, team: 'A' | 'B'): BestBallPlayerScore[] => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return [];
    return team === 'A' ? (hole.team_a_scores || []) : (hole.team_b_scores || []);
  };

  // Calculate player total score
  const getPlayerTotal = (player: { odId?: string; displayName: string }, team: 'A' | 'B', holeList: CourseHole[]) => {
    return holeList.reduce((sum, h) => {
      const scores = getPlayerScoresForHole(h.hole_number, team);
      const playerScore = scores.find(s => s.playerId === player.odId || s.playerName === player.displayName);
      return sum + (playerScore?.grossScore || 0);
    }, 0);
  };

  // Calculate team best ball total (best score per hole)
  const getTeamBestBallTotal = (team: 'A' | 'B', holeList: CourseHole[]) => {
    return holeList.reduce((sum, h) => {
      const scores = getPlayerScoresForHole(h.hole_number, team);
      if (scores.length === 0) return sum;
      const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
      if (validScores.length === 0) return sum;
      return sum + Math.min(...validScores);
    }, 0);
  };

  // Calculate score to par
  const getScoreToPar = (totalScore: number, totalPar: number) => {
    const diff = totalScore - totalPar;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = frontNinePar + backNinePar;

  // Calculate user's team total score and score to par for the RoundCard
  // Use the SAME logic as unifiedRoundsLoader.ts - use pre-calculated team_a_best_gross/team_b_best_gross
  // and only count par for holes that have valid scores
  const calculateTeamTotals = () => {
    let totalScore = 0;
    let totalPar = 0;
    
    for (const hole of holes) {
      const teamScore = userTeam === 'A' ? hole.team_a_best_gross : hole.team_b_best_gross;
      if (teamScore !== null && teamScore > 0) {
        totalScore += teamScore;
        totalPar += hole.par || 0;
      }
    }
    
    return { totalScore, totalPar };
  };
  
  const userTeamTotals = calculateTeamTotals();
  const userTeamTotalScore = userTeamTotals.totalScore;
  const userTeamScoreToPar = userTeamTotals.totalScore - userTeamTotals.totalPar;

  // Build RoundCard data
  const roundCardData: RoundCardData = {
    id: gameId,
    round_name: game.round_name || 'Best Ball',
    course_name: game.course_name,
    date: game.date_played,
    score: 0,
    playerCount: game.team_a_players.length + game.team_b_players.length,
    gameMode: 'Best Ball',
    gameType: 'best_ball',
    bestBallTotalScore: userTeamTotalScore > 0 ? userTeamTotalScore : null,
    bestBallScoreToPar: userTeamTotalScore > 0 ? userTeamScoreToPar : null,
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Build scorecard data for sharing - includes all data needed to render the full scorecard view
      const scorecardData = {
        holeScores: Object.fromEntries(
          courseHoles.map(ch => {
            const hole = holesMap.get(ch.hole_number);
            return [ch.hole_number, {
              teamAScores: (hole?.team_a_scores || []).map(s => ({
                playerId: s.playerId,
                playerName: s.playerName,
                grossScore: s.grossScore
              })),
              teamBScores: (hole?.team_b_scores || []).map(s => ({
                playerId: s.playerId,
                playerName: s.playerName,
                grossScore: s.grossScore
              })),
            }];
          })
        ),
        holePars: Object.fromEntries(courseHoles.map(ch => [ch.hole_number, ch.par])),
        courseHoles: courseHoles.map(ch => ({
          hole_number: ch.hole_number,
          par: ch.par,
          stroke_index: ch.stroke_index ?? ch.hole_number,
        })),
        teamAPlayers: game.team_a_players.map(p => ({ id: p.odId, name: p.displayName })),
        teamBPlayers: game.team_b_players.map(p => ({ id: p.odId, name: p.displayName })),
      };

      const scorecardJson = JSON.stringify(scorecardData);
      
      // Format: [BEST_BALL_STROKE_PLAY_SCORECARD]roundName|courseName|date|teamAName|teamBName|userTeam|userTeamTotalScore|userTeamScoreToPar|gameId|scorecardJson[/BEST_BALL_STROKE_PLAY_SCORECARD]
      const gameResult = `[BEST_BALL_STROKE_PLAY_SCORECARD]${game.round_name || 'Best Ball'}|${game.course_name}|${game.date_played}|${game.team_a_name}|${game.team_b_name}|${userTeam}|${userTeamTotalScore}|${userTeamScoreToPar}|${gameId}|${scorecardJson}[/BEST_BALL_STROKE_PLAY_SCORECARD]`;
      
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

  // Render Best Ball scorecard (team best scores per hole)
  const renderBestBallScorecard = () => (
    <div className="border rounded-lg overflow-hidden">
      {/* Front 9 */}
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
            {frontNine.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
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
          
          {/* Team A Best Ball Row */}
          <TableRow>
            <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
              {game.team_a_name}
            </TableCell>
            {frontNine.map(hole => {
              const scores = getPlayerScoresForHole(hole.hole_number, 'A');
              const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
              const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
              return (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getTeamBestBallTotal('A', frontNine) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {!hasBackNine ? (getTeamBestBallTotal('A', courseHoles) || '') : ''}
            </TableCell>
          </TableRow>
          
          {/* Team B Best Ball Row */}
          <TableRow>
            <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
              {game.team_b_name}
            </TableCell>
            {frontNine.map(hole => {
              const scores = getPlayerScoresForHole(hole.hole_number, 'B');
              const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
              const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
              return (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getTeamBestBallTotal('B', frontNine) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {!hasBackNine ? (getTeamBestBallTotal('B', courseHoles) || '') : ''}
            </TableCell>
          </TableRow>
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
                  <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
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
              
              {/* Team A Best Ball Row */}
              <TableRow>
                <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {game.team_a_name}
                </TableCell>
                {backNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, 'A');
                  const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
                  const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('A', backNine) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('A', courseHoles) || ''}
                </TableCell>
              </TableRow>
              
              {/* Team B Best Ball Row */}
              <TableRow>
                <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {game.team_b_name}
                </TableCell>
                {backNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, 'B');
                  const validScores = scores.filter(s => s.grossScore > 0).map(s => s.grossScore);
                  const bestScore = validScores.length > 0 ? Math.min(...validScores) : null;
                  return (
                    <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                      {bestScore ? <ScorecardScoreCell score={bestScore} par={hole.par} /> : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('B', backNine) || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getTeamBestBallTotal('B', courseHoles) || ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // Render Stroke Play scorecard (individual player scores)
  const renderStrokePlayScorecard = () => (
    <div className="border rounded-lg overflow-hidden">
      {/* Front 9 */}
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
            {frontNine.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
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
          {/* HCP Row */}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
            {frontNine.map(hole => (
              <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                {hole.stroke_index}
              </TableCell>
            ))}
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
          </TableRow>
          
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
          
          {/* All Players */}
          {allPlayers.map((player, playerIndex) => {
            const frontTotal = getPlayerTotal(player, player.team, frontNine);
            const fullTotal = getPlayerTotal(player, player.team, courseHoles);
            const teamColor = player.team === 'A' ? 'text-blue-600' : 'text-red-600';
            
            return (
              <TableRow key={player.odId || playerIndex}>
                <TableCell className={`font-medium ${teamColor} text-[10px] px-0.5 py-1 bg-background truncate`}>
                  {player.displayName.split(' ')[0]}
                </TableCell>
                {frontNine.map(hole => {
                  const scores = getPlayerScoresForHole(hole.hole_number, player.team);
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
                  <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                    {hole.hole_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* HCP Row */}
              <TableRow>
                <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                {backNine.map(hole => (
                  <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                    {hole.stroke_index}
                  </TableCell>
                ))}
                <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
              </TableRow>
              
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
              
              {/* All Players */}
              {allPlayers.map((player, playerIndex) => {
                const backTotal = getPlayerTotal(player, player.team, backNine);
                const fullTotal = getPlayerTotal(player, player.team, courseHoles);
                const teamColor = player.team === 'A' ? 'text-blue-600' : 'text-red-600';
                
                return (
                  <TableRow key={player.odId || playerIndex}>
                    <TableCell className={`font-medium ${teamColor} text-[10px] px-0.5 py-1 bg-background truncate`}>
                      {player.displayName.split(' ')[0]}
                    </TableCell>
                    {backNine.map(hole => {
                      const scores = getPlayerScoresForHole(hole.hole_number, player.team);
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
  );

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogTitle className="sr-only">Best Ball Stroke Play Results</DialogTitle>
        <DialogDescription className="sr-only">View your best ball stroke play scorecard and results</DialogDescription>
        
        {/* RoundCard at the top - non-clickable, no chevron */}
        <div className="p-4 pb-0">
          <RoundCard round={roundCardData} disabled />
        </div>

        {/* Format Switcher Tabs */}
        <div className="px-4 pt-3">
          <Tabs value={scorecardTab} onValueChange={(v) => setScorecardTab(v as ScorecardTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="best_ball" className="text-xs">
                Best Ball
              </TabsTrigger>
              <TabsTrigger value="stroke_play" className="text-xs">
                Stroke Play
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Scorecard Content */}
        {courseHoles.length > 0 && (
          <div className="px-4 pt-4">
            {scorecardTab === 'best_ball' ? renderBestBallScorecard() : renderStrokePlayScorecard()}
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
