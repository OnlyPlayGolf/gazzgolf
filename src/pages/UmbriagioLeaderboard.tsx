import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { UmbriagioGame, RollEvent } from "@/types/umbriago";

export default function UmbriagioLeaderboard() {
  const { gameId } = useParams();
  const [game, setGame] = useState<UmbriagioGame | null>(null);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    const { data } = await supabase
      .from("umbriago_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (data) {
      setGame({
        ...data,
        payout_mode: data.payout_mode as 'difference' | 'total',
        roll_history: (data.roll_history as unknown as RollEvent[]) || [],
        winning_team: data.winning_team as 'A' | 'B' | 'TIE' | null,
      });
    }
  };

  const getLeader = () => {
    if (!game) return null;
    if (game.team_a_total_points > game.team_b_total_points) return 'A';
    if (game.team_b_total_points > game.team_a_total_points) return 'B';
    return null;
  };

  const leader = getLeader();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {game ? (
              <>
                <div className={`p-4 rounded-lg border-2 ${leader === 'A' ? 'border-blue-500 bg-blue-500/10' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <div>
                        <div className="font-semibold">Team A</div>
                        <div className="text-sm text-muted-foreground">
                          {game.team_a_player_1} & {game.team_a_player_2}
                        </div>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-blue-500">
                      {game.team_a_total_points}
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg border-2 ${leader === 'B' ? 'border-red-500 bg-red-500/10' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <div>
                        <div className="font-semibold">Team B</div>
                        <div className="text-sm text-muted-foreground">
                          {game.team_b_player_1} & {game.team_b_player_2}
                        </div>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-red-500">
                      {game.team_b_total_points}
                    </div>
                  </div>
                </div>

                {leader === null && game.team_a_total_points === game.team_b_total_points && (
                  <p className="text-center text-muted-foreground">Teams are tied!</p>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
    </div>
  );
}
