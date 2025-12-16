import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { Trophy } from "lucide-react";

interface TeamScore {
  team: ScrambleTeam;
  total: number;
  thru: number;
  toPar: number;
}

export default function ScrambleLeaderboard() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  const [holes, setHoles] = useState<ScrambleHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<{ hole_number: number; par: number }[]>([]);

  useEffect(() => {
    if (gameId) fetchData();
  }, [gameId]);

  const fetchData = async () => {
    // Fetch game
    const { data: gameData } = await supabase
      .from('scramble_games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameData) {
      setGame(gameData as unknown as ScrambleGame);
      setTeams((gameData.teams as unknown as ScrambleTeam[]) || []);

      // Fetch course holes for par
      if (gameData.course_id) {
        const { data: holesData } = await supabase
          .from('course_holes')
          .select('hole_number, par')
          .eq('course_id', gameData.course_id)
          .order('hole_number');

        if (holesData) setCourseHoles(holesData);
      }
    }

    // Fetch hole scores
    const { data: scrambleHoles } = await supabase
      .from('scramble_holes')
      .select('*')
      .eq('game_id', gameId)
      .order('hole_number');

    if (scrambleHoles) {
      setHoles(scrambleHoles.map(h => ({
        ...h,
        team_scores: (h.team_scores as Record<string, number | null>) || {}
      })));
    }
  };

  const calculateTeamScores = (): TeamScore[] => {
    return teams.map(team => {
      let total = 0;
      let thru = 0;
      let parTotal = 0;

      holes.forEach(hole => {
        const score = hole.team_scores[team.id];
        if (score !== null && score !== undefined) {
          total += score;
          thru++;
          parTotal += hole.par;
        }
      });

      return {
        team,
        total,
        thru,
        toPar: total - parTotal
      };
    }).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });
  };

  const formatToPar = (toPar: number): string => {
    if (toPar === 0) return 'E';
    if (toPar > 0) return `+${toPar}`;
    return toPar.toString();
  };

  const teamScores = calculateTeamScores();

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-4">
        <h1 className="text-xl font-bold text-center">Leaderboard</h1>
      </div>

      <div className="p-4">
        <Card>
          <CardContent className="p-0">
            {teamScores.map((ts, index) => (
              <div
                key={ts.team.id}
                className={`flex items-center justify-between p-4 ${
                  index !== teamScores.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 && ts.total > 0 ? 'bg-yellow-500 text-white' : 'bg-muted'
                  }`}>
                    {index === 0 && ts.total > 0 ? <Trophy size={16} /> : index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{ts.team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ts.team.players.map(p => p.name).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{ts.total || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    {ts.thru > 0 ? `${formatToPar(ts.toPar)} (Thru ${ts.thru})` : 'Not started'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Hole-by-hole scores */}
        {holes.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Scorecard</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4">Team</th>
                      {holes.map(h => (
                        <th key={h.hole_number} className="text-center px-2 py-2">
                          {h.hole_number}
                        </th>
                      ))}
                      <th className="text-center px-2 py-2 font-bold">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-muted/50">
                      <td className="py-2 pr-4 text-muted-foreground">Par</td>
                      {holes.map(h => (
                        <td key={h.hole_number} className="text-center px-2 py-2 text-muted-foreground">
                          {h.par}
                        </td>
                      ))}
                      <td className="text-center px-2 py-2 text-muted-foreground font-bold">
                        {holes.reduce((sum, h) => sum + h.par, 0)}
                      </td>
                    </tr>
                    {teams.map(team => (
                      <tr key={team.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{team.name}</td>
                        {holes.map(h => {
                          const score = h.team_scores[team.id];
                          const diff = score !== null && score !== undefined ? score - h.par : null;
                          return (
                            <td key={h.hole_number} className="text-center px-2 py-2">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${
                                diff === null ? '' :
                                diff <= -2 ? 'bg-yellow-500 text-white' :
                                diff === -1 ? 'bg-red-500 text-white' :
                                diff === 0 ? '' :
                                diff === 1 ? 'bg-blue-500/20' :
                                'bg-blue-500/40'
                              }`}>
                                {score !== null && score !== undefined ? score : '-'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-2 font-bold">
                          {holes.reduce((sum, h) => sum + (h.team_scores[team.id] || 0), 0) || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ScrambleBottomTabBar gameId={gameId!} />
    </div>
  );
}
