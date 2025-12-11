import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HowToPlayCopenhagen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">How to Play Copenhagen</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Copenhagen (6-Point) is a 3-player golf betting game where 6 points are awarded on every hole.</p>
            <p>Points are distributed based on net scores, with special rules for ties and sweeps.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring Rules (6 Points Per Hole)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Normal Scoring:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Lowest score: <span className="font-semibold">4 points</span></li>
                <li>Second lowest: <span className="font-semibold">2 points</span></li>
                <li>Highest score: <span className="font-semibold">0 points</span></li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <p className="font-medium">Tie Rules:</p>
              <p><span className="font-medium">Tie for lowest (2 players):</span> 3-3-0</p>
              <p><span className="font-medium">Three-way tie:</span> 2-2-2</p>
              <p><span className="font-medium">Tie for second (2 players):</span> 4-1-1</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sweep Rule (6-0-0)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>A sweep awards ALL 6 points to one player. Both conditions must be met:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Player makes <span className="font-semibold">birdie or better</span></li>
              <li>Player beats <span className="font-semibold">both opponents by 2+ strokes</span></li>
            </ul>
            <p className="text-muted-foreground italic">If either condition is not met, normal scoring applies.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Any player can start a press at any time during the round.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Press creates a separate side bet</li>
              <li>Press begins on the next hole</li>
              <li>Points are tracked separately for each press</li>
              <li>Multiple presses can be active simultaneously</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Handicaps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Copenhagen can be played scratch or with handicaps:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-medium">Scratch:</span> Gross scores compared directly</li>
              <li><span className="font-medium">Net:</span> Strokes applied based on handicap and stroke index</li>
              <li>Strokes are distributed using the course stroke index</li>
              <li>Different tees can be accommodated with handicap adjustments</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Winning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>After 18 holes, the player with the most total points wins.</p>
            <p>Winnings are calculated as: (Your Points - Average Points) × Stake</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
