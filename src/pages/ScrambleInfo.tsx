import { useParams } from "react-router-dom";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";

export default function ScrambleInfo() {
  const { gameId } = useParams<{ gameId: string }>();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('scramble', gameId);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Info</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Scramble
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Scramble is a fun, team-based golf format that's perfect for groups of all skill levels. 
                Teams work together to achieve the best possible score on each hole.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Basic Rules</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All team members hit tee shots, then select the best shot</li>
                <li>• All players hit from the chosen spot, repeat until holed</li>
                <li>• The team records one score per hole</li>
                <li>• Lowest total team score wins</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Team Structure</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Teams can have 2, 3, 4, or more players</li>
                <li>• Multiple teams can compete against each other</li>
                <li>• Teams can be assigned manually or randomly</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Optional Rules</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Minimum Drives:</strong> Each player's drive must be used a minimum number of times</li>
                <li>• <strong>Handicaps:</strong> Can be applied for net scoring to level the playing field</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Scoring</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Score is compared to par (e.g., -5, +2, E)</li>
                <li>• Each hole gets one team score</li>
                <li>• If a team doesn't complete a hole, mark it with "–"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {gameId && !isSpectatorLoading && <ScrambleBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
