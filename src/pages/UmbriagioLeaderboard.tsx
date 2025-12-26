import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { ChevronDown } from "lucide-react";
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

interface RotationSchedule {
  type: "every6" | "every9";
  schedule: Array<{
    teamA: [string, string];
    teamB: [string, string];
  }>;
}

export default function UmbriagioLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedTeam, setExpandedTeam] = useState<string | null>('A');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        .single();

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
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getTeamPoints = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return team === 'A' ? hole.team_a_hole_points : hole.team_b_hole_points;
  };

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

  // Determine which team a player was on for a specific hole (considering rotation)
  const getPlayerTeamForHole = (holeNumber: number, playerId: string): 'A' | 'B' | null => {
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
  };

  // Get player's points for a specific hole based on which team they were on
  const getPlayerPointsForHole = (holeNumber: number, playerId: string): number | null => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;

    const playerTeam = getPlayerTeamForHole(holeNumber, playerId);
    if (!playerTeam) return null;

    // Each player gets the full team points (not split)
    const teamPoints = playerTeam === 'A' ? hole.team_a_hole_points : hole.team_b_hole_points;
    return teamPoints;
  };

  // Calculate total stats for a player including points
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

    const toPar = totalScore - totalPar;
    const toParDisplay = totalScore === 0 ? 'E' : toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `${toPar}`;

    return { totalScore, toPar, toParDisplay, holesPlayed, totalPoints };
  };

  // Get sorted players by points for ranking
  const rankedPlayers = useMemo(() => {
    const playersWithStats = allPlayers.map(player => ({
      ...player,
      stats: getPlayerStats(player.id)
    }));
    
    // Sort by points (highest first)
    return playersWithStats.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
  }, [allPlayers, holes]);

  // Get player's position label in leaderboard (with T prefix for ties)
  const getPlayerPositionLabel = (playerId: string): string => {
    const index = rankedPlayers.findIndex(p => p.id === playerId);
    if (index === -1) return "0";
    
    const playerPoints = rankedPlayers[index].stats.totalPoints;
    
    // Count players with higher points to determine position
    const playersAhead = rankedPlayers.filter(p => p.stats.totalPoints > playerPoints).length;
    const position = playersAhead + 1;
    
    // Check if there are ties at this position
    const samePointsCount = rankedPlayers.filter(p => p.stats.totalPoints === playerPoints).length;
    
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
      <div className="min-h-screen flex items-center justify-center pb-16">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const renderPlayerCard = (player: { id: string; name: string }, positionLabel: string) => {
    const isExpanded = expandedPlayer === player.id;
    const stats = getPlayerStats(player.id);
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
                {isLeader ? 'LEADING' : 'POINTS'}
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
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
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
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
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

            {/* Summary */}
            <div className="border-t bg-muted/30 p-4">
              <div className="flex items-center justify-around text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Points</div>
                  <div className="text-2xl font-bold">{stats.totalPoints}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className="text-2xl font-bold">{stats.totalScore || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Position</div>
                  <div className="text-2xl font-bold">{positionLabel}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    );
  };

  const renderTeamCard = (team: 'A' | 'B') => {
    const isExpanded = expandedTeam === team;
    const isLeader = leader === team;
    const totalPoints = team === 'A' ? game.team_a_total_points : game.team_b_total_points;
    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const player1 = team === 'A' ? game.team_a_player_1 : game.team_b_player_1;
    const player2 = team === 'A' ? game.team_a_player_2 : game.team_b_player_2;

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
                {holes.length || "-"}
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
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
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
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
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

            {/* Summary */}
            <div className="border-t bg-muted/30 p-4">
              <div className="flex items-center justify-around text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{totalPoints}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Holes</div>
                  <div className="text-2xl font-bold">{holes.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Position</div>
                  <div className="text-2xl font-bold">
                    {isLeader ? '1st' : '2nd'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Single Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{game.course_name}</h2>
          <p className="text-sm opacity-90">Umbriago {isRotating ? '(Rotating Teams)' : ''}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {isRotating ? (
          // Show individual player scorecards when rotating, sorted by points
          <>
            {rankedPlayers.map((player, index) => renderPlayerCard(player, getPlayerPositionLabel(player.id)))}
          </>
        ) : (
          // Show team scorecards when not rotating
          <>
            {renderTeamCard('A')}
            {renderTeamCard('B')}
            
            {leader === null && game.team_a_total_points === game.team_b_total_points && holes.length > 0 && (
              <div className="text-center text-muted-foreground py-2">
                Teams are tied!
              </div>
            )}
          </>
        )}
      </div>
      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
    </div>
  );
}
