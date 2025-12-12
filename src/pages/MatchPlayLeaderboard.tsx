import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { formatMatchStatus } from "@/utils/matchPlayScoring";

export default function MatchPlayLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData as MatchPlayGame);
      }

      const { data: holesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as MatchPlayHole[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const player1HolesWon = holes.filter(h => h.hole_result === 1).length;
  const player2HolesWon = holes.filter(h => h.hole_result === -1).length;
  const holesHalved = holes.filter(h => h.hole_result === 0).length;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Match Status</h1>

        {/* Current Status */}
        <Card className="p-6 text-center bg-primary/10">
          <p className="text-2xl font-bold text-primary">
            {formatMatchStatus(game.match_status, game.holes_remaining, game.player_1, game.player_2)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {game.holes_remaining} holes remaining
          </p>
        </Card>

        {/* Player Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <p className="font-semibold text-blue-600">{game.player_1}</p>
            <p className="text-3xl font-bold mt-2">{player1HolesWon}</p>
            <p className="text-xs text-muted-foreground">Holes Won</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-semibold text-red-600">{game.player_2}</p>
            <p className="text-3xl font-bold mt-2">{player2HolesWon}</p>
            <p className="text-xs text-muted-foreground">Holes Won</p>
          </Card>
        </div>

        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Holes Halved</p>
          <p className="text-2xl font-bold">{holesHalved}</p>
        </Card>

        {/* Hole-by-Hole */}
        {holes.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Hole by Hole</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Hole</th>
                    <th className="text-center py-2">{game.player_1}</th>
                    <th className="text-center py-2">{game.player_2}</th>
                    <th className="text-center py-2">Result</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {holes.map((hole) => (
                    <tr key={hole.id} className="border-b">
                      <td className="py-2">{hole.hole_number}</td>
                      <td className="text-center py-2">{hole.player_1_gross_score}</td>
                      <td className="text-center py-2">{hole.player_2_gross_score}</td>
                      <td className="text-center py-2">
                        <span className={`font-medium ${
                          hole.hole_result === 1 ? 'text-blue-600' : 
                          hole.hole_result === -1 ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          {hole.hole_result === 1 ? game.player_1 : 
                           hole.hole_result === -1 ? game.player_2 : 
                           'Halved'}
                        </span>
                      </td>
                      <td className="text-center py-2 text-xs">
                        {formatMatchStatus(hole.match_status_after, hole.holes_remaining_after, game.player_1, game.player_2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {gameId && <MatchPlayBottomTabBar gameId={gameId} />}
    </div>
  );
}
