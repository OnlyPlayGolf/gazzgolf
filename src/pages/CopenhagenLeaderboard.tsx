import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CopenhagenLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          presses: (gameData.presses as unknown as Press[]) || [],
        });
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData.map(h => ({
          ...h,
          press_points: (h.press_points as Record<string, any>) || {},
        })));
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
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

  const players = [
    { index: 1, name: game.player_1, points: game.player_1_total_points, color: "emerald" },
    { index: 2, name: game.player_2, points: game.player_2_total_points, color: "blue" },
    { index: 3, name: game.player_3, points: game.player_3_total_points, color: "amber" },
  ];

  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);
  const leader = sortedPlayers[0].index;

  const frontNine = holes.filter(h => h.hole_number <= 9);
  const backNine = holes.filter(h => h.hole_number > 9);

  const calculateNineTotal = (holesSubset: CopenhagenHole[], playerIndex: number) => {
    return holesSubset.reduce((sum, h) => {
      if (playerIndex === 1) return sum + h.player_1_hole_points;
      if (playerIndex === 2) return sum + h.player_2_hole_points;
      return sum + h.player_3_hole_points;
    }, 0);
  };

  const getPlayerPoints = (hole: CopenhagenHole, playerIndex: number) => {
    if (playerIndex === 1) return hole.player_1_hole_points;
    if (playerIndex === 2) return hole.player_2_hole_points;
    return hole.player_3_hole_points;
  };

  const renderPlayerCard = (player: typeof players[0]) => {
    const isExpanded = expandedPlayer === player.index;
    const isLeader = leader === player.index;
    const colorClass = player.color === 'emerald' ? 'text-emerald-600' : player.color === 'blue' ? 'text-blue-600' : 'text-amber-600';
    const bgClass = player.color === 'emerald' ? 'bg-emerald-500' : player.color === 'blue' ? 'bg-blue-500' : 'bg-amber-500';

    return (
      <Card key={player.index} className="overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-center mb-2">
            <div className="flex-1 text-center">
              <h2 className="text-lg font-bold">
                Game {new Date(game.date_played).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit' 
                }).replace(/\//g, '-')}
              </h2>
              <p className="text-sm opacity-90">{game.course_name}</p>
            </div>
          </div>

          <div className="bg-primary-foreground/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold">Copenhagen</div>
          </div>
        </div>

        {/* Player Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedPlayer(isExpanded ? null : player.index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`w-4 h-4 rounded-full ${bgClass}`} />
              <div>
                <div className={`text-xl font-bold ${colorClass}`}>{player.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${colorClass}`}>
                {player.points}
              </div>
              <div className="text-sm text-muted-foreground">
                {isLeader ? 'LEADING' : 'POINTS'}
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && holes.length > 0 && (
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
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                    {frontNine.map(hole => {
                      const points = getPlayerPoints(hole, player.index);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${points >= 4 ? 'text-green-600' : points === 0 ? 'text-red-600' : ''}`}
                        >
                          {points}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {calculateNineTotal(frontNine, player.index)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 - Only show if 18 holes */}
            {game.holes_played === 18 && backNine.length > 0 && (
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
                      <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                      {backNine.map(hole => {
                        const points = getPlayerPoints(hole, player.index);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className={`text-center font-bold text-xs px-1 py-1.5 ${points >= 4 ? 'text-green-600' : points === 0 ? 'text-red-600' : ''}`}
                          >
                            {points}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                        {calculateNineTotal(backNine, player.index)}
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
                  <div className="text-2xl font-bold">{player.points}</div>
                  <div className="text-xs text-muted-foreground">Total Points</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{holes.length}</div>
                  <div className="text-xs text-muted-foreground">Holes Played</div>
                </div>
                <div>
                  <div className={`text-2xl font-bold ${isLeader ? 'text-green-600' : ''}`}>
                    {sortedPlayers.findIndex(p => p.index === player.index) + 1}{sortedPlayers.findIndex(p => p.index === player.index) === 0 ? 'st' : sortedPlayers.findIndex(p => p.index === player.index) === 1 ? 'nd' : 'rd'}
                  </div>
                  <div className="text-xs text-muted-foreground">Position</div>
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
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {players.map(player => renderPlayerCard(player))}
        
        {/* Press Results */}
        {game.presses.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Press Results</h3>
            <div className="space-y-3">
              {game.presses.map((press, i) => {
                const pressPlayers = [
                  { name: game.player_1, points: press.player_1_points, color: "text-emerald-600" },
                  { name: game.player_2, points: press.player_2_points, color: "text-blue-600" },
                  { name: game.player_3, points: press.player_3_points, color: "text-amber-600" },
                ].sort((a, b) => b.points - a.points);

                return (
                  <div key={press.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="text-sm font-medium mb-2">
                      Press #{i + 1} (from hole {press.start_hole})
                    </div>
                    <div className="flex justify-between">
                      {pressPlayers.map((p, j) => (
                        <div key={j} className="text-center">
                          <div className={`text-xs font-medium ${p.color}`}>{p.name}</div>
                          <div className="font-bold">{p.points}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
