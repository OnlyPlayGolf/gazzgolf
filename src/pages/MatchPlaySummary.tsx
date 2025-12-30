import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { GameShareDialog } from "@/components/GameShareDialog";

export default function MatchPlaySummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData as MatchPlayGame);
      }

      const { data: holesData } = await supabase
        .from("match_play_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as MatchPlayHole[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const player1HolesWon = holes.filter(h => h.hole_result === 1).length;
  const player2HolesWon = holes.filter(h => h.hole_result === -1).length;
  const holesHalved = holes.filter(h => h.hole_result === 0).length;
  
  const player1TotalStrokes = holes.reduce((sum, h) => sum + (h.player_1_gross_score || 0), 0);
  const player2TotalStrokes = holes.reduce((sum, h) => sum + (h.player_2_gross_score || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-8">
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Match Play"
        courseName={game.course_name}
        roundName={game.round_name || undefined}
        winner={game.winner_player || undefined}
        resultText={game.final_result || `${player1HolesWon}-${player2HolesWon}`}
        additionalInfo={`${game.player_1} vs ${game.player_2}`}
        gameId={gameId}
        onContinue={() => navigate("/rounds-play")}
      />

      <div className="p-4 pt-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold">Match Complete</h1>
          <p className="text-muted-foreground">{game.course_name}</p>
        </div>

        {/* Result */}
        <Card className="p-6 text-center bg-primary/10">
          {game.winner_player ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">Winner</p>
              <p className="text-3xl font-bold text-primary">{game.winner_player}</p>
              <p className="text-xl font-semibold mt-2">{game.final_result}</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold">All Square</p>
              <p className="text-muted-foreground mt-2">The match ended in a tie</p>
            </>
          )}
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 text-center">
            <p className="font-semibold text-blue-600">{game.player_1}</p>
            <p className="text-3xl font-bold mt-2">{player1HolesWon}</p>
            <p className="text-xs text-muted-foreground">Holes Won</p>
            <p className="text-sm text-muted-foreground mt-2">{player1TotalStrokes} strokes</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-semibold text-red-600">{game.player_2}</p>
            <p className="text-3xl font-bold mt-2">{player2HolesWon}</p>
            <p className="text-xs text-muted-foreground">Holes Won</p>
            <p className="text-sm text-muted-foreground mt-2">{player2TotalStrokes} strokes</p>
          </Card>
        </div>

        <Card className="p-4 text-center">
          <p className="text-sm text-muted-foreground">Holes Halved</p>
          <p className="text-2xl font-bold">{holesHalved}</p>
        </Card>

        {/* Hole-by-Hole Scorecard */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Scorecard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Hole</th>
                  <th className="text-center py-2">{game.player_1}</th>
                  <th className="text-center py-2">{game.player_2}</th>
                  <th className="text-center py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((hole) => (
                  <tr key={hole.id} className="border-b">
                    <td className="py-2">{hole.hole_number}</td>
                    <td className="text-center py-2">{hole.player_1_gross_score}</td>
                    <td className="text-center py-2">{hole.player_2_gross_score}</td>
                    <td className="text-center py-2">
                      <span className={`font-medium ${
                        hole.hole_result === 1 ? 'text-blue-600' : 
                        hole.hole_result === -1 ? 'text-red-600' : 
                        'text-muted-foreground'
                      }`}>
                        {hole.hole_result === 1 ? 'W' : 
                         hole.hole_result === -1 ? 'L' : 
                         '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="text-center py-2">{player1TotalStrokes}</td>
                  <td className="text-center py-2">{player2TotalStrokes}</td>
                  <td className="text-center py-2">{player1HolesWon}-{player2HolesWon}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
