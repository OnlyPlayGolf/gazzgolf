import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper, Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UmbriagioHole {
  id: string;
  hole_number: number;
  is_umbriago: boolean;
  team_a_hole_points: number;
  team_b_hole_points: number;
  multiplier: number;
}

interface GameData {
  team_a_player_1: string;
  team_a_player_2: string;
  team_b_player_1: string;
  team_b_player_2: string;
}

export default function UmbriagioFeed() {
  const { gameId } = useParams();
  const [umbriagioHoles, setUmbriagioHoles] = useState<UmbriagioHole[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchData = async () => {
      // Fetch game data for team names
      const { data: game } = await supabase
        .from("umbriago_games")
        .select("team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2")
        .eq("id", gameId)
        .single();

      if (game) {
        setGameData(game);
      }

      // Fetch holes where umbriago occurred
      const { data: holes } = await supabase
        .from("umbriago_holes")
        .select("id, hole_number, is_umbriago, team_a_hole_points, team_b_hole_points, multiplier")
        .eq("game_id", gameId)
        .eq("is_umbriago", true)
        .order("hole_number", { ascending: true });

      if (holes) {
        setUmbriagioHoles(holes);
      }

      setLoading(false);
    };

    fetchData();
  }, [gameId]);

  const getWinningTeam = (hole: UmbriagioHole) => {
    if (hole.team_a_hole_points > hole.team_b_hole_points) {
      return {
        team: "Team A",
        players: gameData ? `${gameData.team_a_player_1} & ${gameData.team_a_player_2}` : "Team A",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 border-blue-500/30"
      };
    } else {
      return {
        team: "Team B",
        players: gameData ? `${gameData.team_b_player_1} & ${gameData.team_b_player_2}` : "Team B",
        color: "text-red-500",
        bgColor: "bg-red-500/10 border-red-500/30"
      };
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-foreground mb-4">Game Feed</h1>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : umbriagioHoles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Newspaper className="mx-auto text-muted-foreground mb-4" size={48} />
              <h2 className="text-lg font-semibold mb-2">No Umbriagios Yet</h2>
              <p className="text-sm text-muted-foreground">
                When a team wins all 4 categories on a hole, it will appear here!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {umbriagioHoles.map((hole) => {
              const winner = getWinningTeam(hole);
              return (
                <Card key={hole.id} className={`border-2 ${winner.bgColor}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${winner.bgColor}`}>
                        <Sparkles className={`${winner.color}`} size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Trophy className={`${winner.color}`} size={16} />
                          <span className={`font-bold ${winner.color}`}>UMBRIAGO!</span>
                          {hole.multiplier > 1 && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full font-semibold">
                              {hole.multiplier}x
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-1">
                          {winner.players}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hole {hole.hole_number} • Won all 4 categories • {hole.team_a_hole_points > hole.team_b_hole_points ? hole.team_a_hole_points : hole.team_b_hole_points} points
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
    </div>
  );
}
