import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { Trophy, Target, Zap } from "lucide-react";
import { formatHandicap } from "@/lib/utils";

export default function CopenhagenInfo() {
  const { gameId } = useParams();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
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

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const sweeps = holes.filter(h => h.is_sweep);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Info</h1>

        {/* Game Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Copenhagen (6-Point)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Course</span>
              <span className="font-medium">{game.course_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holes</span>
              <span className="font-medium">{game.holes_played}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stake</span>
              <span className="font-medium">${game.stake_per_point}/point</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Handicaps</span>
              <span className="font-medium">{game.use_handicaps ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Players */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={18} />
              Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: game.player_1, points: game.player_1_total_points, hcp: game.player_1_handicap, tee: game.player_1_tee, color: "text-emerald-600" },
              { name: game.player_2, points: game.player_2_total_points, hcp: game.player_2_handicap, tee: game.player_2_tee, color: "text-blue-600" },
              { name: game.player_3, points: game.player_3_total_points, hcp: game.player_3_handicap, tee: game.player_3_tee, color: "text-amber-600" },
            ].sort((a, b) => b.points - a.points).map((player, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className={`font-medium ${player.color}`}>{player.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {player.tee && `${player.tee} tees`}
                    {game.use_handicaps && player.hcp !== null && ` • HCP: ${formatHandicap(player.hcp)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{player.points}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sweeps */}
        {sweeps.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target size={18} />
                Sweeps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sweeps.map((hole) => {
                  const winnerName = hole.sweep_winner === 1 ? game.player_1 :
                                    hole.sweep_winner === 2 ? game.player_2 : game.player_3;
                  return (
                    <div key={hole.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span>Hole {hole.hole_number}</span>
                      <Badge variant="secondary">{winnerName}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Presses */}
        {game.presses.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap size={18} />
                Presses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {game.presses.map((press, i) => (
                  <div key={press.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <div>
                      <span className="font-medium">Press #{i + 1}</span>
                      <span className="text-xs text-muted-foreground ml-2">from hole {press.start_hole}</span>
                    </div>
                    <span className="font-medium">
                      {press.player_1_points} - {press.player_2_points} - {press.player_3_points}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
