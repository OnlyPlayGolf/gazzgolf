import { useParams } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export default function SkinsInfo() {
  const { roundId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Skins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Skins is a fun and competitive format where players compete for "skins" on each hole. Each hole is worth one skin, and the player with the outright lowest score wins the skin for that hole.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">How It Works</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enter each player's score just like Stroke Play</li>
                <li>• The lowest score on each hole wins that skin</li>
                <li>• If two or more players tie, no skin is awarded</li>
                <li>• Tied skins can carry over to the next hole</li>
                <li>• The player with the most skins at the end wins</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Carryover Rules</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• When no player wins a hole outright (tie), the skin carries over</li>
                <li>• Carryover skins add to the next hole's value</li>
                <li>• Example: If holes 1 and 2 tie, hole 3 is worth 3 skins</li>
                <li>• This creates exciting high-stakes holes!</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Winning a Skin</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Outright Win:</strong> You must have the lowest score alone</li>
                <li>• Even a great score doesn't win if another player ties you</li>
                <li>• Consider taking risks on holes with carryovers</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Example</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Hole 1: Player A (4) vs Player B (5) → A wins 1 skin</li>
                <li>• Hole 2: Both score 4 → Tie, skin carries over</li>
                <li>• Hole 3: Player B (3) vs Player A (4) → B wins 2 skins</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      {roundId && <SkinsBottomTabBar roundId={roundId} />}
    </div>
  );
}
