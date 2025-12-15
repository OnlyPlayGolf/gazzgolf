import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayBestBallStroke() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Best Ball (Stroke Play)</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Best Ball Stroke Play is a team format where each player plays their own ball, 
                but only the <strong>lowest score</strong> on each hole counts for the team.
              </p>
              <p>
                Teams compete to have the <strong>lowest total score</strong> over 18 holes.
                It's a great format for players of different skill levels since everyone 
                contributes without pressure.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Setup</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>2v2 Format:</strong> Two teams of two players each</p>
              <p>Each player plays their own ball throughout the round</p>
              <p>The best individual score on each hole becomes the team score</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring Example</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Hole 1 (Par 4):</strong></p>
              <p>• Team A: Player 1 scores 5, Player 2 scores 4 → Team A records <strong>4</strong></p>
              <p>• Team B: Player 3 scores 6, Player 4 scores 5 → Team B records <strong>5</strong></p>
              <p className="pt-2">
                Each hole, the best score from each team is recorded. At the end, 
                the team with the lowest combined score wins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Winning</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                The team with the lowest combined best-ball score after 18 holes wins. 
                Results are often expressed as strokes ahead (e.g., "Team A wins by 3 strokes").
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Handicap Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                When using handicaps, each player's net score is calculated based 
                on their handicap and the hole's stroke index.
              </p>
              <p>
                The team's best <strong>net score</strong> counts for each hole, 
                making it fair for mixed-ability teams.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
