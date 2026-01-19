import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GameHeader } from "@/components/GameHeader";

export default function BestBallInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('best_ball', gameId);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        const { data } = await supabase
          .from("best_ball_games")
          .select("round_name, course_name")
          .eq("id", gameId)
          .single();
        if (data) setGameData(data);
      };
      fetchGameData();
    }
  }, [gameId]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader 
        gameTitle={gameData?.round_name || "Best Ball"} 
        courseName={gameData?.course_name || ""} 
        pageTitle="Game info" 
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Best Ball
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Best Ball is a team format where two teams compete. Each player plays their own ball, and the best (lowest) score from each team counts for that hole. It can be played as Match Play (hole-by-hole wins) or Stroke Play (total strokes).
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Match Play Format</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Team with the lowest best ball score wins the hole</li>
                <li>• Match is scored by holes won, not total strokes</li>
                <li>• Match ends when one team is up more holes than remain</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Stroke Play Format</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Each team's best ball scores are added up over all holes</li>
                <li>• The team with the lowest total wins</li>
                <li>• All 18 holes (or 9 holes) are played regardless of score</li>
              </ul>
            </div>

          </CardContent>
        </Card>
      </div>

      {gameId && !isSpectatorLoading && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
