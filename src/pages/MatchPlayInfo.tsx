import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { supabase } from "@/integrations/supabase/client";
import { GameHeader } from "@/components/GameHeader";

export default function MatchPlayInfo() {
  const { gameId } = useParams();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('match_play', gameId);
  const [gameData, setGameData] = useState<{ round_name: string | null; course_name: string } | null>(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameData = async () => {
        const { data } = await supabase
          .from("match_play_games")
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
        gameTitle={gameData?.round_name || "Match Play"} 
        courseName={gameData?.course_name || ""} 
        pageTitle="Game info" 
      />
      <div className="p-4 max-w-2xl mx-auto">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">How to Play</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Match Play</strong> is a head-to-head format where two players (or teams) 
              compete hole-by-hole. The player with the lowest score on each hole wins that hole.
            </p>
            <p>
              The match is scored by holes won, not total strokes. A player can be "2 Up" 
              (leading by 2 holes) or the match can be "All Square" (tied).
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Winning the Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The match ends when one player is up more holes than there are holes remaining. 
              For example, if a player is 3 Up with 2 holes to play, they win "3 & 2".
            </p>
            <p>
              If the match is tied after 18 holes, it ends "All Square" (unless you play extra holes).
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Terminology</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>All Square:</strong> The match is tied</p>
            <p><strong>1 Up, 2 Up, etc.:</strong> Leading by that many holes</p>
            <p><strong>Dormie:</strong> Up by same number of holes remaining (cannot lose, only tie or win)</p>
            <p><strong>3 & 2:</strong> Won match 3 up with 2 holes remaining</p>
            <p><strong>Halved:</strong> A hole where both players have the same score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Handicaps (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              When playing with handicaps, strokes are allocated based on the handicap difference 
              and the stroke index of each hole. The higher handicap player receives strokes on 
              the hardest-rated holes first.
            </p>
          </CardContent>
        </Card>
      </div>

      {gameId && !isSpectatorLoading && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
