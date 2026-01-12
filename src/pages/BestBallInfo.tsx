import { useParams } from "react-router-dom";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function BestBallInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('best_ball', gameId);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Info</h1>
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

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Handicaps (Optional)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Net scores are calculated for each player when enabled</li>
                <li>• Best net score from each team counts</li>
                <li>• Strokes allocated based on stroke index of each hole</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {gameId && !isSpectatorLoading && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
