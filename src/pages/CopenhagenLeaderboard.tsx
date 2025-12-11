import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, Press } from "@/types/copenhagen";
import { Trophy, Medal } from "lucide-react";

export default function CopenhagenLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
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

  const players = [
    { name: game.player_1, points: game.player_1_total_points, color: "text-emerald-600", bg: "bg-emerald-500" },
    { name: game.player_2, points: game.player_2_total_points, color: "text-blue-600", bg: "bg-blue-500" },
    { name: game.player_3, points: game.player_3_total_points, color: "text-amber-600", bg: "bg-amber-500" },
  ].sort((a, b) => b.points - a.points);

  const getMedalIcon = (position: number) => {
    if (position === 0) return <Trophy className="text-yellow-500" size={24} />;
    if (position === 1) return <Medal className="text-gray-400" size={24} />;
    return <Medal className="text-amber-700" size={24} />;
  };

  // Calculate winnings
  const totalPoints = players.reduce((sum, p) => sum + p.points, 0);
  const averagePoints = totalPoints / 3;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Leaderboard</h1>

        {/* Main Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-shrink-0">{getMedalIcon(i)}</div>
                <div className="flex-1">
                  <div className={`font-medium ${player.color}`}>{player.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{player.points}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Press Leaderboards */}
        {game.presses.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Press Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {game.presses.map((press, i) => {
                const pressPlayers = [
                  { name: game.player_1, points: press.player_1_points },
                  { name: game.player_2, points: press.player_2_points },
                  { name: game.player_3, points: press.player_3_points },
                ].sort((a, b) => b.points - a.points);

                return (
                  <div key={press.id} className="p-3 rounded-lg border">
                    <div className="text-sm font-medium mb-2">
                      Press #{i + 1} (from hole {press.start_hole})
                    </div>
                    <div className="space-y-1">
                      {pressPlayers.map((p, j) => (
                        <div key={j} className="flex justify-between text-sm">
                          <span>{p.name}</span>
                          <span className="font-medium">{p.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
