import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlaySkins() {
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
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Skins is a popular betting game where players compete for individual "skins" 
                on each hole. It's individual play — no teams required.
              </p>
              <p>
                Each hole has one skin up for grabs. The player with the lowest score on a 
                hole wins that skin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Winning a Skin</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Outright win:</strong> Have the lowest score on the hole — you win the skin!</p>
              <p><strong>Tied low score:</strong> No one wins — the skin "carries over" to the next hole.</p>
              <p className="pt-2">
                When skins carry over, the next hole becomes worth multiple skins. This can 
                build up to create high-stakes holes later in the round.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Carryovers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                When enabled (default), tied holes carry their skins forward. For example, 
                if holes 5 and 6 are tied, hole 7 is worth 3 skins.
              </p>
              <p>
                If carryovers are disabled, tied holes simply result in no skin awarded — 
                each hole is always worth exactly one skin.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Multi-Group Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Skins can be played across multiple groups in the same round. All players 
                from all groups compete together for skins.
              </p>
              <p>
                <strong>Example:</strong> Group A has 4 players, Group B has 4 players — 
                all 8 compete for the same skins on each hole.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Handicap Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Gross skins:</strong> Raw scores determine the winner</p>
              <p><strong>Net skins:</strong> Handicap strokes are applied before comparing</p>
              <p className="pt-2">
                Net skins use the stroke index to allocate handicap strokes on the appropriate 
                holes, leveling the playing field for all skill levels.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skin Values</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                You can set a value per skin during setup (e.g., $1, $5, or just 1 point). 
                At the end of the round, the leaderboard shows total skins won and optional 
                monetary totals.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
