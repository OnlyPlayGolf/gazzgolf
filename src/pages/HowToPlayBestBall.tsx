import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayBestBall() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Best Ball</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Best Ball is a team format where each player plays their own ball, 
                and the <strong>best score</strong> from each team counts on every hole.
              </p>
              <p>
                Best Ball supports <strong>two game types</strong>: Match Play and Stroke Play. 
                Choose your format during game setup.
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
              <p>The best individual score on each hole represents the team</p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Match Play Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Teams compete <strong>hole-by-hole</strong>. The team with the lowest 
                best ball score wins each hole.
              </p>
              <p><strong>Win a hole:</strong> Team goes "1 Up"</p>
              <p><strong>Lose a hole:</strong> Team goes "1 Down"</p>
              <p><strong>Tie (halve):</strong> No change in match status</p>
              <p className="pt-2">
                <strong>Winning:</strong> The match ends when one team is up more holes 
                than there are remaining (e.g., 4 & 3 means 4 up with 3 to play).
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Stroke Play Mode
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Teams compete on <strong>total strokes</strong>. The team with the 
                lowest combined best ball score wins.
              </p>
              <p><strong>Each hole:</strong> The best score from each team is added to their running total</p>
              <p><strong>Leaderboard:</strong> Ranked by total team score (lowest wins)</p>
              <p className="pt-2">
                <strong>Winning:</strong> After all holes, the team with the lowest 
                total score wins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring Example</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Hole 1 (Par 4):</strong></p>
              <p>• Team A: Player 1 scores 4, Player 2 scores 5 → Best: 4</p>
              <p>• Team B: Player 1 scores 5, Player 2 scores 4 → Best: 4</p>
              <p className="pt-2"><strong>Match Play:</strong> Hole is halved (tied)</p>
              <p><strong>Stroke Play:</strong> Both teams add 4 to their total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Match Play Terms</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>All Square:</strong> Match is tied</p>
              <p><strong>1 Up, 2 Up:</strong> Leading by that many holes</p>
              <p><strong>Dormie:</strong> Up by same number as holes remaining</p>
              <p><strong>4 & 3:</strong> Won 4 up with 3 holes left</p>
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
                The team's best <strong>net score</strong> counts for each hole.
              </p>
              <p>
                This applies to both Match Play and Stroke Play modes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
