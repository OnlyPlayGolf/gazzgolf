import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { formatMatchStatus } from "@/utils/bestBallScoring";
import { Trophy, Users } from "lucide-react";
import { GameShareDialog } from "@/components/GameShareDialog";

export default function BestBallSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [holes, setHoles] = useState<BestBallHole[]>([]);
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
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        const typedGame: BestBallGame = {
          ...gameData,
          game_type: (gameData.game_type as BestBallGameType) || 'match',
          team_a_players: gameData.team_a_players as unknown as BestBallPlayer[],
          team_b_players: gameData.team_b_players as unknown as BestBallPlayer[],
          winner_team: gameData.winner_team as 'A' | 'B' | 'TIE' | null,
        };
        setGame(typedGame);
      }

      const { data: holesData } = await supabase
        .from("best_ball_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: BestBallHole[] = holesData.map(h => ({
          ...h,
          team_a_scores: h.team_a_scores as unknown as BestBallPlayerScore[],
          team_b_scores: h.team_b_scores as unknown as BestBallPlayerScore[],
        }));
        setHoles(typedHoles);
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

  const isMatchPlay = game.game_type === 'match';
  const teamAHolesWon = holes.filter(h => h.hole_result === 1).length;
  const teamBHolesWon = holes.filter(h => h.hole_result === -1).length;
  const halvesCount = holes.filter(h => h.hole_result === 0).length;

  let winner: 'A' | 'B' | 'TIE' | null = null;
  let resultText = '';
  
  if (isMatchPlay) {
    if (game.match_status > 0) {
      winner = 'A';
      resultText = formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name);
    } else if (game.match_status < 0) {
      winner = 'B';
      resultText = formatMatchStatus(game.match_status, game.holes_remaining, game.team_a_name, game.team_b_name);
    } else {
      winner = 'TIE';
      resultText = 'All Square';
    }
  } else {
    if (game.team_a_total < game.team_b_total) {
      winner = 'A';
      resultText = `${game.team_a_name} wins by ${game.team_b_total - game.team_a_total} strokes`;
    } else if (game.team_b_total < game.team_a_total) {
      winner = 'B';
      resultText = `${game.team_b_name} wins by ${game.team_a_total - game.team_b_total} strokes`;
    } else {
      winner = 'TIE';
      resultText = 'Match Tied';
    }
  }

  const winnerName = winner === 'A' ? game.team_a_name : winner === 'B' ? game.team_b_name : undefined;

  return (
    <div className="min-h-screen bg-background">
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Best Ball"
        courseName={game.course_name}
        winner={winnerName}
        resultText={resultText}
        additionalInfo={`${game.team_a_name} vs ${game.team_b_name}`}
        gameId={gameId}
        onContinue={() => navigate("/rounds-play")}
      />

      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto mb-2" />
        <h1 className="text-2xl font-bold mb-1">Game Complete</h1>
        <p className="text-sm opacity-90">{game.course_name}</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Result */}
        <Card className="p-6 text-center">
          {winner !== 'TIE' && winnerName && (
            <div className="text-3xl font-bold text-primary mb-2">{winnerName}</div>
          )}
          <div className="text-xl font-semibold">{resultText}</div>
        </Card>

        {/* Team Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={`p-4 ${winner === 'A' ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-bold">{game.team_a_name}</h3>
            </div>
            <div className="text-3xl font-bold text-center mb-2">
              {isMatchPlay ? teamAHolesWon : game.team_a_total}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {isMatchPlay ? 'holes won' : 'total strokes'}
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users size={14} />
                <span>{game.team_a_players.map(p => p.displayName).join(', ')}</span>
              </div>
            </div>
          </Card>

          <Card className={`p-4 ${winner === 'B' ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="font-bold">{game.team_b_name}</h3>
            </div>
            <div className="text-3xl font-bold text-center mb-2">
              {isMatchPlay ? teamBHolesWon : game.team_b_total}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {isMatchPlay ? 'holes won' : 'total strokes'}
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users size={14} />
                <span>{game.team_b_players.map(p => p.displayName).join(', ')}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Stats */}
        <Card className="p-4">
          <h3 className="font-bold mb-3">Game Statistics</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{holes.length}</div>
              <div className="text-sm text-muted-foreground">Holes Played</div>
            </div>
            {isMatchPlay && (
              <>
                <div>
                  <div className="text-2xl font-bold">{halvesCount}</div>
                  <div className="text-sm text-muted-foreground">Halves</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{Math.abs(game.match_status)}</div>
                  <div className="text-sm text-muted-foreground">Final Margin</div>
                </div>
              </>
            )}
            {!isMatchPlay && (
              <>
                <div>
                  <div className="text-2xl font-bold">{game.team_a_total}</div>
                  <div className="text-sm text-muted-foreground">{game.team_a_name}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{game.team_b_total}</div>
                  <div className="text-sm text-muted-foreground">{game.team_b_name}</div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Actions */}
        <Button 
          className="w-full"
          onClick={() => navigate(`/best-ball/${gameId}/leaderboard`)}
        >
          View Full Scorecard
        </Button>
      </div>
    </div>
  );
}
