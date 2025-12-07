import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { WolfGame } from "@/types/wolf";

export default function WolfLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<WolfGame | null>(null);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    const { data } = await supabase
      .from("wolf_games" as any)
      .select("*")
      .eq("id", gameId)
      .single();
    if (data) setGame(data as unknown as WolfGame);
  };

  const getPlayerCount = () => {
    if (!game) return 3;
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };

  const players = game ? [
    { name: game.player_1, points: game.player_1_points },
    { name: game.player_2, points: game.player_2_points },
    { name: game.player_3, points: game.player_3_points },
    { name: game.player_4 || '', points: game.player_4_points },
    { name: game.player_5 || '', points: game.player_5_points },
  ].slice(0, getPlayerCount()).sort((a, b) => b.points - a.points) : [];

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <h1 className="text-xl font-bold text-center">Leaderboard</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-4 text-center">Current Standings</h2>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div 
                key={index} 
                className={`flex justify-between items-center p-3 rounded ${
                  index === 0 ? 'bg-amber-500/10' : ''
                }`}
              >
                <span className="font-medium">
                  {index + 1}. {player.name}
                  {index === 0 && ' 🏆'}
                </span>
                <span className="font-bold text-lg">{player.points} pts</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <WolfBottomTabBar gameId={gameId!} />
    </div>
  );
}
