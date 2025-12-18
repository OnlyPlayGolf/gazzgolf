import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore } from "@/types/bestBall";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import {
  calculateBestBall,
  calculateHoleResult,
  calculateHandicapStrokes,
  formatMatchStatus,
  isMatchFinished,
  getScoreColorClass,
} from "@/utils/bestBallScoring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export default function BestBallPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [holes, setHoles] = useState<BestBallHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // Current hole state
  const [par, setPar] = useState(4);
  const [strokeIndex, setStrokeIndex] = useState<number | null>(null);
  const [teamAScores, setTeamAScores] = useState<Record<string, number>>({});
  const [teamBScores, setTeamBScores] = useState<Record<string, number>>({});
  const [activePlayerSheet, setActivePlayerSheet] = useState<{ team: 'A' | 'B', playerId: string } | null>(null);
  
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (courseHoles.length > 0 && game) {
      const holeData = courseHoles.find(h => h.hole_number === currentHole);
      if (holeData) {
        setPar(holeData.par);
        setStrokeIndex(holeData.stroke_index);
        
        // Initialize scores if empty
        if (Object.keys(teamAScores).length === 0) {
          const aScores: Record<string, number> = {};
          game.team_a_players.forEach(p => { aScores[p.odId] = holeData.par; });
          setTeamAScores(aScores);
        }
        if (Object.keys(teamBScores).length === 0) {
          const bScores: Record<string, number> = {};
          game.team_b_players.forEach(p => { bScores[p.odId] = holeData.par; });
          setTeamBScores(bScores);
        }
      }
    }
  }, [currentHoleIndex, courseHoles, game]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: BestBallGame = {
        ...gameData,
        game_type: gameData.game_type as 'stroke' | 'match',
        team_a_players: gameData.team_a_players as unknown as BestBallPlayer[],
        team_b_players: gameData.team_b_players as unknown as BestBallPlayer[],
        winner_team: gameData.winner_team as 'A' | 'B' | 'TIE' | null,
      };
      
      setGame(typedGame);

      // Fetch course holes
      if (gameData.course_id) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");

        if (courseHolesData) {
          setCourseHoles(courseHolesData);
          const hole1 = courseHolesData.find(h => h.hole_number === 1);
          if (hole1) {
            setPar(hole1.par);
            setStrokeIndex(hole1.stroke_index);
            
            // Initialize scores
            const aScores: Record<string, number> = {};
            typedGame.team_a_players.forEach(p => { aScores[p.odId] = hole1.par; });
            setTeamAScores(aScores);
            
            const bScores: Record<string, number> = {};
            typedGame.team_b_players.forEach(p => { bScores[p.odId] = hole1.par; });
            setTeamBScores(bScores);
          }
        }
      }

      // Fetch existing holes
      const { data: holesData } = await supabase
        .from("best_ball_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: BestBallHole[] = holesData.map(h => ({
          ...h,
          team_a_scores: h.team_a_scores as unknown as BestBallPlayerScore[],
          team_b_scores: h.team_b_scores as unknown as BestBallPlayerScore[],
        }));
        setHoles(typedHoles);
        
        if (typedHoles.length > 0) {
          setCurrentHoleIndex(typedHoles.length);
        }
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buildPlayerScores = (
    players: BestBallPlayer[],
    scores: Record<string, number>,
    useHandicaps: boolean
  ): BestBallPlayerScore[] => {
    return players.map(player => {
      const grossScore = scores[player.odId] ?? par;
      const handicapStrokes = useHandicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
      const netScore = grossScore - handicapStrokes;
      
      return {
        playerId: player.odId,
        playerName: player.displayName,
        grossScore,
        netScore,
        handicapStrokes,
      };
    });
  };

  const saveHole = async () => {
    if (!game) return;
    
    const teamAPlayerScores = buildPlayerScores(game.team_a_players, teamAScores, game.use_handicaps);
    const teamBPlayerScores = buildPlayerScores(game.team_b_players, teamBScores, game.use_handicaps);
    
    const teamAResult = calculateBestBall(teamAPlayerScores, game.use_handicaps);
    const teamBResult = calculateBestBall(teamBPlayerScores, game.use_handicaps);
    
    // Calculate hole result for match play
    const holeResult = calculateHoleResult(teamAResult.bestScore, teamBResult.bestScore);
    
    // Get previous match status
    const prevHole = holes.find(h => h.hole_number === currentHole - 1);
    const prevMatchStatus = prevHole?.match_status_after ?? 0;
    const newMatchStatus = prevMatchStatus + holeResult;
    const holesRemaining = totalHoles - currentHole;
    
    // Calculate running totals for stroke play
    const prevTeamATotal = holes
      .filter(h => h.hole_number < currentHole)
      .reduce((sum, h) => sum + (h.team_a_best_gross || 0), 0);
    const prevTeamBTotal = holes
      .filter(h => h.hole_number < currentHole)
      .reduce((sum, h) => sum + (h.team_b_best_gross || 0), 0);
    
    const teamARunning = prevTeamATotal + (teamAResult.bestScore || 0);
    const teamBRunning = prevTeamBTotal + (teamBResult.bestScore || 0);
    
    const existingHole = holes.find(h => h.hole_number === currentHole);

    setSaving(true);
    try {
      const holeData = {
        game_id: game.id,
        hole_number: currentHole,
        par,
        stroke_index: strokeIndex,
        team_a_scores: teamAPlayerScores as unknown as any,
        team_b_scores: teamBPlayerScores as unknown as any,
        team_a_best_gross: game.use_handicaps 
          ? teamAPlayerScores.reduce((min, s) => Math.min(min, s.grossScore || Infinity), Infinity)
          : teamAResult.bestScore,
        team_a_best_net: game.use_handicaps ? teamAResult.bestScore : null,
        team_a_counting_player: teamAResult.countingPlayer,
        team_b_best_gross: game.use_handicaps
          ? teamBPlayerScores.reduce((min, s) => Math.min(min, s.grossScore || Infinity), Infinity)
          : teamBResult.bestScore,
        team_b_best_net: game.use_handicaps ? teamBResult.bestScore : null,
        team_b_counting_player: teamBResult.countingPlayer,
        team_a_running_total: teamARunning,
        team_b_running_total: teamBRunning,
        hole_result: holeResult,
        match_status_after: newMatchStatus,
        holes_remaining_after: holesRemaining,
      };

      if (existingHole) {
        await supabase
          .from("best_ball_holes")
          .update(holeData)
          .eq("id", existingHole.id);
      } else {
        await supabase
          .from("best_ball_holes")
          .insert(holeData);
      }

      // Update game totals
      const allHolesTeamA = holes
        .filter(h => h.hole_number !== currentHole)
        .reduce((sum, h) => sum + (game.use_handicaps ? (h.team_a_best_net || 0) : (h.team_a_best_gross || 0)), 0)
        + (teamAResult.bestScore || 0);
      
      const allHolesTeamB = holes
        .filter(h => h.hole_number !== currentHole)
        .reduce((sum, h) => sum + (game.use_handicaps ? (h.team_b_best_net || 0) : (h.team_b_best_gross || 0)), 0)
        + (teamBResult.bestScore || 0);

      await supabase
        .from("best_ball_games")
        .update({
          team_a_total: allHolesTeamA,
          team_b_total: allHolesTeamB,
          match_status: newMatchStatus,
          holes_remaining: holesRemaining,
        })
        .eq("id", game.id);

      setGame({
        ...game,
        team_a_total: allHolesTeamA,
        team_b_total: allHolesTeamB,
        match_status: newMatchStatus,
        holes_remaining: holesRemaining,
      });

      // Navigate
      if (currentHole >= totalHoles || (game.game_type === 'match' && isMatchFinished(newMatchStatus, holesRemaining))) {
        navigate(`/best-ball/${game.id}/summary`);
      } else {
        setCurrentHoleIndex(currentHoleIndex + 1);
        resetHoleState();
        await fetchGame();
      }
    } catch (error: any) {
      toast({ title: "Error saving hole", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const resetHoleState = () => {
    const nextHoleNumber = currentHoleIndex + 2;
    const nextHoleData = courseHoles.find(h => h.hole_number === nextHoleNumber);
    const nextPar = nextHoleData?.par || 4;
    setPar(nextPar);
    setStrokeIndex(nextHoleData?.stroke_index || null);
    
    if (game) {
      const aScores: Record<string, number> = {};
      game.team_a_players.forEach(p => { aScores[p.odId] = nextPar; });
      setTeamAScores(aScores);
      
      const bScores: Record<string, number> = {};
      game.team_b_players.forEach(p => { bScores[p.odId] = nextPar; });
      setTeamBScores(bScores);
    }
  };

  const advanceToNextPlayerSheet = (team: 'A' | 'B', playerId: string) => {
    if (!game) return;

    const allPlayers = [
      ...game.team_a_players.map(p => ({ ...p, team: 'A' as const })),
      ...game.team_b_players.map(p => ({ ...p, team: 'B' as const })),
    ];

    const currentIndex = allPlayers.findIndex(p => p.team === team && p.odId === playerId);
    if (currentIndex < 0) {
      setActivePlayerSheet(null);
      return;
    }

    if (currentIndex < allPlayers.length - 1) {
      const nextPlayer = allPlayers[currentIndex + 1];
      setActivePlayerSheet({ team: nextPlayer.team, playerId: nextPlayer.odId });
    } else {
      setActivePlayerSheet(null);
    }
  };

  const handleScoreSelect = (team: 'A' | 'B', playerId: string, score: number | null) => {
    if (score === null) return;

    if (team === 'A') {
      setTeamAScores(prev => ({ ...prev, [playerId]: score }));
    } else {
      setTeamBScores(prev => ({ ...prev, [playerId]: score }));
    }
  };

  const navigateHole = async (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      const prevHole = holes[currentHoleIndex - 1];
      if (prevHole && game) {
        setPar(prevHole.par);
        setStrokeIndex(prevHole.stroke_index);
        
        const aScores: Record<string, number> = {};
        prevHole.team_a_scores.forEach(s => { aScores[s.playerId] = s.grossScore || prevHole.par; });
        setTeamAScores(aScores);
        
        const bScores: Record<string, number> = {};
        prevHole.team_b_scores.forEach(s => { bScores[s.playerId] = s.grossScore || prevHole.par; });
        setTeamBScores(bScores);
      }
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next") {
      await saveHole();
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("best_ball_holes").delete().eq("game_id", gameId);
      await supabase.from("best_ball_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  // Calculate current best balls for display
  const getCurrentBestBalls = () => {
    if (!game) return { teamA: null, teamB: null };
    
    const teamAPlayerScores = buildPlayerScores(game.team_a_players, teamAScores, game.use_handicaps);
    const teamBPlayerScores = buildPlayerScores(game.team_b_players, teamBScores, game.use_handicaps);
    
    return {
      teamA: calculateBestBall(teamAPlayerScores, game.use_handicaps),
      teamB: calculateBestBall(teamBPlayerScores, game.use_handicaps),
    };
  };

  const bestBalls = getCurrentBestBalls();

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading game...</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const renderPlayerScoreRow = (
    player: BestBallPlayer,
    team: 'A' | 'B',
    scores: Record<string, number>,
    countingPlayer: string | null
  ) => {
    const score = scores[player.odId] || par;
    const isCounting = countingPlayer === player.displayName;
    const handicapStrokes = game.use_handicaps ? calculateHandicapStrokes(player.handicap, strokeIndex) : 0;
    
    return (
      <div
        key={player.odId}
        className={`flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer hover:bg-muted/70 ${
          isCounting ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/50'
        }`}
        onClick={() => setActivePlayerSheet({ team, playerId: player.odId })}
      >
        <div className="flex items-center gap-2">
          {isCounting && <Star size={14} className="text-primary fill-primary" />}
          <div>
            <div className="font-medium text-sm">{player.displayName}</div>
            {game.use_handicaps && handicapStrokes > 0 && (
              <div className="text-xs text-muted-foreground">+{handicapStrokes} stroke{handicapStrokes > 1 ? 's' : ''}</div>
            )}
          </div>
        </div>
        
        <div className={`text-2xl font-bold ${getScoreColorClass(score, par)}`}>
          {score}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-44 bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm opacity-80">
              {game.game_type === 'stroke' ? 'Best Ball Stroke Play' : 'Best Ball Match Play'}
            </div>
            {game.game_type === 'match' && (
              <div className="text-sm font-semibold">
                {formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name)}
              </div>
            )}
          </div>
          
          {/* Hole Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ChevronLeft size={24} />
            </Button>
            
            <div className="text-center">
              <div className="text-3xl font-bold">Hole {currentHole}</div>
              <div className="text-sm opacity-80">Par {par}</div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={saving}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
          
          {/* Score Summary */}
          {game.game_type === 'stroke' && (
            <div className="flex items-center justify-center gap-6 mt-2 text-sm">
              <div>{game.team_a_name}: {game.team_a_total}</div>
              <div>{game.team_b_name}: {game.team_b_total}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Team A */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-bold">{game.team_a_name}</h3>
            </div>
            {bestBalls.teamA.bestScore !== null && (
              <div className={`text-lg font-bold ${getScoreColorClass(bestBalls.teamA.bestScore, par)}`}>
                Best: {bestBalls.teamA.bestScore}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {game.team_a_players.map(player =>
              renderPlayerScoreRow(player, 'A', teamAScores, bestBalls.teamA.countingPlayer)
            )}
          </div>
        </Card>

        {/* Team B */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="font-bold">{game.team_b_name}</h3>
            </div>
            {bestBalls.teamB.bestScore !== null && (
              <div className={`text-lg font-bold ${getScoreColorClass(bestBalls.teamB.bestScore, par)}`}>
                Best: {bestBalls.teamB.bestScore}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {game.team_b_players.map(player =>
              renderPlayerScoreRow(player, 'B', teamBScores, bestBalls.teamB.countingPlayer)
            )}
          </div>
        </Card>

        {/* Hole Result Preview */}
        {bestBalls.teamA.bestScore !== null && bestBalls.teamB.bestScore !== null && (
          <Card className="p-4 bg-muted/50">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Hole Result</div>
              <div className="text-lg font-bold">
                {bestBalls.teamA.bestScore < bestBalls.teamB.bestScore && (
                  <span className="text-blue-500">{game.team_a_name} wins</span>
                )}
                {bestBalls.teamB.bestScore < bestBalls.teamA.bestScore && (
                  <span className="text-red-500">{game.team_b_name} wins</span>
                )}
                {bestBalls.teamA.bestScore === bestBalls.teamB.bestScore && (
                  <span className="text-muted-foreground">Halved</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Save Button */}
        <Button
          className="w-full h-12 text-lg font-bold"
          onClick={saveHole}
          disabled={saving}
        >
          {saving ? "Saving..." : currentHole >= totalHoles ? "Finish Game" : "Next Hole"}
        </Button>
      </div>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>What would you like to do with this game?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={() => navigate(`/best-ball/${gameId}/summary`)}>
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDeleteGame} className="bg-destructive hover:bg-destructive/90">
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}

      {/* Score Entry Sheets */}
      {game.team_a_players.map(player => (
        <PlayerScoreSheet
          key={`A-${player.odId}`}
          open={activePlayerSheet?.team === 'A' && activePlayerSheet?.playerId === player.odId}
          onOpenChange={(open) => {
            if (!open) {
              setActivePlayerSheet((prev) =>
                prev?.team === 'A' && prev?.playerId === player.odId ? null : prev
              );
            }
          }}
          playerName={player.displayName}
          handicap={player.handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={teamAScores[player.odId] || par}
          onScoreSelect={(score) => handleScoreSelect('A', player.odId, score)}
          onEnterAndNext={() => advanceToNextPlayerSheet('A', player.odId)}
        />
      ))}
      {game.team_b_players.map(player => (
        <PlayerScoreSheet
          key={`B-${player.odId}`}
          open={activePlayerSheet?.team === 'B' && activePlayerSheet?.playerId === player.odId}
          onOpenChange={(open) => {
            if (!open) {
              setActivePlayerSheet((prev) =>
                prev?.team === 'B' && prev?.playerId === player.odId ? null : prev
              );
            }
          }}
          playerName={player.displayName}
          handicap={player.handicap}
          par={par}
          holeNumber={currentHole}
          currentScore={teamBScores[player.odId] || par}
          onScoreSelect={(score) => handleScoreSelect('B', player.odId, score)}
          onEnterAndNext={() => advanceToNextPlayerSheet('B', player.odId)}
        />
      ))}
    </div>
  );
}
