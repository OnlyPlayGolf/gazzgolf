import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HowToPlayWolf() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">How to Play Wolf</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🐺 What is Wolf?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Wolf is a golf betting game for 3-5 players where one player each hole becomes the "Wolf" and decides whether to team up or go solo.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Works with 3–5 players. The more players, the better!</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• On the 1st tee, set a fixed player order (randomized in the app).</p>
            <p>• The Wolf rotates each hole (last in the order on Hole 1, then cycles).</p>
            <p>• The Wolf tees off first or last, depending on settings.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gameplay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">Choose: Partner or Lone Wolf</p>
              <p className="text-muted-foreground">The Wolf can pick a partner after any tee shot—but once they skip someone, they can't pick them later. If the Wolf doesn't pick anyone, they become Lone Wolf.</p>
            </div>
            <div>
              <p className="font-semibold">Matchup for the hole</p>
              <p className="text-muted-foreground">• Wolf + chosen partner vs the other players</p>
              <p className="text-muted-foreground">• OR Lone Wolf vs everyone</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Points are customizable in settings. Default scoring:</p>
            <div className="space-y-1 mt-2">
              <div className="flex justify-between">
                <span>Lone Wolf win</span>
                <span className="font-bold text-green-600">+3 points</span>
              </div>
              <div className="flex justify-between">
                <span>Lone Wolf loss (each opponent)</span>
                <span className="font-bold text-red-600">+1 point</span>
              </div>
              <div className="flex justify-between">
                <span>Team win (each member)</span>
                <span className="font-bold text-blue-600">+1 point</span>
              </div>
              <div className="flex justify-between">
                <span>Losing team</span>
                <span className="text-muted-foreground">0 points</span>
              </div>
            </div>
            <p className="mt-3">After 18 holes, the player with the most points wins!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
