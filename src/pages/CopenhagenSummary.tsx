import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { Trophy, Target } from "lucide-react";
import { GameShareDialog } from "@/components/GameShareDialog";

export default function CopenhagenSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(true);

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
        setGame(gameData as CopenhagenGame);
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as CopenhagenHole[]);
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

  return (
    <div className="min-h-screen pb-8 bg-background">
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Copenhagen"
        courseName={game.course_name}
        winner={players[0].name}
        resultText={`${players[0].points} points`}
        additionalInfo={`${game.player_1}, ${game.player_2}, ${game.player_3}`}
        gameId={gameId}
        onContinue={() => navigate("/rounds-play")}
      />

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
          </CardContent>
        </Card>

        {/* Final Standings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Final Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full ${player.bg} flex items-center justify-center text-white font-bold`}>
                    {i + 1}
                  </span>
                  <span className={`font-medium ${player.color}`}>{player.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{player.points}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Stats</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="text-center p-3 rounded-lg bg-muted/50 w-full max-w-[200px]">
              <Target className="mx-auto text-amber-500 mb-1" size={24} />
              <div className="text-2xl font-bold">{sweeps.length}</div>
              <div className="text-xs text-muted-foreground">Sweeps</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
