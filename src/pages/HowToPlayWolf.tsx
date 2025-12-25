import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayWolf() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">How to Play Wolf</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Wolf is a golf betting game for 4-6 players where one player each hole 
                becomes the "Wolf" and decides whether to team up or go solo.
              </p>
              <p>
                The player with the most points after 18 holes wins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Setup</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Works with 4-6 players</p>
              <p>• On the 1st tee, set a fixed player order (randomized in the app)</p>
              <p>• The Wolf rotates each hole</p>
              <p>• The Wolf tees off first or last, depending on settings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gameplay</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Choose: Partner or Lone Wolf</strong>
              </p>
              <p>
                The Wolf can pick a partner after any tee shot—but once they skip someone, 
                they can't pick them later. If the Wolf doesn't pick anyone, they become Lone Wolf.
              </p>
              <p className="pt-2">
                <strong>Matchup for the hole:</strong>
              </p>
              <p>• Wolf + chosen partner vs the other players</p>
              <p>• OR Lone Wolf vs everyone</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scoring</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Points are customizable in settings. Default scoring:</p>
              <div className="space-y-1 pt-2">
                <div className="flex justify-between">
                  <span>Lone Wolf win</span>
                  <span className="font-semibold text-green-600">+3 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Lone Wolf loss (each opponent)</span>
                  <span className="font-semibold text-red-600">+1 point</span>
                </div>
                <div className="flex justify-between">
                  <span>Team win (each member)</span>
                  <span className="font-semibold text-blue-600">+1 point</span>
                </div>
                <div className="flex justify-between">
                  <span>Losing team</span>
                  <span className="text-muted-foreground">0 points</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Double</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                The Double option allows players to raise the stakes on any hole.
              </p>
              <p>
                <strong>Who can double first:</strong> The team/player with the fewest 
                players tees off first and has the first opportunity to call Double.
              </p>
              <p>
                <strong>Double Back:</strong> After a Double is called, the other team/player 
                can respond with a Double Back to accept the challenge.
              </p>
              <p>
                <strong>Effect:</strong> When Double is called, the points for that hole 
                are doubled. All point values (Lone Wolf win, team win, etc.) are multiplied by 2.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
