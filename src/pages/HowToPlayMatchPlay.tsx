import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayMatchPlay() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">How to Play Match Play</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Match Play is a head-to-head format where two players compete hole-by-hole. 
                Unlike stroke play, you don't count total strokes — you count holes won.
              </p>
              <p>
                The player with the lowest score on each hole wins that hole. If scores are 
                equal, the hole is "halved" (tied).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Win a hole:</strong> +1 to your match score</p>
              <p><strong>Lose a hole:</strong> -1 to your match score</p>
              <p><strong>Halve a hole:</strong> No change</p>
              <p className="pt-2">
                The match status shows who is leading. "2 Up" means leading by 2 holes. 
                "All Square" means tied.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Winning the Match</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                The match ends when one player is up more holes than there are holes remaining.
              </p>
              <p>
                <strong>Example:</strong> If you're 3 Up with 2 holes to play, you win "3 & 2" 
                (3 up with 2 holes remaining).
              </p>
              <p>
                If the match is tied after all holes, it ends "All Square" unless you play 
                extra holes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Common Terms</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>All Square:</strong> The match is tied</p>
              <p><strong>1 Up, 2 Up:</strong> Leading by that many holes</p>
              <p><strong>Dormie:</strong> Up by the same number as holes remaining</p>
              <p><strong>3 & 2:</strong> Won 3 up with 2 holes left</p>
              <p><strong>19th hole:</strong> Extra hole to break a tie</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Handicap Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                When using handicaps, the difference between players' handicaps determines 
                stroke allocation. Strokes are given on the hardest holes first (based on 
                stroke index).
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
