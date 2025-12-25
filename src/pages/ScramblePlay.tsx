import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { ScoreMoreSheet } from "@/components/play/ScoreMoreSheet";
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
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [teamScores, setTeamScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [activeTeamSheet, setActiveTeamSheet] = useState<string | null>(null);
  
  // More sheet state
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [currentComment, setCurrentComment] = useState("");
  // Map: teamId -> Map<holeNumber, comment>
  const [holeComments, setHoleComments] = useState<Map<string, Map<number, string>>>(new Map());

  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;

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
      
      // Set to first unplayed hole on initial load
      if (scrambleHoles.length > 0) {
        setCurrentHoleIndex(scrambleHoles.length);
      }
    }

    setLoading(false);
  };

  const loadHoleData = (holeNumber: number) => {
    const holeData = holes.find(h => h.hole_number === holeNumber);
    if (holeData) {
      setTeamScores(holeData.team_scores || {});
    } else {
      const emptyScores: Record<string, number | null> = {};
      teams.forEach(t => { emptyScores[t.id] = null; });
      setTeamScores(emptyScores);
    }
  };

  const getCurrentHolePar = () => {
    const hole = courseHoles.find(h => h.hole_number === currentHole);
    return hole?.par || 4;
  };

  const getCurrentHoleStrokeIndex = () => {
    const hole = courseHoles.find(h => h.hole_number === currentHole);
    return hole?.stroke_index || currentHole;
  };

  const saveHole = async () => {
    if (!gameId) return;
    
    const par = getCurrentHolePar();
    const strokeIndex = getCurrentHoleStrokeIndex();

    const { error } = await supabase
      .from('scramble_holes')
      .upsert({
        game_id: gameId,
        hole_number: currentHole,
        par,
        stroke_index: strokeIndex,
        team_scores: teamScores
      }, {
        onConflict: 'game_id,hole_number'
      });

    if (error) {
      console.error('Error saving score:', error);
      toast.error("Failed to save score");
      return false;
    }

    // Update local holes state
    setHoles(prev => {
      const existing = prev.find(h => h.hole_number === currentHole);
      if (existing) {
        return prev.map(h => h.hole_number === currentHole ? { ...h, team_scores: teamScores } : h);
      } else {
        return [...prev, {
          id: `temp-${currentHole}`,
          game_id: gameId,
          hole_number: currentHole,
          par,
          stroke_index: strokeIndex,
          created_at: new Date().toISOString(),
          team_scores: teamScores
        }];
      }
    });

    return true;
  };

  const handleScoreSelect = async (teamId: string, score: number | null) => {
    const newScores = { ...teamScores, [teamId]: score };
    setTeamScores(newScores);
    
    // Save immediately when score is selected
    if (!gameId) return;
    
    const par = getCurrentHolePar();
    const strokeIndex = getCurrentHoleStrokeIndex();

    await supabase
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

    // Update local holes state
    setHoles(prev => {
      const existing = prev.find(h => h.hole_number === currentHole);
      if (existing) {
        return prev.map(h => h.hole_number === currentHole ? { ...h, team_scores: newScores } : h);
      } else {
        return [...prev, {
          id: `temp-${currentHole}`,
          game_id: gameId,
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
      setActiveTeamSheet(teams[currentIndex + 1].id);
    } else {
      setActiveTeamSheet(null);
      // Auto-advance to next hole if not the last hole
      if (game && currentHole < game.holes_played) {
        setCurrentHoleIndex(currentHoleIndex + 1);
        loadHoleData(currentHole + 1);
      }
    }
  };

  // More sheet handlers
  const handleOpenMoreSheet = () => {
    if (activeTeamSheet) {
      const existingComment = holeComments.get(activeTeamSheet)?.get(currentHole) || "";
      setCurrentComment(existingComment);
      setShowMoreSheet(true);
    }
  };

  const handleSaveMore = () => {
    if (activeTeamSheet && currentComment.trim()) {
      setHoleComments(prev => {
        const updated = new Map(prev);
        const teamComments = new Map(prev.get(activeTeamSheet) || []);
        teamComments.set(currentHole, currentComment);
        updated.set(activeTeamSheet, teamComments);
        return updated;
      });
    }
    setShowMoreSheet(false);
  };

  const getActiveTeamName = (): string => {
    if (!activeTeamSheet) return "";
    const team = teams.find(t => t.id === activeTeamSheet);
    return team?.name || "";
  };

  const navigateHole = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentHoleIndex > 0) {
      const targetHole = currentHole - 1;
      loadHoleData(targetHole);
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === 'next' && game && currentHole <= Math.min(holes.length + 1, totalHoles)) {
      const targetHole = currentHole + 1;
      if (targetHole <= totalHoles) {
        loadHoleData(targetHole);
        setCurrentHoleIndex(currentHoleIndex + 1);
      }
    }
  };

  const calculateTeamTotal = (teamId: string): number => {
    return holes.reduce((total, hole) => {
      const score = hole.team_scores[teamId];
      return total + (score || 0);
    }, 0);
  };

  const calculateTeamToPar = (teamId: string): string => {
    let totalScore = 0;
    let totalPar = 0;
    
    holes.forEach(hole => {
      const score = hole.team_scores[teamId];
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
      }
    });
    
    if (totalScore === 0) return "E";
    
    const diff = totalScore - totalPar;
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const finishGame = async () => {
    if (!game) return;

    // Save current hole first
    await saveHole();

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
    await saveHole();
    setExitDialogOpen(false);
    toast.success("Game saved");
    navigate('/rounds-play');
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    
    await supabase.from('scramble_holes').delete().eq('game_id', gameId);
    const { error } = await supabase.from('scramble_games').delete().eq('id', gameId);

    if (error) {
      toast.error("Failed to delete game");
      return;
    }

    setExitDialogOpen(false);
    toast.success("Game deleted");
    navigate('/rounds-play');
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
  const allScoresEntered = teams.every(t => teamScores[t.id] !== null && teamScores[t.id] !== undefined && teamScores[t.id]! > 0);
  const isLastHole = currentHole === game.holes_played;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExitDialogOpen(true)}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Scramble</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-[hsl(120,20%,85%)] py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole('prev')}
              disabled={currentHoleIndex === 0}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-[hsl(120,20%,40%)]">PAR {par}</div>
              <div className="text-2xl font-bold text-[hsl(120,20%,25%)]">Hole {currentHole}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole('next')}
              disabled={currentHole > holes.length || currentHole >= totalHoles}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Team Scores */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {teams.map((team) => (
          <Card 
            key={team.id} 
            className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setActiveTeamSheet(team.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">{team.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {team.players.map(p => p.name.split(' ')[0]).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{teamScores[team.id] ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Strokes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{calculateTeamToPar(team.id)}</div>
                  <div className="text-xs text-muted-foreground font-bold">To Par</div>
                </div>
              </div>
            </div>
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
            onMore={handleOpenMoreSheet}
            onEnterAndNext={advanceToNextTeamSheet}
          />
        ))}

        {/* Score More Sheet */}
        <ScoreMoreSheet
          open={showMoreSheet}
          onOpenChange={setShowMoreSheet}
          holeNumber={currentHole}
          par={par}
          playerName={getActiveTeamName()}
          comment={currentComment}
          onCommentChange={setCurrentComment}
          mulligansAllowed={0}
          mulligansUsed={0}
          mulliganUsedOnThisHole={false}
          onUseMulligan={() => {}}
          onRemoveMulligan={() => {}}
          onSave={handleSaveMore}
        />

        {/* Finish Game button - only shown on last hole when all scores entered */}
        {isLastHole && allScoresEntered && (
          <Button 
            onClick={finishGame}
            className="w-full"
          >
            Finish Game
          </Button>
        )}
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
