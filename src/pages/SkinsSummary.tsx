import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trophy, Users, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkinsGame, SkinsHole, SkinsPlayer, SkinsPlayerScore } from "@/types/skins";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { calculateSkinsLeaderboard } from "@/utils/skinsScoring";

export default function SkinsSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: SkinsGame = {
        ...gameData,
        players: (gameData.players as unknown as SkinsPlayer[]) || [],
        handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
      };
      
      setGame(typedGame);

      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");
      
      const typedHoles: SkinsHole[] = (holesData || []).map(h => ({
        ...h,
        player_scores: (h.player_scores as unknown as Record<string, SkinsPlayerScore>) || {},
      }));
      
      setHoles(typedHoles);
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading summary...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const leaderboard = calculateSkinsLeaderboard(
    game.players,
    holes.map(h => ({
      hole_number: h.hole_number,
      winner_player: h.winner_player,
      skins_available: h.skins_available,
    })),
    game.skin_value
  );

  const winner = leaderboard[0];
  const totalSkinsAwarded = leaderboard.reduce((sum, p) => sum + p.skinsWon, 0);
  const skinsCarriedOver = holes.filter(h => h.is_carryover).length;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/rounds-play")}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Skins Summary</h1>
              <p className="text-sm text-muted-foreground">{game.course_name}</p>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Share2 size={20} />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Winner Card */}
        {winner && winner.skinsWon > 0 && (
          <Card className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-amber-200 dark:border-amber-800">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                {winner.playerName}
              </h2>
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                {winner.skinsWon} Skin{winner.skinsWon > 1 ? 's' : ''} Won
              </p>
              {game.skin_value > 0 && (
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300 mt-2">
                  ${winner.totalValue.toFixed(2)}
                </p>
              )}
              <Badge variant="outline" className="mt-2 text-amber-600 border-amber-300">
                {winner.groupName}
              </Badge>
            </div>
          </Card>
        )}

        {/* Game Stats */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Game Stats</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Holes Played</span>
              <p className="font-medium">{holes.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Players</span>
              <p className="font-medium">{game.players.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Skins Awarded</span>
              <p className="font-medium">{totalSkinsAwarded}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ties (Carryovers)</span>
              <p className="font-medium">{skinsCarriedOver}</p>
            </div>
          </div>
        </Card>

        {/* Leaderboard */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Leaderboard</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={14} />
              <span>All groups combined</span>
            </div>
          </div>
          <div className="space-y-3">
            {leaderboard.map((entry, index) => (
              <div 
                key={entry.playerName}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 && entry.skinsWon > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold w-6 text-center ${
                    index === 0 && entry.skinsWon > 0 ? 'text-amber-600' : 'text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{entry.playerName}</p>
                    <p className="text-xs text-muted-foreground">{entry.groupName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {entry.skinsWon} Skin{entry.skinsWon !== 1 ? 's' : ''}
                  </p>
                  {game.skin_value > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ${entry.totalValue.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Hole-by-Hole Results */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Hole-by-Hole Results</h3>
          <div className="space-y-2">
            {holes.map((hole) => (
              <div 
                key={hole.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-12">
                    Hole {hole.hole_number}
                  </span>
                  {hole.skins_available > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {hole.skins_available} skins
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  {hole.winner_player ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {hole.winner_player}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {hole.is_carryover ? 'Carryover' : 'No winner'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Play Again */}
        <Button
          onClick={() => navigate("/skins/setup")}
          variant="outline"
          className="w-full"
        >
          Play Another Skins Game
        </Button>
      </div>

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
