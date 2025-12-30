import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlaySimpleSkins() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">How to Play Skins</h1>
        </div>

        <div className="space-y-4">
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-lg">Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Skins is a fun and competitive format where players compete
                for "skins" on each hole. It uses a simple interface for easy score entry.
              </p>
              <p>
                Each hole is worth one skin. The player with the outright lowest score
                wins the skin for that hole.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Enter each player's score just like Stroke Play</p>
              <p>• The lowest score on each hole wins that skin</p>
              <p>• If two or more players tie for the lowest score, no skin is awarded</p>
              <p>• Tied skins carry over to the next hole</p>
              <p>• The player with the most skins at the end wins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Carryover Rules</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                When no player wins a hole outright (tie), that skin carries over
                and adds to the next hole's value.
              </p>
              <p>
                For example, if holes 1 and 2 are tied, hole 3 will be worth 3 skins
                (1 for hole 3 + 2 carryovers).
              </p>
              <p>
                This creates exciting high-stakes holes as carryovers accumulate!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Winning a Skin</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Outright Win:</strong> You must have the lowest score alone.
                Even if you make a great score, you don't win if another player ties you.
              </p>
              <p>
                <strong>Strategy:</strong> Sometimes it's worth taking risks to try
                and beat your opponents, especially on holes with carryovers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Example</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Hole 1: Player A scores 4, Player B scores 5 → Player A wins 1 skin</p>
              <p>Hole 2: Both players score 4 → Tie, skin carries over</p>
              <p>Hole 3: Player B scores 3, Player A scores 4 → Player B wins 2 skins</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Strategy:</strong> Taking calculated risks can pay off, especially when multiple skins are on the line from carryovers.
              </p>
              <p>
                <strong>Pressure:</strong> Skins creates exciting high-stakes moments as carryovers accumulate!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
