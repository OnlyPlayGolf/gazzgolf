import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { calculatePayout, normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { UmbriagioShareDialogWithScorecard } from "@/components/UmbriagioShareDialogWithScorecard";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface TeamCombination {
  teamA: [string, string];
  teamB: [string, string];
}

interface RotationSchedule {
  type: "every9" | "every6";
  schedule: TeamCombination[];
}

export default function UmbriagioSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(true);
  const [currentUserTeam, setCurrentUserTeam] = useState<'A' | 'B' | null>(null);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  // Set current hole to the last hole played once data is loaded
  useEffect(() => {
    if (holes.length > 0) {
      setCurrentHoleIndex(holes.length - 1);
    }
  }, [holes.length]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: UmbriagioGame = {
        ...gameData,
        payout_mode: gameData.payout_mode as 'difference' | 'total',
        roll_history: (gameData.roll_history as unknown as RollEvent[]) || [],
        winning_team: gameData.winning_team as 'A' | 'B' | 'TIE' | null,
      };
      
      setGame(typedGame);

      // Fetch course holes for scorecard
      if (gameData.course_id) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");

        if (courseHolesData) {
          const filteredHoles = gameData.holes_played === 9 
            ? courseHolesData.slice(0, 9) 
            : courseHolesData;
          setCourseHoles(filteredHoles);
        }
      }

      // Determine current user's team
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .single();

        if (profile) {
          const userName = profile.display_name || profile.username || '';
          if (userName === gameData.team_a_player_1 || userName === gameData.team_a_player_2) {
            setCurrentUserTeam('A');
          } else if (userName === gameData.team_b_player_1 || userName === gameData.team_b_player_2) {
            setCurrentUserTeam('B');
          }
        }
      }

      const { data: holesData, error: holesError } = await supabase
        .from("umbriago_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
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

      if (!typedGame.is_finished && typedHoles.length === typedGame.holes_played) {
        await finishGame(typedGame, typedHoles);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const finishGame = async (gameData: UmbriagioGame, holesData: UmbriagioHole[]) => {
    const finalStake = gameData.stake_per_point;

    const { winner, payout } = calculatePayout(
      gameData.team_a_total_points,
      gameData.team_b_total_points,
      finalStake,
      gameData.payout_mode
    );

    try {
      const { error } = await supabase
        .from("umbriago_games")
        .update({
          is_finished: true,
          winning_team: winner,
          final_payout: payout,
        })
        .eq("id", gameData.id);

      if (error) throw error;

      setGame({
        ...gameData,
        is_finished: true,
        winning_team: winner,
        final_payout: payout,
      });
    } catch (error: any) {
      console.error("Error finishing game:", error);
    }
  };

  // Get current hole data
  const currentHole = currentHoleIndex + 1;
  const totalHoles = game?.holes_played || 18;
  const currentHoleData = holes.find(h => h.hole_number === currentHole);
  const currentCourseHole = courseHoles.find(h => h.hole_number === currentHole);
  const par = currentCourseHole?.par || 4;

  // Load rotation schedule from sessionStorage
  const rotationSchedule = useMemo<RotationSchedule | null>(() => {
    if (!gameId) return null;
    const stored = sessionStorage.getItem(`umbriago_rotation_${gameId}`);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as RotationSchedule;
    } catch {
      return null;
    }
  }, [gameId]);

  // Get current team players based on rotation and hole number
  const getCurrentTeamPlayers = useMemo(() => {
    if (!game) return null;
    
    const defaultPlayers = {
      teamA: [game.team_a_player_1, game.team_a_player_2] as [string, string],
      teamB: [game.team_b_player_1, game.team_b_player_2] as [string, string],
    };
    
    if (!rotationSchedule || rotationSchedule.schedule.length === 0) {
      return defaultPlayers;
    }
    
    const holesPerSegment = rotationSchedule.type === "every9" ? 9 : 6;
    const segmentIndex = Math.min(
      Math.floor((currentHole - 1) / holesPerSegment),
      rotationSchedule.schedule.length - 1
    );
    
    return rotationSchedule.schedule[segmentIndex] || defaultPlayers;
  }, [game, rotationSchedule, currentHole]);

  // Calculate the current segment range and segment-specific points
  const segmentInfo = useMemo(() => {
    if (!rotationSchedule || rotationSchedule.schedule.length <= 1) {
      const rawA = game?.team_a_total_points || 0;
      const rawB = game?.team_b_total_points || 0;
      const { normalizedA, normalizedB } = normalizeUmbriagioPoints(rawA, rawB);
      return {
        startHole: 1,
        endHole: totalHoles,
        teamASegmentPoints: normalizedA,
        teamBSegmentPoints: normalizedB,
        isRotating: false,
      };
    }
    
    const holesPerSegment = rotationSchedule.type === "every9" ? 9 : 6;
    const segmentIndex = Math.floor((currentHole - 1) / holesPerSegment);
    const startHole = segmentIndex * holesPerSegment + 1;
    const endHole = Math.min((segmentIndex + 1) * holesPerSegment, totalHoles);
    
    let teamASegmentPoints = 0;
    let teamBSegmentPoints = 0;
    
    holes.forEach(hole => {
      if (hole.hole_number >= startHole && hole.hole_number <= endHole) {
        teamASegmentPoints += hole.team_a_hole_points;
        teamBSegmentPoints += hole.team_b_hole_points;
      }
    });
    
    const { normalizedA, normalizedB } = normalizeUmbriagioPoints(teamASegmentPoints, teamBSegmentPoints);
    
    return {
      startHole,
      endHole,
      teamASegmentPoints: normalizedA,
      teamBSegmentPoints: normalizedB,
      isRotating: true,
      segmentIndex: segmentIndex + 1,
      totalSegments: rotationSchedule.schedule.length,
    };
  }, [rotationSchedule, currentHole, totalHoles, holes, game?.team_a_total_points, game?.team_b_total_points]);

  const navigateHole = (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next" && currentHole < holes.length) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const getWinnerName = () => {
    if (game?.winning_team === 'A') return `${game.team_a_player_1} & ${game.team_a_player_2}`;
    if (game?.winning_team === 'B') return `${game.team_b_player_1} & ${game.team_b_player_2}`;
    return undefined;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        {gameId && <UmbriagioBottomTabBar gameId={gameId} isSpectator={true} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
        {gameId && <UmbriagioBottomTabBar gameId={gameId} isSpectator={true} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Share Dialog Modal */}
      <UmbriagioShareDialogWithScorecard
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
        currentUserTeam={currentUserTeam}
        onContinue={() => {}}
      />

      {/* Spectator Mode Background - Read-Only In-Round View */}
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/rounds-play")}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Umbriago</h1>
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
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-[hsl(120,20%,40%)]">PAR {par}</div>
              <div className="text-2xl font-bold text-[hsl(120,20%,25%)]">Hole {currentHole}</div>
              {currentHoleData && currentHoleData.multiplier > 1 && (
                <div className="text-sm font-bold text-amber-600">×{currentHoleData.multiplier}</div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHole >= holes.length}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Closest to Pin (Read-Only) */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Closest to Pin</h3>
          <div className="flex gap-2">
            <Button
              variant={currentHoleData?.closest_to_pin_winner === 'A' ? 'default' : 'outline'}
              className="flex-1 pointer-events-none"
              disabled
            >
              {game.team_a_name}
            </Button>
            <Button
              variant={currentHoleData?.closest_to_pin_winner === 'B' ? 'default' : 'outline'}
              className="flex-1 pointer-events-none"
              disabled
            >
              {game.team_b_name}
            </Button>
          </div>
        </Card>

        {/* Team A (Read-Only) */}
        <Card className="p-4">
          <h3 className="font-semibold text-blue-600 mb-3">{game.team_a_name}</h3>
          <div className="space-y-2">
            {[
              { name: getCurrentTeamPlayers?.teamA[0] || game.team_a_player_1, score: currentHoleData?.team_a_player_1_score },
              { name: getCurrentTeamPlayers?.teamA[1] || game.team_a_player_2, score: currentHoleData?.team_a_player_2_score },
            ].map((player, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">{player.name}</span>
                <div className="flex flex-col items-center">
                  <span className={`text-xl font-bold ${player.score !== null && player.score !== undefined && player.score > 0 ? '' : 'text-muted-foreground'}`}>
                    {player.score === null ? '–' : player.score !== undefined && player.score > 0 ? player.score : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Disabled action buttons for spectator mode */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={currentHoleData?.double_called_by === 'A' || (currentHoleData?.double_back_called && currentHoleData?.double_called_by === 'B') ? 'default' : 'outline'}
              size="sm"
              disabled
              className="flex-1 pointer-events-none"
            >
              Double
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 pointer-events-none"
            >
              Roll
            </Button>
          </div>
        </Card>

        {/* Team B (Read-Only) */}
        <Card className="p-4">
          <h3 className="font-semibold text-red-600 mb-3">{game.team_b_name}</h3>
          <div className="space-y-2">
            {[
              { name: getCurrentTeamPlayers?.teamB[0] || game.team_b_player_1, score: currentHoleData?.team_b_player_1_score },
              { name: getCurrentTeamPlayers?.teamB[1] || game.team_b_player_2, score: currentHoleData?.team_b_player_2_score },
            ].map((player, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">{player.name}</span>
                <div className="flex flex-col items-center">
                  <span className={`text-xl font-bold ${player.score !== null && player.score !== undefined && player.score > 0 ? '' : 'text-muted-foreground'}`}>
                    {player.score === null ? '–' : player.score !== undefined && player.score > 0 ? player.score : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Disabled action buttons for spectator mode */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={currentHoleData?.double_called_by === 'B' || (currentHoleData?.double_back_called && currentHoleData?.double_called_by === 'A') ? 'default' : 'outline'}
              size="sm"
              disabled
              className="flex-1 pointer-events-none"
            >
              Double
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex-1 pointer-events-none"
            >
              Roll
            </Button>
          </div>
        </Card>

        {/* Points Display */}
        <Card className="p-4">
          {segmentInfo.isRotating && (
            <div className="text-center text-xs text-muted-foreground mb-2">
              Segment {segmentInfo.segmentIndex}/{segmentInfo.totalSegments} (Holes {segmentInfo.startHole}-{segmentInfo.endHole})
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">{game.team_a_name}</div>
              <div className="text-2xl font-bold text-blue-600">{segmentInfo.teamASegmentPoints}</div>
            </div>
            <div className="text-muted-foreground">vs</div>
            <div className="text-center flex-1">
              <div className="text-sm text-muted-foreground">{game.team_b_name}</div>
              <div className="text-2xl font-bold text-red-600">{segmentInfo.teamBSegmentPoints}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Tab Bar - Spectator Mode (hides Enter Score tab) */}
      {gameId && <UmbriagioBottomTabBar gameId={gameId} isSpectator={true} />}
    </div>
  );
}
