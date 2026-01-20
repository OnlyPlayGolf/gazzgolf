import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { Trophy, ArrowLeft } from "lucide-react";
import { GameShareDialog } from "@/components/GameShareDialog";

export default function ScrambleSummary() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  const [holes, setHoles] = useState<ScrambleHole[]>([]);
  const [showShareDialog, setShowShareDialog] = useState(true);

  useEffect(() => {
    if (gameId) fetchData();
  }, [gameId]);

  const fetchData = async () => {
    const { data: gameData } = await supabase
      .from('scramble_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData as unknown as ScrambleGame);
      setTeams((gameData.teams as unknown as ScrambleTeam[]) || []);
    }

    const { data: scrambleHoles } = await supabase
      .from('scramble_holes')
      .select('*')
      .eq('game_id', gameId)
      .order('hole_number');

    if (scrambleHoles) {
      setHoles(scrambleHoles.map(h => ({
        ...h,
        team_scores: (h.team_scores as Record<string, number | null>) || {},
        team_tee_shots: ((h as Record<string, unknown>).team_tee_shots as Record<string, string>) || {}
      })));
    }
  };

  const calculateTeamTotal = (teamId: string): number => {
    return holes.reduce((total, hole) => {
      const score = hole.team_scores[teamId];
      return total + (score || 0);
    }, 0);
  };

  const calculateTotalPar = (): number => {
    return holes.reduce((total, hole) => total + hole.par, 0);
  };

  const formatToPar = (total: number, par: number): string => {
    const diff = total - par;
    if (diff === 0) return 'E';
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const totalPar = calculateTotalPar();
  const sortedTeams = [...teams].sort((a, b) => {
    const aTotal = calculateTeamTotal(a.id);
    const bTotal = calculateTeamTotal(b.id);
    if (aTotal === 0 && bTotal === 0) return 0;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;
    return aTotal - bTotal;
  });

  const winner = sortedTeams[0];
  const winnerTotal = calculateTeamTotal(winner?.id || '');

  return (
    <div className="min-h-screen bg-background pb-6">
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Scramble"
        courseName={game.course_name}
        roundName={game.round_name || undefined}
        winner={winner?.name}
        resultText={winnerTotal > 0 ? `${winnerTotal} (${formatToPar(winnerTotal, totalPar)})` : undefined}
        additionalInfo={winner?.players.map(p => p.name).join(', ')}
        gameId={gameId}
        onContinue={() => navigate("/rounds-play")}
      />

      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rounds-play')} className="text-primary-foreground">
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-xl font-bold">Game Summary</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Winner Card */}
        <Card className="bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 border-yellow-500/50">
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
            <h2 className="text-2xl font-bold">{winner?.name || 'No Winner'}</h2>
            <p className="text-muted-foreground mb-2">
              {winner?.players.map(p => p.name).join(', ')}
            </p>
            <div className="text-4xl font-bold">
              {winnerTotal > 0 ? winnerTotal : '-'}
            </div>
            {winnerTotal > 0 && (
              <p className="text-lg text-muted-foreground">
                {formatToPar(winnerTotal, totalPar)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* All Teams */}
        <Card>
          <CardHeader>
            <CardTitle>Final Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTeams.map((team, index) => {
              const total = calculateTeamTotal(team.id);
              return (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 && total > 0 ? 'bg-yellow-500 text-white' :
                      index === 1 && total > 0 ? 'bg-gray-400 text-white' :
                      index === 2 && total > 0 ? 'bg-amber-700 text-white' :
                      'bg-muted-foreground/20'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.players.map(p => p.name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{total || '-'}</p>
                    {total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatToPar(total, totalPar)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Game Info */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Course</p>
                <p className="font-medium">{game.course_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{new Date(game.date_played).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Holes</p>
                <p className="font-medium">{game.holes_played}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Par</p>
                <p className="font-medium">{totalPar}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
