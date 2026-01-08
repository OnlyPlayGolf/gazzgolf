import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { UmbriagioShareDialogWithScorecard } from "@/components/UmbriagioShareDialogWithScorecard";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [expandedTeam, setExpandedTeam] = useState<string | null>('A');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [currentHole, setCurrentHole] = useState(1);

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
      setCurrentHole(typedHoles.length > 0 ? typedHoles.length : 1);

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
    const { calculatePayout } = await import("@/utils/umbriagioScoring");
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

  // Create map for hole data lookup
  const holesMap = useMemo(() => new Map(holes.map(h => [h.hole_number, h])), [holes]);
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const totalHoles = game?.holes_played || 18;

  const getPlayerScore = (holeNumber: number, playerId: string): number | null => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    switch (playerId) {
      case 'team_a_player_1': return hole.team_a_player_1_score;
      case 'team_a_player_2': return hole.team_a_player_2_score;
      case 'team_b_player_1': return hole.team_b_player_1_score;
      case 'team_b_player_2': return hole.team_b_player_2_score;
      default: return null;
    }
  };

  const getPlayerPointsForHole = (holeNumber: number, playerId: string): number | null => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    if (playerId.startsWith('team_a')) return hole.team_a_hole_points;
    if (playerId.startsWith('team_b')) return hole.team_b_hole_points;
    return null;
  };

  const allPlayers = useMemo(() => {
    if (!game) return [];
    return [
      { id: 'team_a_player_1', name: game.team_a_player_1 },
      { id: 'team_a_player_2', name: game.team_a_player_2 },
      { id: 'team_b_player_1', name: game.team_b_player_1 },
      { id: 'team_b_player_2', name: game.team_b_player_2 },
    ];
  }, [game]);

  const getPlayerStats = (playerId: string) => {
    let totalScore = 0;
    let totalPar = 0;
    let holesPlayed = 0;
    let totalPoints = 0;

    holes.forEach(hole => {
      const score = getPlayerScore(hole.hole_number, playerId);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
        holesPlayed++;
      }
      const points = getPlayerPointsForHole(hole.hole_number, playerId);
      if (points !== null) {
        totalPoints += points;
      }
    });

    return { totalScore, totalPar, holesPlayed, totalPoints };
  };

  const rankedPlayers = useMemo(() => {
    const playersWithStats = allPlayers.map(player => ({
      ...player,
      stats: getPlayerStats(player.id)
    }));
    return playersWithStats.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
  }, [allPlayers, holes]);

  const getPlayerPositionLabel = (playerId: string): string => {
    const index = rankedPlayers.findIndex(p => p.id === playerId);
    if (index === -1) return "0";
    const playerPoints = rankedPlayers[index].stats.totalPoints;
    const playersAhead = rankedPlayers.filter(p => p.stats.totalPoints > playerPoints).length;
    const position = playersAhead + 1;
    const samePointsCount = rankedPlayers.filter(p => p.stats.totalPoints === playerPoints).length;
    if (samePointsCount > 1) return `T${position}`;
    return `${position}`;
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

  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(game.team_a_total_points, game.team_b_total_points);
  const leader = game.team_a_total_points > game.team_b_total_points ? 'A' : game.team_b_total_points > game.team_a_total_points ? 'B' : null;

  const renderPlayerCard = (player: { id: string; name: string }, positionLabel: string) => {
    const isExpanded = expandedPlayer === player.id;
    const stats = getPlayerStats(player.id);
    const isLeader = positionLabel === '1';

    return (
      <Card key={player.id} className="overflow-hidden pointer-events-none">
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                isLeader ? 'bg-amber-500/20 text-amber-600' : ''
              }`}>
                {positionLabel}
              </div>
              <div>
                <div className="text-xl font-bold">{player.name}</div>
                <div className="text-sm text-muted-foreground">
                  {stats.holesPlayed} holes played
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{stats.totalPoints}</div>
              <div className="text-sm text-muted-foreground">POINTS</div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderTeamCard = (team: 'A' | 'B') => {
    const isExpanded = expandedTeam === team;
    const teamName = team === 'A' ? 'Team A' : 'Team B';
    const teamPlayers = team === 'A' 
      ? `${game.team_a_player_1} & ${game.team_a_player_2}`
      : `${game.team_b_player_1} & ${game.team_b_player_2}`;
    const teamPoints = team === 'A' ? normalizedA : normalizedB;
    const isLeading = leader === team;
    const teamColor = team === 'A' ? 'text-blue-500' : 'text-red-500';

    return (
      <Card key={team} className="overflow-hidden pointer-events-none">
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                isLeading ? 'bg-amber-500/20 text-amber-600' : ''
              }`}>
                {isLeading ? '1' : '2'}
              </div>
              <div>
                <div className={`text-xl font-bold ${teamColor}`}>{teamName}</div>
                <div className="text-sm text-muted-foreground">{teamPlayers}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${teamColor}`}>{teamPoints}</div>
              <div className="text-sm text-muted-foreground">POINTS</div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Completion Modal */}
      <UmbriagioShareDialogWithScorecard
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
        currentUserTeam={currentUserTeam}
        onContinue={() => navigate("/rounds-play")}
      />

      {/* Spectator Mode Background - Read-only in-round view */}
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Hole {currentHole} of {totalHoles}</span>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold">{game.course_name}</h2>
            <p className="text-sm opacity-90">Umbriago</p>
          </div>
          <div className="w-16" />
        </div>
        
        {/* Score summary */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-200">{normalizedA}</div>
            <div className="text-xs opacity-75">Team A</div>
          </div>
          <div className="text-2xl font-bold self-center opacity-50">vs</div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-200">{normalizedB}</div>
            <div className="text-xs opacity-75">Team B</div>
          </div>
        </div>
      </div>

      {/* Read-only leaderboard content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Team Cards */}
        {renderTeamCard('A')}
        {renderTeamCard('B')}

        {/* Individual Player Cards */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Individual Standings</h3>
          <div className="space-y-3">
            {rankedPlayers.map(player => renderPlayerCard(player, getPlayerPositionLabel(player.id)))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar - Spectator mode (no Enter Score tab) */}
      <UmbriagioBottomTabBar gameId={gameId!} isSpectator={true} />
    </div>
  );
}
