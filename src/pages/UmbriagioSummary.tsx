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

  // Leaderboard helper functions
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getLeader = () => {
    if (!game) return null;
    if (game.team_a_total_points > game.team_b_total_points) return 'A';
    if (game.team_b_total_points > game.team_a_total_points) return 'B';
    return null;
  };

  const leader = getLeader();

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
      if (playerId === 'team_a_player_1' || playerId === 'team_a_player_2') return 'A';
      if (playerId === 'team_b_player_1' || playerId === 'team_b_player_2') return 'B';
      return null;
    }

    let playerName = '';
    switch (playerId) {
      case 'team_a_player_1': playerName = game.team_a_player_1; break;
      case 'team_a_player_2': playerName = game.team_a_player_2; break;
      case 'team_b_player_1': playerName = game.team_b_player_1; break;
      case 'team_b_player_2': playerName = game.team_b_player_2; break;
    }

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
    
    return playersWithStats.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
  }, [allPlayers, holes]);

  // Get player's position label in leaderboard
  const getPlayerPositionLabel = (playerId: string): string => {
    const index = rankedPlayers.findIndex(p => p.id === playerId);
    if (index === -1) return "0";
    
    const playerPoints = rankedPlayers[index].stats.totalPoints;
    const playersAhead = rankedPlayers.filter(p => p.stats.totalPoints > playerPoints).length;
    const position = playersAhead + 1;
    const samePointsCount = rankedPlayers.filter(p => p.stats.totalPoints === playerPoints).length;
    
    if (samePointsCount > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  const renderPlayerCard = (player: { id: string; name: string }, positionLabel: string) => {
    const isExpanded = expandedPlayer === player.id;
    const stats = getPlayerStats(player.id);
    const isLeader = positionLabel === '1';

    return (
      <Card key={player.id} className="overflow-hidden">
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
          </>
        )}
      </Card>
    );
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

  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(game.team_a_total_points, game.team_b_total_points);

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
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

      {/* Spectator Mode Background - Leaderboard View */}
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        {/* Team Leaders */}
        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${
              leader === 'A' ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''
            } ${expandedTeam === 'A' ? 'col-span-2' : ''}`}
            onClick={() => setExpandedTeam(expandedTeam === 'A' ? null : 'A')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{game.team_a_name}</div>
                <div className="text-xs text-muted-foreground">
                  {game.team_a_player_1} & {game.team_a_player_2}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${leader === 'A' ? 'text-blue-600' : ''}`}>
                  {normalizedA}
                </div>
                {leader === 'A' && (
                  <div className="text-xs text-blue-600 font-semibold">LEADING</div>
                )}
              </div>
            </div>
          </Card>

          {/* Team B */}
          <Card 
            className={`p-4 cursor-pointer transition-all ${
              leader === 'B' ? 'ring-2 ring-red-500 bg-red-50/50 dark:bg-red-950/20' : ''
            } ${expandedTeam === 'B' ? 'col-span-2' : ''}`}
            onClick={() => setExpandedTeam(expandedTeam === 'B' ? null : 'B')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{game.team_b_name}</div>
                <div className="text-xs text-muted-foreground">
                  {game.team_b_player_1} & {game.team_b_player_2}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${leader === 'B' ? 'text-red-600' : ''}`}>
                  {normalizedB}
                </div>
                {leader === 'B' && (
                  <div className="text-xs text-red-600 font-semibold">LEADING</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Individual Player Leaderboard */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Individual Leaderboard</h2>
          {rankedPlayers.map((player) => {
            const positionLabel = getPlayerPositionLabel(player.id);
            return renderPlayerCard(player, positionLabel);
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
