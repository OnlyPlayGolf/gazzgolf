import { useParams } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function CopenhagenInfo() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
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
                Copenhagen (6-Point) is a 3-player golf betting game where 6 points are awarded on every hole. Points are distributed based on net scores, with special rules for ties and sweeps.
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
              <h3 className="font-semibold text-sm">Handicaps</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Scratch:</strong> Gross scores compared directly</li>
                <li>• <strong>Net:</strong> Strokes applied based on handicap and stroke index</li>
                <li>• Strokes distributed using course stroke index</li>
                <li>• Different tees accommodated with handicap adjustments</li>
              </ul>
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
      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
