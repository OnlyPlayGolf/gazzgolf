import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { Zap, Info } from "lucide-react";

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

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
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
                    <div className="flex gap-2">
                      <span className="text-emerald-600 font-medium">{press.player_1_points}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-blue-600 font-medium">{press.player_2_points}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-amber-600 font-medium">{press.player_3_points}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Copenhagen Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              Copenhagen Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <p>Copenhagen (6-Point) is a 3-player golf betting game where 6 points are awarded on every hole.</p>
              <p>Points are distributed based on net scores, with special rules for ties and sweeps.</p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Scoring Rules (6 Points Per Hole)</p>
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground">Normal Scoring:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Lowest score: <span className="font-semibold">4 points</span></li>
                  <li>Second lowest: <span className="font-semibold">2 points</span></li>
                  <li>Highest score: <span className="font-semibold">0 points</span></li>
                </ul>
              </div>
              <div className="space-y-2 pt-2">
                <p className="font-medium text-muted-foreground">Tie Rules:</p>
                <p className="text-sm"><span className="font-medium">Tie for lowest (2 players):</span> 3-3-0</p>
                <p className="text-sm"><span className="font-medium">Three-way tie:</span> 2-2-2</p>
                <p className="text-sm"><span className="font-medium">Tie for second (2 players):</span> 4-1-1</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Sweep Rule (6-0-0)</p>
              <p className="text-sm">A sweep awards ALL 6 points to one player. Both conditions must be met:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Player makes <span className="font-semibold">birdie or better</span></li>
                <li>Player beats <span className="font-semibold">both opponents by 2+ strokes</span></li>
              </ul>
              <p className="text-sm text-muted-foreground italic">If either condition is not met, normal scoring applies.</p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Presses</p>
              <p className="text-sm">Any player can start a press at any time during the round.</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Press creates a separate side bet</li>
                <li>Press begins on the next hole</li>
                <li>Points are tracked separately for each press</li>
                <li>Multiple presses can be active simultaneously</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Handicaps</p>
              <p className="text-sm">Copenhagen can be played scratch or with handicaps:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><span className="font-medium">Scratch:</span> Gross scores compared directly</li>
                <li><span className="font-medium">Net:</span> Strokes applied based on handicap and stroke index</li>
                <li>Strokes are distributed using the course stroke index</li>
                <li>Different tees can be accommodated with handicap adjustments</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Winning</p>
              <p className="text-sm">After 18 holes, the player with the most total points wins.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
