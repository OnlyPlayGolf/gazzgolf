import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { GameShareDialog } from "@/components/GameShareDialog";

export default function WolfSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<WolfGame | null>(null);
  const [holes, setHoles] = useState<WolfHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("wolf_games" as any)
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      const typedGame = gameData as unknown as WolfGame;
      setGame(typedGame);

      const { data: holesData, error: holesError } = await supabase
        .from("wolf_holes" as any)
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      setHoles((holesData || []) as unknown as WolfHole[]);

      // Mark game as finished
      if (!typedGame.is_finished) {
        const points = [
          typedGame.player_1_points,
          typedGame.player_2_points,
          typedGame.player_3_points,
          typedGame.player_4_points || 0,
          typedGame.player_5_points || 0,
        ];
        const maxPoints = Math.max(...points);
        const winnerIndex = points.indexOf(maxPoints);
        const winnerName = [
          typedGame.player_1,
          typedGame.player_2,
          typedGame.player_3,
          typedGame.player_4,
          typedGame.player_5,
        ][winnerIndex];

        await supabase
          .from("wolf_games" as any)
          .update({ is_finished: true, winner_player: winnerName })
          .eq("id", gameId);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
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

  const getPlayerCount = () => {
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };

  const playerCount = getPlayerCount();
  const players = [
    { name: game.player_1, points: game.player_1_points },
    { name: game.player_2, points: game.player_2_points },
    { name: game.player_3, points: game.player_3_points },
    { name: game.player_4 || '', points: game.player_4_points },
    { name: game.player_5 || '', points: game.player_5_points },
  ].slice(0, playerCount).sort((a, b) => b.points - a.points);

  const winner = players[0];

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Wolf"
        courseName={game.course_name}
        winner={winner.name}
        resultText={`${winner.points} points`}
        additionalInfo={`${playerCount} players`}
        onContinue={() => navigate("/rounds-play")}
      />

      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds-play')} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Wolf Summary</h1>
        </div>

        {/* Winner Card */}
        <Card className="p-6 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/30">
          <div className="text-center">
            <Trophy className="w-12 h-12 mx-auto text-amber-500 mb-2" />
            <h2 className="text-2xl font-bold text-amber-600">Winner: {winner.name}</h2>
            <p className="text-3xl font-bold mt-2">{winner.points} points</p>
          </div>
        </Card>

        {/* Final Standings */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 text-lg">Final Standings</h3>
          <div className="space-y-3">
            {players.map((player, index) => (
              <div 
                key={index} 
                className={`flex justify-between items-center p-3 rounded ${
                  index === 0 ? 'bg-amber-500/10' : ''
                }`}
              >
                <span className="font-medium">
                  {index + 1}. {player.name}
                </span>
                <span className="font-bold text-lg">{player.points} pts</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Game Info */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Game Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Course</span>
              <span>{game.course_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holes Played</span>
              <span>{holes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{new Date(game.date_played).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
