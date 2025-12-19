import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { Trophy, ArrowRight } from "lucide-react";

export default function SkinsFeed() {
  const { gameId } = useParams();
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          players: (gameData.players as unknown as SkinsPlayer[]) || [],
          handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
        });
      }

      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number", { ascending: false });

      if (holesData) {
        setHoles(holesData.map(h => ({
          ...h,
          player_scores: (h.player_scores as unknown as Record<string, SkinsPlayerScore>) || {},
        })));
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Game Feed</h1>

        {holes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No holes played yet</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {holes.map((hole) => {
              const scores = Object.entries(hole.player_scores);
              const useNet = game.use_handicaps && game.handicap_mode === 'net';
              
              // Sort by score (lowest first)
              const sortedScores = [...scores].sort((a, b) => {
                const scoreA = useNet ? a[1].net : a[1].gross;
                const scoreB = useNet ? b[1].net : b[1].gross;
                return scoreA - scoreB;
              });

              return (
                <Card key={hole.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">Hole {hole.hole_number}</span>
                      <span className="text-sm text-muted-foreground">Par {hole.par}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hole.skins_available > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {hole.skins_available} skins
                        </Badge>
                      )}
                      {hole.winner_player ? (
                        <Badge className="bg-amber-500">
                          <Trophy size={12} className="mr-1" />
                          WON
                        </Badge>
                      ) : hole.is_carryover ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          <ArrowRight size={12} className="mr-1" />
                          CARRYOVER
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          TIE
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sortedScores.map(([playerName, score], idx) => {
                      const isWinner = hole.winner_player === playerName;
                      const displayScore = useNet ? score.net : score.gross;
                      
                      return (
                        <div 
                          key={playerName} 
                          className={`flex items-center justify-between p-2 rounded ${
                            isWinner ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isWinner && <Trophy size={16} className="text-amber-600" />}
                            <span className={`font-medium ${isWinner ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                              {playerName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{displayScore}</span>
                            {game.use_handicaps && score.net !== score.gross && (
                              <span className="text-xs text-muted-foreground">
                                (gross: {score.gross})
                              </span>
                            )}
                            {isWinner && (
                              <span className="text-sm font-semibold text-amber-600">
                                +{hole.skins_available}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hole.is_carryover && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground text-center">
                      Skin carries over to next hole
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
