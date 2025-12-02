import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Trophy, Zap, RotateCcw, Check } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import {
  calculateTeamLow,
  calculateIndividualLow,
  calculateBirdieEagle,
  calculateHolePoints,
  calculateRoll,
} from "@/utils/umbriagioScoring";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function UmbriagioPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Current hole state
  const [par, setPar] = useState(4);
  const [scores, setScores] = useState({
    teamAPlayer1: 0,
    teamAPlayer2: 0,
    teamBPlayer1: 0,
    teamBPlayer2: 0,
  });
  const [closestToPinWinner, setClosestToPinWinner] = useState<'A' | 'B' | null>(null);
  const [multiplier, setMultiplier] = useState<1 | 2 | 4>(1);
  const [doubleCalledBy, setDoubleCalledBy] = useState<'A' | 'B' | null>(null);
  const [doubleBackCalled, setDoubleBackCalled] = useState(false);
  
  // Roll dialog
  const [showRollDialog, setShowRollDialog] = useState(false);
  const [currentStake, setCurrentStake] = useState(10);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      // Type cast the game data
      const typedGame: UmbriagioGame = {
        ...gameData,
        payout_mode: gameData.payout_mode as 'difference' | 'total',
        roll_history: (gameData.roll_history as unknown as RollEvent[]) || [],
        winning_team: gameData.winning_team as 'A' | 'B' | 'TIE' | null,
      };
      
      setGame(typedGame);
      setCurrentStake(typedGame.stake_per_point);

      const { data: holesData, error: holesError } = await supabase
        .from("umbriago_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
      // Type cast holes data
      const typedHoles: UmbriagioHole[] = (holesData || []).map(h => ({
        ...h,
        team_low_winner: h.team_low_winner as 'A' | 'B' | null,
        individual_low_winner: h.individual_low_winner as 'A' | 'B' | null,
        closest_to_pin_winner: h.closest_to_pin_winner as 'A' | 'B' | null,
        birdie_eagle_winner: h.birdie_eagle_winner as 'A' | 'B' | null,
        multiplier: h.multiplier as 1 | 2 | 4,
        double_called_by: h.double_called_by as 'A' | 'B' | null,
      }));
      
      setHoles(typedHoles);

      // Calculate current stake based on rolls
      if (typedGame.roll_history.length > 0) {
        const lastRoll = typedGame.roll_history[typedGame.roll_history.length - 1];
        setCurrentStake(lastRoll.new_stake);
      }

      // Set current hole to first incomplete or next hole
      if (typedHoles.length > 0) {
        setCurrentHole(typedHoles.length + 1);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDouble = (team: 'A' | 'B') => {
    if (multiplier === 1) {
      setMultiplier(2);
      setDoubleCalledBy(team);
      toast({ title: `Team ${team} called Double!`, description: "Multiplier is now ×2" });
    }
  };

  const handleDoubleBack = () => {
    if (multiplier === 2 && !doubleBackCalled) {
      setMultiplier(4);
      setDoubleBackCalled(true);
      toast({ title: "Double Back!", description: "Multiplier is now ×4" });
    }
  };

  const handleRoll = () => {
    if (!game) return;
    
    const currentDiff = Math.abs(game.team_a_total_points - game.team_b_total_points);
    const { newDifference, newStake } = calculateRoll(currentDiff, currentStake);
    
    setShowRollDialog(true);
  };

  const confirmRoll = async () => {
    if (!game) return;
    
    const currentDiff = Math.abs(game.team_a_total_points - game.team_b_total_points);
    const { newDifference, newStake } = calculateRoll(currentDiff, currentStake);
    
    const rollEvent: RollEvent = {
      hole: currentHole,
      old_difference: currentDiff,
      new_stake: newStake,
    };

    const updatedRollHistory = [...game.roll_history, rollEvent];
    
    // Adjust team points based on new difference
    const leadingTeam = game.team_a_total_points > game.team_b_total_points ? 'A' : 'B';
    let newTeamAPoints = 0;
    let newTeamBPoints = 0;
    
    if (leadingTeam === 'A') {
      newTeamAPoints = newDifference;
      newTeamBPoints = 0;
    } else {
      newTeamAPoints = 0;
      newTeamBPoints = newDifference;
    }

    try {
      const { error } = await supabase
        .from("umbriago_games")
        .update({
          roll_history: updatedRollHistory as unknown as any,
          team_a_total_points: newTeamAPoints,
          team_b_total_points: newTeamBPoints,
        })
        .eq("id", game.id);

      if (error) throw error;

      setGame({
        ...game,
        roll_history: updatedRollHistory,
        team_a_total_points: newTeamAPoints,
        team_b_total_points: newTeamBPoints,
      });
      setCurrentStake(newStake);
      setShowRollDialog(false);
      
      toast({ 
        title: "Roll applied!", 
        description: `New stake: ${newStake} SEK per point. Difference now: ${newDifference}` 
      });
    } catch (error: any) {
      toast({ title: "Error applying roll", variant: "destructive" });
    }
  };

  const saveHole = async () => {
    if (!game) return;
    
    // Calculate category winners
    const holeScores = {
      teamAPlayer1: scores.teamAPlayer1,
      teamAPlayer2: scores.teamAPlayer2,
      teamBPlayer1: scores.teamBPlayer1,
      teamBPlayer2: scores.teamBPlayer2,
      par,
    };

    const teamLowWinner = calculateTeamLow(holeScores);
    const individualLowWinner = calculateIndividualLow(holeScores);
    const birdieEagleWinner = calculateBirdieEagle(holeScores);

    const categories = {
      teamLowWinner,
      individualLowWinner,
      closestToPinWinner,
      birdieEagleWinner,
    };

    const { teamAPoints, teamBPoints, isUmbriago } = calculateHolePoints(categories, multiplier);

    // Calculate running totals
    const teamARunning = game.team_a_total_points + teamAPoints;
    const teamBRunning = game.team_b_total_points + teamBPoints;

    setSaving(true);
    try {
      // Insert hole
      const { error: holeError } = await supabase
        .from("umbriago_holes")
        .insert({
          game_id: game.id,
          hole_number: currentHole,
          par,
          team_a_player_1_score: scores.teamAPlayer1,
          team_a_player_2_score: scores.teamAPlayer2,
          team_b_player_1_score: scores.teamBPlayer1,
          team_b_player_2_score: scores.teamBPlayer2,
          team_low_winner: teamLowWinner,
          individual_low_winner: individualLowWinner,
          closest_to_pin_winner: closestToPinWinner,
          birdie_eagle_winner: birdieEagleWinner,
          multiplier,
          double_called_by: doubleCalledBy,
          double_back_called: doubleBackCalled,
          is_umbriago: isUmbriago,
          team_a_hole_points: teamAPoints,
          team_b_hole_points: teamBPoints,
          team_a_running_total: teamARunning,
          team_b_running_total: teamBRunning,
        });

      if (holeError) throw holeError;

      // Update game totals
      const { error: gameError } = await supabase
        .from("umbriago_games")
        .update({
          team_a_total_points: teamARunning,
          team_b_total_points: teamBRunning,
        })
        .eq("id", game.id);

      if (gameError) throw gameError;

      // Update local state
      setGame({
        ...game,
        team_a_total_points: teamARunning,
        team_b_total_points: teamBRunning,
      });

      if (isUmbriago) {
        toast({ title: "🎉 UMBRIAGO!", description: "All 4 categories won - points doubled!" });
      }

      // Check if game is over
      if (currentHole >= game.holes_played) {
        navigate(`/umbriago/${game.id}/summary`);
      } else {
        // Move to next hole
        setCurrentHole(currentHole + 1);
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
    setPar(4);
    setScores({ teamAPlayer1: 0, teamAPlayer2: 0, teamBPlayer1: 0, teamBPlayer2: 0 });
    setClosestToPinWinner(null);
    setMultiplier(1);
    setDoubleCalledBy(null);
    setDoubleBackCalled(false);
  };

  const updateScore = (player: keyof typeof scores, delta: number) => {
    setScores(prev => ({
      ...prev,
      [player]: Math.max(1, prev[player] + delta),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds')}>
            <ArrowLeft size={20} />
          </Button>
          <div className="text-center">
            <h1 className="font-bold">Hole {currentHole} of {game.holes_played}</h1>
            <p className="text-sm text-muted-foreground">{game.course_name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/umbriago/${game.id}/summary`)}>
            <Trophy size={20} />
          </Button>
        </div>

        {/* Running Score */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-red-500/10">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground">Team A</div>
                <div className="text-3xl font-bold text-blue-500">{game.team_a_total_points}</div>
              </div>
              <div className="text-center px-4">
                <div className="text-xs text-muted-foreground">Stake</div>
                <div className="font-semibold">{currentStake} SEK</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground">Team B</div>
                <div className="text-3xl font-bold text-red-500">{game.team_b_total_points}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Par Selection */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Par</Label>
              <div className="flex gap-2">
                {[3, 4, 5].map(p => (
                  <Button
                    key={p}
                    variant={par === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPar(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Team A */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-semibold text-sm">Team A</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  label={game.team_a_player_1}
                  value={scores.teamAPlayer1}
                  onChange={(delta) => updateScore('teamAPlayer1', delta)}
                />
                <ScoreInput
                  label={game.team_a_player_2}
                  value={scores.teamAPlayer2}
                  onChange={(delta) => updateScore('teamAPlayer2', delta)}
                />
              </div>
            </div>
            
            {/* Team B */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-semibold text-sm">Team B</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  label={game.team_b_player_1}
                  value={scores.teamBPlayer1}
                  onChange={(delta) => updateScore('teamBPlayer1', delta)}
                />
                <ScoreInput
                  label={game.team_b_player_2}
                  value={scores.teamBPlayer2}
                  onChange={(delta) => updateScore('teamBPlayer2', delta)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Closest to Pin */}
        <Card>
          <CardContent className="p-4">
            <Label className="font-semibold">Closest to Pin in Regulation</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={closestToPinWinner === 'A' ? "default" : "outline"}
                onClick={() => setClosestToPinWinner('A')}
                className="flex-1"
              >
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                Team A
              </Button>
              <Button
                variant={closestToPinWinner === null ? "default" : "outline"}
                onClick={() => setClosestToPinWinner(null)}
                className="flex-1"
              >
                Tie
              </Button>
              <Button
                variant={closestToPinWinner === 'B' ? "default" : "outline"}
                onClick={() => setClosestToPinWinner('B')}
                className="flex-1"
              >
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                Team B
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Multiplier */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Hole Multiplier</Label>
              <div className="flex items-center gap-2">
                <Zap className={multiplier > 1 ? "text-yellow-500" : "text-muted-foreground"} size={16} />
                <span className="text-xl font-bold">×{multiplier}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleDouble('A')}
                disabled={multiplier > 1}
                className="text-blue-500 border-blue-500/50"
              >
                Team A: Double
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDouble('B')}
                disabled={multiplier > 1}
                className="text-red-500 border-red-500/50"
              >
                Team B: Double
              </Button>
            </div>
            
            {multiplier === 2 && (
              <Button
                variant="outline"
                onClick={handleDoubleBack}
                disabled={doubleBackCalled}
                className="w-full"
              >
                {doubleBackCalled ? "Double Back Applied" : "Double Back (→ ×4)"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={handleRoll}
            variant="outline"
            className="w-full"
            disabled={game.team_a_total_points === game.team_b_total_points}
          >
            <RotateCcw size={16} className="mr-2" />
            Roll (Split)
          </Button>
          
          <Button
            onClick={saveHole}
            disabled={saving || scores.teamAPlayer1 === 0}
            className="w-full"
            size="lg"
          >
            {saving ? "Saving..." : currentHole >= game.holes_played ? "Finish Game" : "Next Hole"}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>

      {/* Roll Dialog */}
      <Dialog open={showRollDialog} onOpenChange={setShowRollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Roll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Roll will halve the point difference and double the stake per point.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span>Current difference:</span>
                <span className="font-bold">{Math.abs(game.team_a_total_points - game.team_b_total_points)}</span>
              </div>
              <div className="flex justify-between">
                <span>New difference:</span>
                <span className="font-bold">{Math.ceil(Math.abs(game.team_a_total_points - game.team_b_total_points) / 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Current stake:</span>
                <span>{currentStake} SEK</span>
              </div>
              <div className="flex justify-between">
                <span>New stake:</span>
                <span className="font-bold text-primary">{currentStake * 2} SEK</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollDialog(false)}>Cancel</Button>
            <Button onClick={confirmRoll}>Confirm Roll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreInput({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: number; 
  onChange: (delta: number) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground truncate block">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(-1)}
          disabled={value <= 1}
          className="h-10 w-10"
        >
          -
        </Button>
        <div className="flex-1 text-center text-xl font-bold">{value || '-'}</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(1)}
          className="h-10 w-10"
        >
          +
        </Button>
      </div>
    </div>
  );
}
