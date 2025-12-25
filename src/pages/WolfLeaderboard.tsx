import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { WolfGame, WolfHole } from "@/types/wolf";
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

export default function WolfLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<WolfGame | null>(null);
  const [holes, setHoles] = useState<WolfHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) fetchGameData();
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("wolf_games" as any)
        .select("*")
        .eq("id", gameId)
        .single();
      
      if (gameData) {
        const typedGameData = gameData as unknown as WolfGame;
        setGame(typedGameData);

        // Fetch course holes for scorecard structure
        if (typedGameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", typedGameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = typedGameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("wolf_holes" as any)
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as unknown as WolfHole[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getPlayerCount = () => {
    if (!game) return 3;
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };

  const getPlayerName = (playerNum: number) => {
    if (!game) return '';
    switch (playerNum) {
      case 1: return game.player_1;
      case 2: return game.player_2;
      case 3: return game.player_3;
      case 4: return game.player_4 || '';
      case 5: return game.player_5 || '';
      default: return '';
    }
  };

  const getPlayerPoints = (playerNum: number) => {
    if (!game) return 0;
    switch (playerNum) {
      case 1: return game.player_1_points;
      case 2: return game.player_2_points;
      case 3: return game.player_3_points;
      case 4: return game.player_4_points;
      case 5: return game.player_5_points;
      default: return 0;
    }
  };

  // Create a map for quick hole data lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const getHolePoints = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_hole_points;
      case 2: return hole.player_2_hole_points;
      case 3: return hole.player_3_hole_points;
      case 4: return hole.player_4_hole_points;
      case 5: return hole.player_5_hole_points;
      default: return 0;
    }
  };

  const getHoleScore = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_score;
      case 2: return hole.player_2_score;
      case 3: return hole.player_3_score;
      case 4: return hole.player_4_score;
      case 5: return hole.player_5_score;
      default: return null;
    }
  };

  const playerCount = getPlayerCount();
  
  const players = game ? Array.from({ length: playerCount }, (_, i) => ({
    num: i + 1,
    name: getPlayerName(i + 1),
    points: getPlayerPoints(i + 1),
  })).sort((a, b) => b.points - a.points) : [];

  // Calculate positions with tie handling
  const getPlayerPosition = (playerIndex: number): string => {
    const player = players[playerIndex];
    const playersWithSamePoints = players.filter(p => p.points === player.points);
    const isTied = playersWithSamePoints.length > 1;
    const position = players.findIndex(p => p.points === player.points) + 1;
    return isTied ? `T${position}` : `${position}`;
  };

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

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

  const renderPlayerCard = (player: { num: number; name: string; points: number }, rank: number) => {
    const isExpanded = expandedPlayerId === player.num;
    const isLeader = rank === 0;
    const position = getPlayerPosition(rank);

    return (
      <Card key={player.num} className="overflow-hidden">
        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayerId(isExpanded ? null : player.num)}
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
                {position}
              </div>
              <div>
                <div className="text-xl font-bold">{player.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {player.points}
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
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                    {frontNine.map(hole => {
                      const rawScore = getHoleScore(hole.hole_number, player.num);
                      const score = rawScore === -1 ? null : rawScore;
                      const par = hole.par;
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center text-xs px-1 py-1.5 ${
                            score !== null && score < par ? 'text-red-600 font-bold' : 
                            score !== null && score > par ? 'text-sky-600' : ''
                          }`}
                        >
                          {rawScore === -1 ? '-' : (score ?? '')}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {(() => {
                        const total = frontNine.reduce((sum, h) => {
                          const s = getHoleScore(h.hole_number, player.num);
                          if (s === null || s === -1) return sum;
                          return sum + s;
                        }, 0);

                        const hasAnyEntered = frontNine.some(h => {
                          const s = getHoleScore(h.hole_number, player.num);
                          return s !== null && s !== undefined;
                        });

                        if (!hasAnyEntered) return '';
                        return total > 0 ? total : '-';
                      })()}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getHolePoints(hole.hole_number, player.num);
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
                      {frontNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0) || ''}
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
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Score</TableCell>
                      {backNine.map(hole => {
                        const rawScore = getHoleScore(hole.hole_number, player.num);
                        const score = rawScore === -1 ? null : rawScore;
                        const par = hole.par;
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center text-xs px-1 py-1.5 ${
                              score !== null && score < par ? 'text-red-600 font-bold' : 
                              score !== null && score > par ? 'text-sky-600' : ''
                            }`}
                          >
                            {rawScore === -1 ? '-' : (score ?? '')}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {(() => {
                          const total = backNine.reduce((sum, h) => {
                            const s = getHoleScore(h.hole_number, player.num);
                            if (s === null || s === -1) return sum;
                            return sum + s;
                          }, 0);

                          const hasAnyEntered = backNine.some(h => {
                            const s = getHoleScore(h.hole_number, player.num);
                            return s !== null && s !== undefined;
                          });

                          if (!hasAnyEntered) return '';
                          return total > 0 ? total : '-';
                        })()}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getHolePoints(hole.hole_number, player.num);
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
                        {backNine.reduce((sum, h) => sum + (getHolePoints(h.hole_number, player.num) || 0), 0) || ''}
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

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Single Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">{game.round_name || game.course_name}</h2>
          {game.round_name && <p className="text-sm opacity-90">{game.course_name}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {players.map((player, index) => renderPlayerCard(player, index))}
      </div>

      <WolfBottomTabBar gameId={gameId!} />
    </div>
  );
}
