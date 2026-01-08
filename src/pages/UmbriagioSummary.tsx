import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { calculatePayout, normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { UmbriagioShareDialogWithScorecard } from "@/components/UmbriagioShareDialogWithScorecard";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { UmbriagioSharedScorecard } from "@/components/UmbriagioSharedScorecard";
import { Card } from "@/components/ui/card";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
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

  const getLeader = () => {
    if (!game) return null;
    if (game.team_a_total_points > game.team_b_total_points) return 'A';
    if (game.team_b_total_points > game.team_a_total_points) return 'B';
    return null;
  };

  const leader = getLeader();

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

  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(game.team_a_total_points, game.team_b_total_points);

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

      {/* Header - Matches UmbriagioLeaderboard exactly */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{game.course_name}</h2>
          <p className="text-sm opacity-90">Umbriago</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Team Standings */}
        <div className="space-y-2">
          {(['A', 'B'] as const).map(team => {
            const isLeader = leader === team;
            const totalPoints = team === 'A' ? normalizedA : normalizedB;
            const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
            const player1 = team === 'A' ? game.team_a_player_1 : game.team_b_player_1;
            const player2 = team === 'A' ? game.team_a_player_2 : game.team_b_player_2;
            const rawPoints = team === 'A' ? game.team_a_total_points : game.team_b_total_points;
            const otherRawPoints = team === 'A' ? game.team_b_total_points : game.team_a_total_points;
            const positionLabel = rawPoints > otherRawPoints ? '1' : rawPoints < otherRawPoints ? '2' : 'T1';

            return (
              <Card key={team} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                      isLeader ? 'bg-amber-500/20 text-amber-600' : ''
                    }`}>
                      {positionLabel}
                    </div>
                    <div>
                      <div className="text-xl font-bold">{teamName}</div>
                      <div className="text-sm text-muted-foreground">
                        {player1} & {player2}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {totalPoints}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isLeader ? 'LEADING' : 'POINTS'}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        {/* Shared Scorecard */}
        {courseHoles.length > 0 && (
          <UmbriagioSharedScorecard
            game={game}
            holes={holes}
            courseHoles={courseHoles}
          />
        )}
        
        {leader === null && game.team_a_total_points === game.team_b_total_points && holes.length > 0 && (
          <div className="text-center text-muted-foreground py-2">
            Teams are tied!
          </div>
        )}
      </div>

      {/* Bottom Tab Bar - Spectator Mode (hides Enter Score tab) */}
      {gameId && <UmbriagioBottomTabBar gameId={gameId} isSpectator={true} />}
    </div>
  );
}
