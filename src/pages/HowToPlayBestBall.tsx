import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HowToPlayBestBall() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">How to Play Best Ball</h1>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="stroke" className="flex-1">Stroke Play</TabsTrigger>
            <TabsTrigger value="match" className="flex-1">Match Play</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What is Best Ball?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Best Ball is a team format where each player plays their own ball, 
                  but only the <strong>lowest score</strong> on each hole counts for the team.
                </p>
                <p>
                  It's a great format for players of different skill levels since 
                  everyone contributes without pressure — if you have a bad hole, 
                  your partner can save the team.
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
          </TabsContent>

          <TabsContent value="stroke" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Best Ball - Stroke Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  In stroke play format, teams compete to have the <strong>lowest 
                  total score</strong> over 18 holes.
                </p>
                <p>
                  Each hole, the best score from each team is recorded. At the end, 
                  the team with the lowest combined score wins.
                </p>
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
                <p className="pt-2">After all holes, the team with the lowest total wins.</p>
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
          </TabsContent>

          <TabsContent value="match" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Best Ball - Match Play</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  In match play format, teams compete <strong>hole-by-hole</strong>. 
                  The team with the best score wins the hole.
                </p>
                <p>
                  Unlike stroke play, total strokes don't matter — only holes won count.
                </p>
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
                <p>• Team A best: 4 (birdie)</p>
                <p>• Team B best: 5 (par)</p>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
