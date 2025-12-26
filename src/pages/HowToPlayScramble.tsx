import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayScramble() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground">
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold">How to Play Scramble</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Scramble is a fun, team-based golf format that's perfect for groups of all skill levels. 
              Teams work together to achieve the best possible score on each hole.
            </p>
            <p>
              This format emphasizes teamwork and strategy while keeping the pace of play quick 
              and enjoyable for everyone.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Basic Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">1. Tee Shots</h4>
              <p className="text-muted-foreground">
                All team members hit tee shots. The team then selects the best shot to play from.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">2. Second Shots & Beyond</h4>
              <p className="text-muted-foreground">
                All players hit from the chosen spot. Again, select the best shot. 
                Repeat until the ball is holed.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">3. Team Score</h4>
              <p className="text-muted-foreground">
                The team records one score per hole – the total strokes taken from tee to hole.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc pl-4 space-y-2 text-muted-foreground">
              <li>Teams can have 2, 3, 4, or more players</li>
              <li>Multiple teams can compete against each other</li>
              <li>Teams can be assigned manually or randomly</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optional Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Minimum Drives</h4>
              <p className="text-muted-foreground">
                Require each player's drive to be used a minimum number of times during the round 
                (e.g., each player's tee shot must be selected at least 2 times).
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Handicaps</h4>
              <p className="text-muted-foreground">
                Handicaps can be applied for net scoring to level the playing field between teams.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc pl-4 space-y-2 text-muted-foreground">
              <li>Lowest total team score wins</li>
              <li>Score is compared to par (e.g., -5, +2, E)</li>
              <li>Each hole gets one team score</li>
              <li>If a team doesn't complete a hole, mark it with "–"</li>
            </ul>
          </CardContent>
        </Card>


        <Button onClick={() => navigate('/scramble/setup')} className="w-full" size="lg">
          Start a Scramble Game
        </Button>
      </div>
    </div>
  );
}
