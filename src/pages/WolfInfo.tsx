import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { supabase } from "@/integrations/supabase/client";
import { GameHeader } from "@/components/GameHeader";

export default function WolfInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('wolf', gameId);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        const { data } = await supabase
          .from("wolf_games")
          .select("round_name, course_name")
          .eq("id", gameId)
          .maybeSingle();
        if (data) setGameData(data);
      };
      fetchGameData();
    }
  }, [gameId]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader 
        gameTitle={gameData?.round_name || "Wolf"} 
        courseName={gameData?.course_name || ""} 
        pageTitle="Game info" 
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Wolf
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Wolf is a golf betting game for 4-6 players where one player each hole becomes the "Wolf" and decides whether to team up or go solo. The player with the most points after 18 holes wins.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Setup</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Works with 4-6 players</li>
                <li>• On the 1st tee, set a fixed player order (randomized in the app)</li>
                <li>• The Wolf rotates each hole</li>
                <li>• The Wolf tees off first or last, depending on settings</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Gameplay</h3>
              <p className="text-sm text-muted-foreground">
                <strong>Choose: Partner or Lone Wolf</strong> – The Wolf can pick a partner after any tee shot—but once they skip someone, they can't pick them later. If the Wolf doesn't pick anyone, they become Lone Wolf.
              </p>
              <p className="text-sm text-muted-foreground pt-2">
                <strong>Matchup for the hole:</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Wolf + chosen partner vs the other players</li>
                <li>• OR Lone Wolf vs everyone</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Scoring</h3>
              <p className="text-sm text-muted-foreground">Points are customizable in settings. Default scoring:</p>
              <div className="space-y-1 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lone Wolf win</span>
                  <span className="font-semibold text-green-600">+3 points</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lone Wolf loss (each opponent)</span>
                  <span className="font-semibold text-red-600">+1 point</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Team win (each member)</span>
                  <span className="font-semibold text-blue-600">+1 point</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Losing team</span>
                  <span className="text-muted-foreground">0 points</span>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Double</h3>
              <p className="text-sm text-muted-foreground">
                The Double option allows players to raise the stakes on any hole.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 pt-1">
                <li>• <strong>Who can double first:</strong> The team/player with the fewest players tees off first and has the first opportunity to call Double.</li>
                <li>• <strong>Double Back:</strong> After a Double is called, the other team/player can respond with a Double Back to accept the challenge.</li>
                <li>• <strong>Effect:</strong> When Double is called, the points for that hole are doubled. All point values are multiplied by 2.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {gameId && !isSpectatorLoading && <WolfBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
