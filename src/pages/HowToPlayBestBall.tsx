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
                Best Ball Match Play is a team format where each player plays their own ball, 
                and teams compete <strong>hole-by-hole</strong>.
              </p>
              <p>
                The team with the lowest best score wins each hole. Unlike stroke play, 
                total strokes don't matter — only holes won count.
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hole Scoring</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Win a hole:</strong> Team goes "1 Up"</p>
              <p><strong>Lose a hole:</strong> Team goes "1 Down"</p>
              <p><strong>Tie (halve):</strong> No change in match status</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring Example</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Hole 1 (Par 4):</strong></p>
              <p>• Team A best: 4 (par)</p>
              <p>• Team B best: 5 (bogey)</p>
              <p>• Result: Team A wins the hole → <strong>Team A 1 Up</strong></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Winning the Match</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                The match ends when one team is up more holes than there are remaining.
              </p>
              <p>
                <strong>Example:</strong> Team A is 4 Up with 3 holes to play → 
                Team A wins "4 & 3"
              </p>
              <p>
                If tied after 18 holes, the match ends "All Square" or continues 
                with extra holes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Common Terms</CardTitle>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
