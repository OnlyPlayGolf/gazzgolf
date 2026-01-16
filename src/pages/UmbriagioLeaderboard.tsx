import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { ChevronDown } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useToast } from "@/hooks/use-toast";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { LeaderboardModeTabs, LeaderboardMode } from "@/components/LeaderboardModeTabs";
import { StrokePlayLeaderboardView, StrokePlayPlayer } from "@/components/StrokePlayLeaderboardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UmbriagioSharedScorecard } from "@/components/UmbriagioSharedScorecard";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface RotationSchedule {
  type: "every6" | "every9";
  schedule: Array<{
    teamA: [string, string];
    teamB: [string, string];
  }>;
}

export default function UmbriagioLeaderboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedTeam, setExpandedTeam] = useState<string | null>('A');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('primary');
  
  // Check spectator status - for sorting leaderboard by position
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('umbriago', gameId);
  const { strokePlayEnabled } = useStrokePlayEnabled(gameId, 'umbriago');
  const { isAdmin } = useGameAdminStatus('umbriago', gameId);

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

  const isRotating = rotationSchedule && rotationSchedule.schedule.length > 1;

  useEffect(() => {
    if (gameId) {
      fetchGameData();
    }
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();

      if (gameData) {
        setGame({
          ...gameData,
          payout_mode: gameData.payout_mode as 'difference' | 'total',
          roll_history: (gameData.roll_history as unknown as RollEvent[]) || [],
          winning_team: gameData.winning_team as 'A' | 'B' | 'TIE' | null,
        });

        // Fetch course holes for scorecard structure
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
      }

      const { data: holesData } = await supabase
        .from("umbriago_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as UmbriagioHole[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getLeader = () => {
    if (!game) return null;
    if (game.team_a_total_points > game.team_b_total_points) return 'A';
    if (game.team_b_total_points > game.team_a_total_points) return 'B';
    return null;
  };

  const leader = getLeader();

  // Create a map for quick hole data lookup
  const holesMap = useMemo(() => new Map(holes.map(h => [h.hole_number, h])), [holes]);

  const frontNine = useMemo(() => courseHoles.filter(h => h.hole_number <= 9), [courseHoles]);
  const backNine = useMemo(() => courseHoles.filter(h => h.hole_number > 9), [courseHoles]);

  const getTeamPoints = useCallback((holeNumber: number, team: 'A' | 'B') => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return team === 'A' ? hole.team_a_hole_points : hole.team_b_hole_points;
  }, [holesMap]);

  // Get all unique players from the game
  const allPlayers = useMemo(() => {
    if (!game) return [];
    return [
      { id: 'team_a_player_1', name: game.team_a_player_1 },
      { id: 'team_a_player_2', name: game.team_a_player_2 },
      { id: 'team_b_player_1', name: game.team_b_player_1 },
      { id: 'team_b_player_2', name: game.team_b_player_2 },
    ];
  }, [game]);

  // Get player's score for a specific hole
  const getPlayerScore = useCallback((holeNumber: number, playerId: string): number | null => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    
    switch (playerId) {
      case 'team_a_player_1': return hole.team_a_player_1_score;
      case 'team_a_player_2': return hole.team_a_player_2_score;
      case 'team_b_player_1': return hole.team_b_player_1_score;
      case 'team_b_player_2': return hole.team_b_player_2_score;
      default: return null;
    }
  }, [holesMap]);

  // Determine which team a player was on for a specific hole (considering rotation)
  const getPlayerTeamForHole = useCallback((holeNumber: number, playerId: string): 'A' | 'B' | null => {
    if (!game || !rotationSchedule || rotationSchedule.schedule.length <= 1) {
      // No rotation - use original team assignment
      if (playerId === 'team_a_player_1' || playerId === 'team_a_player_2') return 'A';
      if (playerId === 'team_b_player_1' || playerId === 'team_b_player_2') return 'B';
      return null;
    }

    // Get player name
    let playerName = '';
    switch (playerId) {
      case 'team_a_player_1': playerName = game.team_a_player_1; break;
      case 'team_a_player_2': playerName = game.team_a_player_2; break;
      case 'team_b_player_1': playerName = game.team_b_player_1; break;
      case 'team_b_player_2': playerName = game.team_b_player_2; break;
    }

    // Determine segment for this hole
    const holesPerSegment = rotationSchedule.type === "every9" ? 9 : 6;
    const segmentIndex = Math.min(
      Math.floor((holeNumber - 1) / holesPerSegment),
      rotationSchedule.schedule.length - 1
    );

    const segment = rotationSchedule.schedule[segmentIndex];
    if (!segment) return null;

    if (segment.teamA.includes(playerName)) return 'A';
    if (segment.teamB.includes(playerName)) return 'B';
    return null;
  }, [game, rotationSchedule]);

  // Get player's points for a specific hole based on which team they were on
  const getPlayerPointsForHole = useCallback((holeNumber: number, playerId: string): number | null => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;

    const playerTeam = getPlayerTeamForHole(holeNumber, playerId);
    if (!playerTeam) return null;

    // Each player gets the full team points (not split)
    const teamPoints = playerTeam === 'A' ? hole.team_a_hole_points : hole.team_b_hole_points;
    return teamPoints;
  }, [holesMap, getPlayerTeamForHole]);

  // Get players with stats for ranking (always sorted for position calculation)
  const playersWithStats = useMemo(() => {
    // Calculate stats inline to avoid function reference issues
    return allPlayers.map(player => {
      let totalScore = 0;
      let totalPar = 0;
      let holesPlayed = 0;
      let totalPoints = 0;

      holes.forEach(hole => {
        const score = getPlayerScore(hole.hole_number, player.id);
        if (score && score > 0) {
          totalScore += score;
          totalPar += hole.par;
          holesPlayed++;
        }
        
        const points = getPlayerPointsForHole(hole.hole_number, player.id);
        if (points !== null) {
          totalPoints += points;
        }
      });

      const toPar = totalScore - totalPar;
      const toParDisplay = totalScore === 0 ? 'E' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`;

      return {
        ...player,
        stats: { totalScore, toPar, toParDisplay, holesPlayed, totalPoints }
      };
    });
  }, [allPlayers, holes, getPlayerScore, getPlayerPointsForHole]);

  // Sorted players for position calculation
  const sortedPlayersForRanking = useMemo(() => {
    return [...playersWithStats].sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
  }, [playersWithStats]);

  // Display order: sorted in spectator mode, original order otherwise
  const rankedPlayers = useMemo(() => {
    if (isSpectator) {
      return sortedPlayersForRanking;
    }
    return playersWithStats;
  }, [isSpectator, playersWithStats, sortedPlayersForRanking]);

  // Build stroke play players from umbriago data
  const strokePlayPlayers: StrokePlayPlayer[] = useMemo(() => {
    if (!game) return [];
    return allPlayers.map((player) => {
      const scoresMap = new Map<number, number>();
      holes.forEach((hole) => {
        const score = getPlayerScore(hole.hole_number, player.id);
        if (score !== null && score > 0) {
          scoresMap.set(hole.hole_number, score);
        }
      });
      return {
        id: player.id,
        name: player.name,
        scores: scoresMap,
      };
    });
  }, [game, allPlayers, holes, getPlayerScore]);

  // Get player's position label in leaderboard (with T prefix for ties)
  // Always use sortedPlayersForRanking to calculate correct position
  const getPlayerPositionLabel = (playerId: string): string => {
    const player = playersWithStats.find(p => p.id === playerId);
    if (!player) return "0";
    
    const playerPoints = player.stats.totalPoints;
    
    // Count players with higher points to determine position
    const playersAhead = sortedPlayersForRanking.filter(p => p.stats.totalPoints > playerPoints).length;
    const position = playersAhead + 1;
    
    // Check if there are ties at this position
    const samePointsCount = sortedPlayersForRanking.filter(p => p.stats.totalPoints === playerPoints).length;
    
    if (samePointsCount > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Loading scorecard...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <GameNotFound 
        onRetry={() => fetchGameData()}
        message="This game was deleted or is no longer available."
      />
    );
  }

  const renderPlayerCard = (player: { id: string; name: string; stats: { totalScore: number; toPar: number; toParDisplay: string; holesPlayed: number; totalPoints: number } }, positionLabel: string) => {
    const isExpanded = expandedPlayer === player.id;
    const stats = player.stats;
    const isLeader = positionLabel === '1';

    return (
      <Card key={player.id} className="overflow-hidden">
        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
        >
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
              <div className="text-3xl font-bold">
                {stats.totalPoints}
              </div>
              <div className="text-sm text-muted-foreground">
                POINTS
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary text-primary-foreground z-10">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary text-primary-foreground w-[36px]">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                    {frontNine.map(hole => {
                      const score = getPlayerScore(hole.hole_number, player.id);
                      const scoreDiff = score && score > 0 ? score - hole.par : null;
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${
                            scoreDiff !== null && scoreDiff < 0 ? 'text-green-600' : 
                            scoreDiff !== null && scoreDiff > 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {score && score > 0 ? score : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => {
                        const score = getPlayerScore(h.hole_number, player.id);
                        return sum + (score && score > 0 ? score : 0);
                      }, 0) || ''}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getPlayerPointsForHole(hole.hole_number, player.id);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${
                            points !== null && points > 0 ? 'text-green-600' : 
                            points !== null && points < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? (points > 0 ? `+${points}` : points === 0 ? '0' : points) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => {
                        const points = getPlayerPointsForHole(h.hole_number, player.id);
                        return sum + (points || 0);
                      }, 0) || ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {backNine.length > 0 && (
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary text-primary-foreground z-10">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary text-primary-foreground w-[36px]">In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                      {backNine.map(hole => {
                        const score = getPlayerScore(hole.hole_number, player.id);
                        const scoreDiff = score && score > 0 ? score - hole.par : null;
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${
                              scoreDiff !== null && scoreDiff < 0 ? 'text-green-600' : 
                              scoreDiff !== null && scoreDiff > 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {score && score > 0 ? score : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => {
                          const score = getPlayerScore(h.hole_number, player.id);
                          return sum + (score && score > 0 ? score : 0);
                        }, 0) || ''}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getPlayerPointsForHole(hole.hole_number, player.id);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${
                              points !== null && points > 0 ? 'text-green-600' : 
                              points !== null && points < 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {points !== null ? (points > 0 ? `+${points}` : points === 0 ? '0' : points) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => {
                          const points = getPlayerPointsForHole(h.hole_number, player.id);
                          return sum + (points || 0);
                        }, 0) || ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

          </>
        )}
        
        {/* Per-scorecard actions */}
        <div className="px-4 pb-3">
          <ScorecardActions
            gameId={gameId!}
            gameType="umbriago"
            scorecardPlayerId={player.id}
            scorecardPlayerName={player.name}
          />
        </div>
      </Card>
    );
  };

  const renderTeamCard = (team: 'A' | 'B') => {
    const isExpanded = expandedTeam === team;
    const isLeader = leader === team;
    const rawPoints = team === 'A' ? game.team_a_total_points : game.team_b_total_points;
    const otherRawPoints = team === 'A' ? game.team_b_total_points : game.team_a_total_points;
    const { normalizedA, normalizedB } = normalizeUmbriagioPoints(game.team_a_total_points, game.team_b_total_points);
    const totalPoints = team === 'A' ? normalizedA : normalizedB;
    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const player1 = team === 'A' ? game.team_a_player_1 : game.team_b_player_1;
    const player2 = team === 'A' ? game.team_a_player_2 : game.team_b_player_2;

    // Determine position with tie handling (use raw points for position comparison)
    const getTeamPositionLabel = (): string => {
      if (rawPoints > otherRawPoints) return '1';
      if (rawPoints < otherRawPoints) return '2';
      return 'T1'; // Tied
    };

    const positionLabel = getTeamPositionLabel();

    return (
      <Card key={team} className="overflow-hidden">
        {/* Team Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedTeam(isExpanded ? null : team)}
        >
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
                POINTS
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary text-primary-foreground z-10">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary text-primary-foreground w-[36px]">Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">HCP</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                        {hole.stroke_index}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted text-xs px-1 py-1.5"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getTeamPoints(hole.hole_number, team);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${
                            points !== null && points > 0 ? 'text-green-600' : 
                            points !== null && points < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {frontNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, team) || 0), 0) || ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {backNine.length > 0 && (
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary text-primary-foreground z-10">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary text-primary-foreground w-[36px]">In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">HCP</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center text-xs px-1 py-1.5">
                          {hole.stroke_index}
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-muted text-xs px-1 py-1.5"></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getTeamPoints(hole.hole_number, team);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${
                              points !== null && points > 0 ? 'text-green-600' : 
                              points !== null && points < 0 ? 'text-red-600' : ''
                            }`}
                          >
                            {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {backNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, team) || 0), 0) || ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

          </>
        )}
        
        {/* Per-scorecard actions */}
        <div className="px-4 pb-3">
          <ScorecardActions
            gameId={gameId!}
            gameType="umbriago"
            scorecardPlayerId={`team_${team}`}
            scorecardPlayerName={teamName}
          />
        </div>
      </Card>
    );
  };


  const handleFinishGame = async () => {
    try {
      const winningTeam = game.team_a_total_points > game.team_b_total_points ? 'A' : 
                          game.team_b_total_points > game.team_a_total_points ? 'B' : 'TIE';
      await supabase.from("umbriago_games").update({ is_finished: true, winning_team: winningTeam }).eq("id", gameId);
      toast({ title: "Game finished!" });
      navigate(`/umbriago/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("umbriago_holes").delete().eq("game_id", gameId);
      await supabase.from("umbriago_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || "Umbriago"}
        courseName={game.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Umbriago Game"
      />

      <LeaderboardModeTabs
        primaryLabel="Umbriago"
        activeMode={leaderboardMode}
        onModeChange={setLeaderboardMode}
        strokePlayEnabled={strokePlayEnabled}
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {leaderboardMode === 'stroke_play' ? (
          <StrokePlayLeaderboardView
            players={strokePlayPlayers}
            courseHoles={courseHoles}
            isSpectator={isSpectator}
            gameId={gameId}
            gameType="umbriago"
          />
        ) : isRotating ? (
          // Show individual player scorecards when rotating, sorted by points
          <>
            {rankedPlayers.map((player, index) => renderPlayerCard(player, getPlayerPositionLabel(player.id)))}
          </>
        ) : (
          // Show shared team scorecard when not rotating
          <>
            {/* Team Standings */}
            <div className="space-y-2">
              {(() => {
                const teamsData = (['A', 'B'] as const).map(team => {
                  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(game.team_a_total_points, game.team_b_total_points);
                  const totalPoints = team === 'A' ? normalizedA : normalizedB;
                  const rawPoints = team === 'A' ? game.team_a_total_points : game.team_b_total_points;
                  const otherRawPoints = team === 'A' ? game.team_b_total_points : game.team_a_total_points;
                  const positionLabel = rawPoints > otherRawPoints ? '1' : rawPoints < otherRawPoints ? '2' : 'T1';
                  return { team, totalPoints, rawPoints, positionLabel };
                });

                // Sort only in spectator mode
                const orderedTeams = isSpectator 
                  ? [...teamsData].sort((a, b) => b.rawPoints - a.rawPoints)
                  : teamsData;

                return orderedTeams.map(({ team, totalPoints, positionLabel }) => {
                  const isLeader = leader === team;
                  const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
                  const player1 = team === 'A' ? game.team_a_player_1 : game.team_b_player_1;
                  const player2 = team === 'A' ? game.team_a_player_2 : game.team_b_player_2;

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
                          POINTS
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              });
              })()}
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
          </>
        )}
      </div>
      {gameId && !isSpectatorLoading && <UmbriagioBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
