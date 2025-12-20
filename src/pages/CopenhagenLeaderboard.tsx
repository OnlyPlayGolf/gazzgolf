import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { ChevronDown, Trophy, Zap, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ViewMode = "points" | "scores";

interface PlayerData {
  index: number;
  name: string;
  points: number;
  position: string;
  isTied: boolean;
}

export default function CopenhagenLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("points");

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
        <div className="text-muted-foreground">Loading leaderboard...</div>
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

  // Calculate positions with proper tie handling
  const players = [
    { index: 1, name: game.player_1, points: game.player_1_total_points },
    { index: 2, name: game.player_2, points: game.player_2_total_points },
    { index: 3, name: game.player_3, points: game.player_3_total_points },
  ];

  const sortedByPoints = [...players].sort((a, b) => b.points - a.points);
  
  // Calculate positions with tie handling
  const getPositionData = (): PlayerData[] => {
    const result: PlayerData[] = [];
    let currentPosition = 1;
    
    for (let i = 0; i < sortedByPoints.length; i++) {
      const player = sortedByPoints[i];
      const prevPlayer = i > 0 ? sortedByPoints[i - 1] : null;
      const nextPlayer = i < sortedByPoints.length - 1 ? sortedByPoints[i + 1] : null;
      
      // Check if tied with previous or next
      const tiedWithPrev = prevPlayer && prevPlayer.points === player.points;
      const tiedWithNext = nextPlayer && nextPlayer.points === player.points;
      const isTied = tiedWithPrev || tiedWithNext;
      
      if (tiedWithPrev) {
        // Same position as previous
        result.push({
          ...player,
          position: `T${currentPosition}`,
          isTied: true,
        });
      } else {
        currentPosition = i + 1;
        result.push({
          ...player,
          position: isTied ? `T${currentPosition}` : getOrdinal(currentPosition),
          isTied,
        });
      }
    }
    
    return result;
  };

  const rankedPlayers = getPositionData();
  const holesPlayed = holes.length;

  const getPlayerPoints = (hole: CopenhagenHole, playerIndex: number) => {
    if (playerIndex === 1) return hole.player_1_hole_points;
    if (playerIndex === 2) return hole.player_2_hole_points;
    return hole.player_3_hole_points;
  };

  const getPlayerGrossScore = (hole: CopenhagenHole, playerIndex: number) => {
    if (playerIndex === 1) return hole.player_1_gross_score;
    if (playerIndex === 2) return hole.player_2_gross_score;
    return hole.player_3_gross_score;
  };

  const calculateTotalGross = (playerIndex: number) => {
    return holes.reduce((sum, h) => {
      const score = getPlayerGrossScore(h, playerIndex);
      return sum + (score || 0);
    }, 0);
  };

  const calculateTotalPar = () => {
    return holes.reduce((sum, h) => sum + h.par, 0);
  };

  const getPointsLabel = (points: number, hole: CopenhagenHole) => {
    if (points === 6) return { label: "Sweep", color: "bg-emerald-500 text-white" };
    if (points === 4) return { label: "Win", color: "bg-blue-500 text-white" };
    if (points === 3) return { label: "Split", color: "bg-amber-500 text-white" };
    if (points === 2) return { label: "Tie", color: "bg-muted text-muted-foreground" };
    if (points === 1) return { label: "3rd", color: "bg-muted text-muted-foreground" };
    return { label: "-", color: "bg-destructive/20 text-destructive" };
  };

  const getPlayerColor = (playerIndex: number) => {
    if (playerIndex === 1) return { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-100 dark:bg-emerald-900/30" };
    if (playerIndex === 2) return { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-100 dark:bg-blue-900/30" };
    return { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-100 dark:bg-amber-900/30" };
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold">{game.course_name}</h1>
              <p className="text-sm opacity-80">
                {new Date(game.date_played).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">Copenhagen</div>
              <div className="text-sm opacity-80">
                {game.is_finished ? "Final" : `Thru ${holesPlayed}`}
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full">
            <TabsList className="w-full bg-primary-foreground/10">
              <TabsTrigger value="points" className="flex-1 data-[state=active]:bg-primary-foreground/20">
                <Trophy size={14} className="mr-1.5" />
                Points
              </TabsTrigger>
              <TabsTrigger value="scores" className="flex-1 data-[state=active]:bg-primary-foreground/20">
                <Users size={14} className="mr-1.5" />
                Scores
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-3">
        {/* Main Leaderboard */}
        {rankedPlayers.map((player, idx) => {
          const isExpanded = expandedPlayer === player.index;
          const colors = getPlayerColor(player.index);
          const isLeader = idx === 0 && !player.isTied;
          const isTiedLeader = idx === 0 && player.isTied;

          return (
            <Card 
              key={player.index} 
              className={cn(
                "overflow-hidden transition-all",
                isExpanded && "ring-2 ring-primary"
              )}
            >
              {/* Player Row - Always Visible */}
              <div 
                className={cn(
                  "p-4 cursor-pointer transition-colors",
                  isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
                )}
                onClick={() => setExpandedPlayer(isExpanded ? null : player.index)}
              >
                <div className="flex items-center gap-3">
                  {/* Position Badge */}
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                    idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {player.position}
                  </div>

                  {/* Player Color Dot */}
                  <div className={cn("w-3 h-3 rounded-full", colors.bg)} />

                  {/* Player Name & Status */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{player.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {viewMode === "points" ? (
                        `${player.points} pts – thru ${holesPlayed}`
                      ) : (
                        `${calculateTotalGross(player.index)} (${calculateTotalGross(player.index) - calculateTotalPar() >= 0 ? '+' : ''}${calculateTotalGross(player.index) - calculateTotalPar()})`
                      )}
                    </div>
                  </div>

                  {/* Points Display */}
                  <div className="text-right flex items-center gap-2">
                    {(isLeader || isTiedLeader) && (
                      <Trophy size={18} className="text-amber-500" />
                    )}
                    <div>
                      <div className={cn("text-2xl font-bold", colors.text)}>
                        {player.points}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        Points
                      </div>
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={cn(
                        "text-muted-foreground transition-transform ml-1",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Hole-by-Hole View */}
              {isExpanded && holes.length > 0 && (
                <div className="border-t">
                  {/* Hole Grid */}
                  <div className="p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Hole-by-Hole Points
                    </div>
                    
                    {/* Front 9 */}
                    <div className="grid grid-cols-9 gap-1">
                      {holes.filter(h => h.hole_number <= 9).map((hole) => {
                        const points = getPlayerPoints(hole, player.index);
                        const { label, color } = getPointsLabel(points, hole);
                        
                        return (
                          <div key={hole.hole_number} className="text-center">
                            <div className="text-[10px] text-muted-foreground mb-0.5">
                              {hole.hole_number}
                            </div>
                            <div 
                              className={cn(
                                "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold",
                                color
                              )}
                              title={label}
                            >
                              {points}
                            </div>
                            {points === 6 && (
                              <Zap size={10} className="mx-auto mt-0.5 text-amber-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Front 9 Total */}
                    <div className="flex justify-between items-center px-1 py-1 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground">Front 9</span>
                      <span className="font-bold">
                        {holes.filter(h => h.hole_number <= 9).reduce((sum, h) => sum + getPlayerPoints(h, player.index), 0)} pts
                      </span>
                    </div>

                    {/* Back 9 */}
                    {game.holes_played === 18 && holes.filter(h => h.hole_number > 9).length > 0 && (
                      <>
                        <div className="grid grid-cols-9 gap-1 mt-3">
                          {holes.filter(h => h.hole_number > 9).map((hole) => {
                            const points = getPlayerPoints(hole, player.index);
                            const { label, color } = getPointsLabel(points, hole);
                            
                            return (
                              <div key={hole.hole_number} className="text-center">
                                <div className="text-[10px] text-muted-foreground mb-0.5">
                                  {hole.hole_number}
                                </div>
                                <div 
                                  className={cn(
                                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold",
                                    color
                                  )}
                                  title={label}
                                >
                                  {points}
                                </div>
                                {points === 6 && (
                                  <Zap size={10} className="mx-auto mt-0.5 text-amber-500" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Back 9 Total */}
                        <div className="flex justify-between items-center px-1 py-1 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Back 9</span>
                          <span className="font-bold">
                            {holes.filter(h => h.hole_number > 9).reduce((sum, h) => sum + getPlayerPoints(h, player.index), 0)} pts
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Points Legend */}
                  <div className="px-3 pb-3">
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-emerald-500"></div>
                        <span className="text-muted-foreground">Sweep (6)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                        <span className="text-muted-foreground">Win (4)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-amber-500"></div>
                        <span className="text-muted-foreground">Split (3)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-muted"></div>
                        <span className="text-muted-foreground">Tie (2/1)</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="border-t bg-muted/30 p-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className={cn("text-xl font-bold", colors.text)}>{player.points}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Total</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold">
                          {holes.filter(h => getPlayerPoints(h, player.index) === 6).length}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Sweeps</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold">
                          {holes.filter(h => getPlayerPoints(h, player.index) >= 4).length}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Wins</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold">
                          {holes.filter(h => getPlayerPoints(h, player.index) === 0).length}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">Blanks</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {/* Press Results */}
        {game.presses.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-3 bg-muted/50 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Press Results
              </h3>
            </div>
            <div className="p-3 space-y-3">
              {game.presses.map((press, i) => {
                const pressPlayers = [
                  { name: game.player_1, points: press.player_1_points, index: 1 },
                  { name: game.player_2, points: press.player_2_points, index: 2 },
                  { name: game.player_3, points: press.player_3_points, index: 3 },
                ].sort((a, b) => b.points - a.points);

                return (
                  <div key={press.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Press #{i + 1} • Started Hole {press.start_hole}
                    </div>
                    <div className="flex justify-around">
                      {pressPlayers.map((p, j) => {
                        const colors = getPlayerColor(p.index);
                        return (
                          <div key={j} className="text-center">
                            <div className={cn("w-2 h-2 rounded-full mx-auto mb-1", colors.bg)} />
                            <div className="text-xs font-medium truncate max-w-[60px]">{p.name}</div>
                            <div className={cn("font-bold", colors.text)}>{p.points}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Game Info Footer */}
        <div className="text-center text-xs text-muted-foreground py-2">
          {game.use_handicaps ? "Net scoring enabled" : "Gross scoring"} • {game.holes_played} holes
        </div>
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
