import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { Trophy } from "lucide-react";

export default function CopenhagenFeed() {
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
        setGame(gameData as CopenhagenGame);
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number", { ascending: false });

      if (holesData) {
        setHoles(holesData as CopenhagenHole[]);
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

  const getPlayerName = (index: number) => {
    if (index === 1) return game.player_1;
    if (index === 2) return game.player_2;
    return game.player_3;
  };

  const getPlayerColor = (index: number) => {
    if (index === 1) return "text-emerald-600";
    if (index === 2) return "text-blue-600";
    return "text-amber-600";
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Feed</h1>

        {holes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No holes played yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {holes.map((hole) => {
              const winner = [
                { index: 1, points: hole.player_1_hole_points },
                { index: 2, points: hole.player_2_hole_points },
                { index: 3, points: hole.player_3_hole_points },
              ].sort((a, b) => b.points - a.points)[0];

              return (
                <Card key={hole.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">Hole {hole.hole_number}</span>
                      <span className="text-sm text-muted-foreground">Par {hole.par}</span>
                    </div>
                    {hole.is_sweep && (
                      <Badge className="bg-amber-500">
                        <Trophy size={12} className="mr-1" />
                        SWEEP
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { name: game.player_1, gross: hole.player_1_gross_score, net: hole.player_1_net_score, points: hole.player_1_hole_points, color: "text-emerald-600" },
                      { name: game.player_2, gross: hole.player_2_gross_score, net: hole.player_2_net_score, points: hole.player_2_hole_points, color: "text-blue-600" },
                      { name: game.player_3, gross: hole.player_3_gross_score, net: hole.player_3_net_score, points: hole.player_3_hole_points, color: "text-amber-600" },
                    ].map((player, i) => (
                      <div key={i} className="p-2 rounded bg-muted/50">
                        <div className={`text-xs font-medium truncate ${player.color}`}>{player.name}</div>
                        <div className="text-lg font-bold">{player.gross}</div>
                        {game.use_handicaps && player.net !== player.gross && (
                          <div className="text-xs text-muted-foreground">Net: {player.net}</div>
                        )}
                        <div className="text-sm font-semibold text-primary">+{player.points}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Running Total</span>
                    <span className="font-medium">
                      <span className="text-emerald-600">{hole.player_1_running_total}</span>
                      {" - "}
                      <span className="text-blue-600">{hole.player_2_running_total}</span>
                      {" - "}
                      <span className="text-amber-600">{hole.player_3_running_total}</span>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
