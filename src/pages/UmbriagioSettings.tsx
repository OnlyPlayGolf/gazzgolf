import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dice5, RefreshCw } from "lucide-react";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame } from "@/types/umbriago";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

type TeamRotation = "none" | "every9" | "every6";

interface TeamCombination {
  teamA: [string, string];
  teamB: [string, string];
}

function generateTeamCombinations(players: string[]): TeamCombination[] {
  if (players.length !== 4) return [];
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

function generateRotationSchedule(
  players: string[],
  rotation: TeamRotation,
  initialTeams: TeamCombination
): TeamCombination[] {
  if (rotation === "none") return [initialTeams];

  const allCombinations = generateTeamCombinations(players);
  const numSegments = rotation === "every9" ? 2 : 3;
  
  const initialIndex = allCombinations.findIndex(
    c => c.teamA.sort().join() === initialTeams.teamA.sort().join()
  );

  const remaining = allCombinations.filter((_, i) => i !== initialIndex);
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  const schedule: TeamCombination[] = [initialTeams];
  
  for (let i = 1; i < numSegments; i++) {
    if (shuffled.length > 0) {
      schedule.push(shuffled[i - 1]);
    }
  }

  return schedule;
}

export default function UmbriagioSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  
  // Game settings state
  const [rollsPerTeam, setRollsPerTeam] = useState(1);
  const [teamRotation, setTeamRotation] = useState<TeamRotation>("none");

  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchProgress();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (data) {
        setGame(data as unknown as UmbriagioGame);
        setRollsPerTeam(data.rolls_per_team || 1);
        
        // Load rotation from sessionStorage
        const storedRotation = sessionStorage.getItem(`umbriago_rotation_${gameId}`);
        if (storedRotation) {
          try {
            const parsed = JSON.parse(storedRotation);
            setTeamRotation(parsed.type || "none");
          } catch {
            setTeamRotation("none");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("umbriago_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleRollsChange = async (value: string) => {
    const newRolls = parseInt(value);
    setRollsPerTeam(newRolls);
    
    if (!gameId) return;
    
    try {
      await supabase
        .from("umbriago_games")
        .update({ rolls_per_team: newRolls })
        .eq("id", gameId);
      
      toast({ title: "Rolls per team updated" });
    } catch (error: any) {
      toast({ title: "Error updating", description: error.message, variant: "destructive" });
    }
  };

  const handleRotationChange = (value: TeamRotation) => {
    setTeamRotation(value);
    
    if (!gameId || !game) return;
    
    const playerNames = [
      game.team_a_player_1,
      game.team_a_player_2,
      game.team_b_player_1,
      game.team_b_player_2,
    ];
    
    const initialTeams: TeamCombination = {
      teamA: [playerNames[0], playerNames[1]],
      teamB: [playerNames[2], playerNames[3]]
    };
    
    if (value === "none") {
      sessionStorage.removeItem(`umbriago_rotation_${gameId}`);
      toast({ title: "Team rotation disabled" });
    } else {
      const schedule = generateRotationSchedule(playerNames, value, initialTeams);
      sessionStorage.setItem(`umbriago_rotation_${gameId}`, JSON.stringify({
        type: value,
        schedule
      }));
      toast({ title: "Team rotation updated" });
    }
  };

  const getRotationPreview = () => {
    if (teamRotation === "none" || !game) return null;

    const playerNames = [
      game.team_a_player_1,
      game.team_a_player_2,
      game.team_b_player_1,
      game.team_b_player_2,
    ];
    
    // Try to get existing schedule from sessionStorage
    const storedRotation = sessionStorage.getItem(`umbriago_rotation_${gameId}`);
    let schedule: TeamCombination[] = [];
    
    if (storedRotation) {
      try {
        const parsed = JSON.parse(storedRotation);
        schedule = parsed.schedule || [];
      } catch {
        schedule = [];
      }
    }
    
    if (schedule.length === 0) {
      const initialTeams: TeamCombination = {
        teamA: [playerNames[0], playerNames[1]],
        teamB: [playerNames[2], playerNames[3]]
      };
      schedule = generateRotationSchedule(playerNames, teamRotation, initialTeams);
    }
    
    const holesPerSegment = teamRotation === "every9" ? 9 : 6;

    return (
      <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Rotation Preview:</p>
        {schedule.map((combo, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">Holes {i * holesPerSegment + 1}-{(i + 1) * holesPerSegment}:</span>
            <span className="ml-2 text-blue-600">{combo.teamA.join(" & ")}</span>
            <span className="mx-1">vs</span>
            <span className="text-red-600">{combo.teamB.join(" & ")}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const winner = game.team_a_total_points > game.team_b_total_points ? "A" : 
                     game.team_b_total_points > game.team_a_total_points ? "B" : null;
      
      await supabase
        .from("umbriago_games")
        .update({ is_finished: true, winning_team: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/umbriago/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    
    setDeleting(true);
    try {
      await supabase.from("umbriago_holes").delete().eq("game_id", gameId);
      const { error } = await supabase.from("umbriago_games").delete().eq("id", gameId);
      if (error) throw error;

      // Clean up sessionStorage
      sessionStorage.removeItem(`umbriago_rotation_${gameId}`);
      
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const players: GamePlayer[] = [
    { name: game.team_a_player_1, team: "Team A" },
    { name: game.team_a_player_2, team: "Team A" },
    { name: game.team_b_player_1, team: "Team B" },
    { name: game.team_b_player_2, team: "Team B" },
  ];

  const gameDetails: GameDetailsData = {
    format: "Umbriago",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo: game.tee_set || "Not specified",
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `${game.stake_per_point} per point • ${game.payout_mode}`,
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* Game Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dice5 size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rolls per Team</Label>
              <Select value={rollsPerTeam.toString()} onValueChange={handleRollsChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Rolls</SelectItem>
                  <SelectItem value="1">1 Roll</SelectItem>
                  <SelectItem value="2">2 Rolls</SelectItem>
                  <SelectItem value="3">3 Rolls</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A Roll halves your team's points and doubles the next hole
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <RefreshCw size={14} />
                Team Rotation
              </Label>
              <Select value={teamRotation} onValueChange={(v) => handleRotationChange(v as TeamRotation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Rotation (Fixed Teams)</SelectItem>
                  <SelectItem value="every9">Rotate Every 9 Holes</SelectItem>
                  <SelectItem value="every6">Rotate Every 6 Holes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {teamRotation === "none" && "Teams stay the same for all 18 holes"}
                {teamRotation === "every9" && "Teams shuffle randomly after 9 holes"}
                {teamRotation === "every6" && "Teams shuffle randomly every 6 holes"}
              </p>
              {getRotationPreview()}
            </div>
          </CardContent>
        </Card>

        <RoundActionsSection
          isAdmin={true}
          onFinish={handleFinishGame}
          onSaveAndExit={() => navigate(`/umbriago/${gameId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
        />
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={players}
        useHandicaps={false}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Umbriago Game"
        deleting={deleting}
      />

      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
    </div>
  );
}
