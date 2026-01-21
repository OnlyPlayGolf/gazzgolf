import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { supabase } from "@/integrations/supabase/client";
import { GameHeader } from "@/components/GameHeader";

export default function CopenhagenInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('copenhagen', gameId);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        const { data } = await supabase
          .from("copenhagen_games")
          .select("round_name, course_name")
          .eq("id", gameId)
          .maybeSingle();
        if (data) setGameData(data);
      };
      fetchGameData();
    }
  }, [gameId]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader 
        gameTitle={gameData?.round_name || "Copenhagen"} 
        courseName={gameData?.course_name || ""} 
        pageTitle="Game info" 
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Copenhagen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Copenhagen (6-Point) is a 3-player golf betting game where 6 points are awarded on every hole. Points are distributed based on scores, with special rules for ties and sweeps.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Normal Scoring (6 Points Per Hole)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Lowest score:</strong> 4 points</li>
                <li>• <strong>Second lowest:</strong> 2 points</li>
                <li>• <strong>Highest score:</strong> 0 points</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Tie Rules</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Tie for lowest (2 players):</strong> 3-3-0</li>
                <li>• <strong>Three-way tie:</strong> 2-2-2</li>
                <li>• <strong>Tie for second (2 players):</strong> 4-1-1</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Sweep Rule (6-0-0)</h3>
              <p className="text-sm text-muted-foreground">
                A sweep awards ALL 6 points to one player. Both conditions must be met:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Player makes birdie or better</li>
                <li>• Player beats both opponents by 2+ strokes</li>
              </ul>
              <p className="text-sm text-muted-foreground/70 italic">
                If either condition is not met, normal scoring applies.
              </p>
            </div>


            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Winning</h3>
              <p className="text-sm text-muted-foreground">
                After 18 holes, the player with the most total points wins.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      {gameId && !isSpectatorLoading && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
    </div>
  );
}
