import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenGame, CopenhagenHole, Press } from "@/types/copenhagen";
import { Trophy, Share2, Home, Zap, Target } from "lucide-react";
import { CopenhagenShareDialog } from "@/components/CopenhagenShareDialog";

export default function CopenhagenSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          presses: (gameData.presses as unknown as Press[]) || [],
        });
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData.map(h => ({
          ...h,
          press_points: (h.press_points as Record<string, any>) || {},
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const players = [
    { name: game.player_1, points: game.player_1_total_points, color: "text-emerald-600", bg: "bg-emerald-500" },
    { name: game.player_2, points: game.player_2_total_points, color: "text-blue-600", bg: "bg-blue-500" },
    { name: game.player_3, points: game.player_3_total_points, color: "text-amber-600", bg: "bg-amber-500" },
  ].sort((a, b) => b.points - a.points);

  const sweeps = holes.filter(h => h.is_sweep);
  const totalPoints = players.reduce((sum, p) => sum + p.points, 0);
  const averagePoints = totalPoints / 3;

  return (
    <div className="min-h-screen pb-8 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Copenhagen</h1>
          <p className="text-muted-foreground">{game.course_name}</p>
          <p className="text-sm text-muted-foreground">{holes.length} holes played</p>
        </div>

        {/* Winner Card */}
        <Card className="bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
            <h2 className="text-2xl font-bold">{players[0].name}</h2>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{players[0].points} pts</p>
            {game.stake_per_point > 0 && (
              <p className="text-green-600 font-medium mt-1">
                +${((players[0].points - averagePoints) * game.stake_per_point).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Final Standings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Final Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, i) => {
              const winnings = (player.points - averagePoints) * game.stake_per_point;
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full ${player.bg} flex items-center justify-center text-white font-bold`}>
                      {i + 1}
                    </span>
                    <span className={`font-medium ${player.color}`}>{player.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{player.points}</div>
                    {game.stake_per_point > 0 && (
                      <div className={`text-sm ${winnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {winnings >= 0 ? '+' : ''}${winnings.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Target className="mx-auto text-amber-500 mb-1" size={24} />
              <div className="text-2xl font-bold">{sweeps.length}</div>
              <div className="text-xs text-muted-foreground">Sweeps</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Zap className="mx-auto text-blue-500 mb-1" size={24} />
              <div className="text-2xl font-bold">{game.presses.length}</div>
              <div className="text-xs text-muted-foreground">Presses</div>
            </div>
          </CardContent>
        </Card>

        {/* Press Results */}
        {game.presses.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Press Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {game.presses.map((press, i) => {
                const pressPlayers = [
                  { name: game.player_1, points: press.player_1_points },
                  { name: game.player_2, points: press.player_2_points },
                  { name: game.player_3, points: press.player_3_points },
                ].sort((a, b) => b.points - a.points);

                return (
                  <div key={press.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span>Press #{i + 1}</span>
                    <Badge variant="outline">{pressPlayers[0].name} wins</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={() => setShowShareDialog(true)} variant="outline" className="flex-1">
            <Share2 size={16} className="mr-2" />
            Share
          </Button>
          <Button onClick={() => navigate("/rounds-play")} className="flex-1">
            <Home size={16} className="mr-2" />
            Done
          </Button>
        </div>
      </div>

      {game && (
        <CopenhagenShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          game={game}
        />
      )}
    </div>
  );
}
