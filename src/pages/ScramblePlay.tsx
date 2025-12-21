import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
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

export default function ScramblePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  const [holes, setHoles] = useState<ScrambleHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [teamScores, setTeamScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [activeTeamSheet, setActiveTeamSheet] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  useEffect(() => {
    // Load scores for current hole
    const holeData = holes.find(h => h.hole_number === currentHole);
    if (holeData) {
      setTeamScores(holeData.team_scores || {});
    } else {
      // Reset to empty scores for new hole
      const emptyScores: Record<string, number | null> = {};
      teams.forEach(t => { emptyScores[t.id] = null; });
      setTeamScores(emptyScores);
    }
  }, [currentHole, holes, teams]);

  const fetchGame = async () => {
    if (!gameId) return;
    
    const { data: gameData, error: gameError } = await supabase
      .from('scramble_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !gameData) {
      toast.error("Failed to load game");
      navigate('/rounds');
      return;
    }

    const parsedTeams = (gameData.teams as unknown as ScrambleTeam[]) || [];
    setGame(gameData as unknown as ScrambleGame);
    setTeams(parsedTeams);

    // Fetch course holes if course_id exists
    if (gameData.course_id) {
      const { data: holesData } = await supabase
        .from('course_holes')
        .select('hole_number, par, stroke_index')
        .eq('course_id', gameData.course_id)
        .order('hole_number');

      if (holesData) {
        setCourseHoles(holesData);
      }
    }

    // Fetch existing hole scores
    const { data: scrambleHoles } = await supabase
      .from('scramble_holes')
      .select('*')
      .eq('game_id', gameId)
      .order('hole_number');

    if (scrambleHoles) {
      setHoles(scrambleHoles.map(h => ({
        ...h,
        team_scores: (h.team_scores as Record<string, number | null>) || {}
      })));
      
      // Find first hole without all scores entered
      const incompleteHole = scrambleHoles.find(h => {
        const scores = h.team_scores as Record<string, number | null>;
        return parsedTeams.some(t => scores[t.id] === undefined || scores[t.id] === null);
      });
      if (incompleteHole) {
        setCurrentHole(incompleteHole.hole_number);
      } else if (scrambleHoles.length < gameData.holes_played) {
        setCurrentHole(scrambleHoles.length + 1);
      }
    }

    setLoading(false);
  };

  const getCurrentHolePar = () => {
    const hole = courseHoles.find(h => h.hole_number === currentHole);
    return hole?.par || 4;
  };

  const getCurrentHoleStrokeIndex = () => {
    const hole = courseHoles.find(h => h.hole_number === currentHole);
    return hole?.stroke_index || currentHole;
  };

  const handleScoreSelect = async (teamId: string, score: number | null) => {
    const newScores = { ...teamScores, [teamId]: score };
    setTeamScores(newScores);

    // Save to database
    const par = getCurrentHolePar();
    const strokeIndex = getCurrentHoleStrokeIndex();

    const { error } = await supabase
      .from('scramble_holes')
      .upsert({
        game_id: gameId,
        hole_number: currentHole,
        par,
        stroke_index: strokeIndex,
        team_scores: newScores
      }, {
        onConflict: 'game_id,hole_number'
      });

    if (error) {
      console.error('Error saving score:', error);
      toast.error("Failed to save score");
      return;
    }

    // Update local holes state
    setHoles(prev => {
      const existing = prev.find(h => h.hole_number === currentHole);
      if (existing) {
        return prev.map(h => h.hole_number === currentHole ? { ...h, team_scores: newScores } : h);
      } else {
        return [...prev, {
          id: `temp-${currentHole}`,
          game_id: gameId!,
          hole_number: currentHole,
          par,
          stroke_index: strokeIndex,
          created_at: new Date().toISOString(),
          team_scores: newScores
        }];
      }
    });
  };

  const advanceToNextTeamSheet = () => {
    if (!activeTeamSheet) return;
    
    const currentIndex = teams.findIndex(t => t.id === activeTeamSheet);
    if (currentIndex < teams.length - 1) {
      // Move to next team
      setActiveTeamSheet(teams[currentIndex + 1].id);
    } else {
      // All teams done - close sheet and auto-advance to next hole
      setActiveTeamSheet(null);
      if (game && currentHole < game.holes_played) {
        setCurrentHole(currentHole + 1);
      }
    }
  };

  const navigateHole = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentHole > 1) {
      setCurrentHole(currentHole - 1);
    } else if (direction === 'next' && game && currentHole < game.holes_played) {
      setCurrentHole(currentHole + 1);
    }
  };

  const calculateTeamTotal = (teamId: string): number => {
    return holes.reduce((total, hole) => {
      const score = hole.team_scores[teamId];
      return total + (score || 0);
    }, 0);
  };

  const calculateTotalPar = (): number => {
    return holes.reduce((total, hole) => total + hole.par, 0);
  };

  const finishGame = async () => {
    if (!game) return;

    // Calculate winner
    let winningTeam: string | null = null;
    let lowestScore = Infinity;
    
    teams.forEach(team => {
      const total = calculateTeamTotal(team.id);
      if (total > 0 && total < lowestScore) {
        lowestScore = total;
        winningTeam = team.name;
      }
    });

    const { error } = await supabase
      .from('scramble_games')
      .update({
        is_finished: true,
        winning_team: winningTeam
      })
      .eq('id', gameId);

    if (error) {
      toast.error("Failed to finish game");
      return;
    }

    toast.success("Game finished!");
    navigate(`/scramble/${gameId}/summary`);
  };

  const handleSaveAndExit = async () => {
    setExitDialogOpen(false);
    toast.success("Game saved");
    navigate('/rounds');
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    
    const { error } = await supabase
      .from('scramble_games')
      .delete()
      .eq('id', gameId);

    if (error) {
      toast.error("Failed to delete game");
      return;
    }

    setExitDialogOpen(false);
    toast.success("Game deleted");
    navigate('/rounds');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading game...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Game not found</p>
      </div>
    );
  }

  const par = getCurrentHolePar();
  const allScoresEntered = teams.every(t => teamScores[t.id] !== null && teamScores[t.id] !== undefined);
  const isLastHole = currentHole === game.holes_played;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setExitDialogOpen(true)} className="text-primary-foreground">
            <LogOut size={20} />
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Scramble</h1>
            <p className="text-sm opacity-80">{game.course_name}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Hole Navigation */}
      <div className="bg-primary/10 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateHole('prev')}
            disabled={currentHole === 1}
          >
            <ChevronLeft size={24} />
          </Button>
          <div className="text-center">
            <p className="text-2xl font-bold">Hole {currentHole}</p>
            <p className="text-sm text-muted-foreground">Par {par}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateHole('next')}
            disabled={currentHole === game.holes_played}
          >
            <ChevronRight size={24} />
          </Button>
        </div>
      </div>

      {/* Team Scores */}
      <div className="p-4 space-y-4">
        {teams.map((team) => (
          <Card 
            key={team.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setActiveTeamSheet(team.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{team.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {team.players.map(p => p.name).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Hole</p>
                    <p className="text-xl font-bold">{teamScores[team.id] ?? '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-semibold text-muted-foreground">{calculateTeamTotal(team.id)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* PlayerScoreSheets for each team */}
        {teams.map((team) => (
          <PlayerScoreSheet
            key={`sheet-${team.id}`}
            open={activeTeamSheet === team.id}
            onOpenChange={(open) => {
              if (!open) setActiveTeamSheet(null);
            }}
            playerName={team.name}
            par={par}
            holeNumber={currentHole}
            currentScore={teamScores[team.id] ?? null}
            onScoreSelect={(score) => handleScoreSelect(team.id, score)}
            onEnterAndNext={advanceToNextTeamSheet}
          />
        ))}

        {/* Navigation buttons */}
        <div className="flex gap-2 pt-4">
          {currentHole > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigateHole('prev')}
            >
              Previous Hole
            </Button>
          )}
          {isLastHole && allScoresEntered ? (
            <Button className="flex-1" onClick={finishGame}>
              Finish Game
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => navigateHole('next')}
              disabled={currentHole === game.holes_played}
            >
              Next Hole
            </Button>
          )}
        </div>
      </div>

      <ScrambleBottomTabBar gameId={gameId!} />

      {/* Exit Dialog */}
      <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Game</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogAction onClick={handleSaveAndExit}>
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteGame}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Game
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
