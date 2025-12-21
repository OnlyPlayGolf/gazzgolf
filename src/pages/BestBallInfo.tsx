import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";

export default function BestBallInfo() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Best Ball Rules</h1>
        
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">How to Play</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Best Ball</strong> is a team format where two teams compete. Each player 
              plays their own ball, and the best (lowest) score from each team counts for that hole.
            </p>
            <p>
              Best Ball can be played as either <strong>Match Play</strong> (hole-by-hole wins) 
              or <strong>Stroke Play</strong> (total strokes).
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Match Play Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              In Match Play, the team with the lowest best ball score wins the hole. The match 
              is scored by holes won, not total strokes.
            </p>
            <p>
              The match ends when one team is up more holes than there are holes remaining.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Stroke Play Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              In Stroke Play, each team's best ball scores are added up over all holes. 
              The team with the lowest total wins.
            </p>
            <p>
              All 18 holes (or 9 holes) are played regardless of the score difference.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Handicaps (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              When playing with handicaps, net scores are calculated for each player. 
              The best net score from each team counts. Strokes are allocated based on 
              the stroke index of each hole.
            </p>
          </CardContent>
        </Card>
      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
