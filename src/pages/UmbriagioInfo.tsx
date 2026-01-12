import { useParams } from "react-router-dom";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";

export default function UmbriagioInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('umbriago', gameId);

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="text-primary" />
              How to Play Umbriago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                A 2v2 team game where points are won across 4 categories on every hole. The team with the most points at the end wins. No handicaps – scratch play only.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">4 Ways to Win Points Each Hole</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Team Low:</strong> Team with the lowest combined score wins 1 point</li>
                <li>• <strong>Individual Low:</strong> Team of the player with the lowest score wins 1 point</li>
                <li>• <strong>Closest to Pin (GIR):</strong> Measured after the regulation shot (1 on par 3, 2 on par 4, 3 on par 5). Ball must be on the green – a ball off the green cannot win even if closer</li>
                <li>• <strong>Birdie or Better:</strong> If only one team makes birdie (or better), they win 1 point</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Tee-Off Order</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• The team leading in points tees off first</li>
                <li>• If tied, the team that came back from a losing position goes first</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Umbriago (Bonus!)</h3>
              <p className="text-sm text-muted-foreground">
                Win all 4 categories on a single hole? Your points are <strong>doubled</strong> (4 → 8 points)!
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Doubles & Double Backs</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Double:</strong> Before a hole, the losing team can call "Double" to multiply that hole's points by 2</li>
                <li>• <strong>Double Back:</strong> After everyone has played their shot, the opposing team may call "Double Back" to instead multiply the points for that hole by 4</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Umbriago Roll</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Only the <strong>losing team</strong> can call a Roll</li>
                <li>• A Roll halves <strong>both teams' total points</strong> and makes all remaining holes worth <strong>double points (×2)</strong></li>
                <li>• By default, each team can use <strong>one Roll per round</strong>, but this can be adjusted in the game settings</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      {gameId && !isSpectatorLoading && <UmbriagioBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
