import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScorecardActions } from "@/components/ScorecardActions";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { ChevronDown } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useToast } from "@/hooks/use-toast";
import { GameHeader } from "@/components/GameHeader";
import { GameNotFound } from "@/components/GameNotFound";
import { useGameAdminStatus } from "@/hooks/useGameAdminStatus";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface TeamScore {
  team: ScrambleTeam;
  total: number;
  thru: number;
  toPar: number;
}

export default function ScrambleLeaderboard() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [teams, setTeams] = useState<ScrambleTeam[]>([]);
  const [holes, setHoles] = useState<ScrambleHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  
  // Check spectator status - for sorting leaderboard by position
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('scramble', gameId);
  const { isAdmin } = useGameAdminStatus('scramble', gameId);

  useEffect(() => {
    if (gameId) fetchData();
  }, [gameId]);

  const fetchData = async () => {
    // Fetch game
    const { data: gameData } = await supabase
      .from('scramble_games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();

    if (gameData) {
      setGame(gameData as unknown as ScrambleGame);
      const teamsData = (gameData.teams as unknown as ScrambleTeam[]) || [];
      setTeams(teamsData);
      // Auto-expand first team
      if (teamsData.length > 0) {
        setExpandedTeam(teamsData[0].id);
      }

      // Fetch course holes for scorecard structure
      if (gameData.course_id) {
        const { data: courseHolesData } = await supabase
          .from('course_holes')
          .select('hole_number, par, stroke_index')
          .eq('course_id', gameData.course_id)
          .order('hole_number');

        if (courseHolesData) {
          const filteredHoles = gameData.holes_played === 9 
            ? courseHolesData.slice(0, 9) 
            : courseHolesData;
          setCourseHoles(filteredHoles);
        }
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
    const unsortedScores = teams.map(team => {
      let total = 0;
      let thru = 0;
      let parTotal = 0;

      holes.forEach(hole => {
        const score = hole.team_scores[team.id];
        if (score !== null && score !== undefined) {
          // Only add positive scores to total (skip -1 dash scores)
          if (score > 0) {
            total += score;
            parTotal += hole.par;
          }
          thru++;
        }
      });

      return {
        team,
        total,
        thru,
        toPar: total - parTotal
      };
    });

    // Only sort in spectator mode
    if (isSpectator) {
      return unsortedScores.sort((a, b) => {
        if (a.total === 0 && b.total === 0) return 0;
        if (a.total === 0) return 1;
        if (b.total === 0) return -1;
        return a.total - b.total;
      });
    }
    return unsortedScores;
  };

  const formatToPar = (toPar: number): string => {
    if (toPar === 0) return 'E';
    if (toPar > 0) return `+${toPar}`;
    return toPar.toString();
  };

  const teamScores = calculateTeamScores();

  // Calculate positions with tie handling
  const getPositionLabel = (index: number): string => {
    if (teamScores[index].total === 0) return '-';
    
    const currentScore = teamScores[index].total;
    const firstWithSameScore = teamScores.findIndex(ts => ts.total === currentScore);
    const lastWithSameScore = teamScores.filter(ts => ts.total === currentScore).length;
    const position = firstWithSameScore + 1;
    
    if (lastWithSameScore > 1) {
      return `T${position}`;
    }
    return position.toString();
  };

  // Create a map for quick hole data lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getTeamScore = (holeNumber: number, teamId: string) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    const score = hole.team_scores[teamId];
    return score !== null && score !== undefined ? score : null;
  };

  const formatScore = (score: number | null): string => {
    if (score === null) return '';
    if (score === -1) return '–';
    return score.toString();
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p>Loading...</p>
      </div>
    );
  }

  const renderTeamCard = (ts: TeamScore, index: number) => {
    const isExpanded = expandedTeam === ts.team.id;
    const isLeader = index === 0 && ts.total > 0;

    return (
      <Card key={ts.team.id} className="overflow-hidden">
        {/* Team Info Bar - Clickable */}
        <div 
          className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedTeam(isExpanded ? null : ts.team.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown 
                size={20} 
                className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
              <div className={`bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold ${
                isLeader ? 'bg-amber-500/20 text-amber-600' : ''
              }`}>
                {getPositionLabel(index)}
              </div>
              <div>
                <div className="text-xl font-bold">{ts.team.name}</div>
                <div className="text-sm text-muted-foreground">
                  {ts.team.players.map(p => p.name.split(' ')[0]).join(', ')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {ts.thru > 0 ? formatToPar(ts.toPar) : 'E'}
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard Table - Only shown when expanded */}
        {isExpanded && courseHoles.length > 0 && (
          <>
            {/* Front 9 */}
            <div className="w-full">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                      {backNine.length > 0 ? '' : 'Tot'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                        {hole.stroke_index}
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                    <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {backNine.length > 0 ? '' : frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                    {frontNine.map(hole => {
                      const score = getTeamScore(hole.hole_number, ts.team.id);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className="text-center font-bold text-[10px] px-0 py-1"
                        >
                          {formatScore(score)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => {
                        const s = getTeamScore(h.hole_number, ts.team.id);
                        return sum + (s !== null && s > 0 ? s : 0);
                      }, 0) || ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                      {backNine.length > 0 ? '' : (ts.total || '')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Back 9 */}
            {backNine.length > 0 && (
              <div className="w-full border-t">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="bg-primary">
                      <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                      {backNine.map(hole => (
                        <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                          {hole.hole_number}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                      <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                          {hole.stroke_index}
                        </TableCell>
                      ))}
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                      <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                      {backNine.map(hole => (
                        <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                          {hole.par}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {courseHoles.reduce((sum, h) => sum + h.par, 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                      {backNine.map(hole => {
                        const score = getTeamScore(hole.hole_number, ts.team.id);
                        return (
                          <TableCell 
                            key={hole.hole_number} 
                            className="text-center font-bold text-[10px] px-0 py-1"
                          >
                            {formatScore(score)}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                        {backNine.reduce((sum, h) => {
                          const s = getTeamScore(h.hole_number, ts.team.id);
                          return sum + (s !== null && s > 0 ? s : 0);
                        }, 0) || ''}
                      </TableCell>
                      <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                        {ts.total || ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Per-scorecard actions */}
            <div className="px-4 pb-3">
              <ScorecardActions
                gameId={gameId!}
                gameType="scramble"
                scorecardPlayerId={ts.team.id}
                scorecardPlayerName={ts.team.name}
              />
            </div>
          </>
        )}
      </Card>
    );
  };

  // Prepare stroke play players from teams
  const strokePlayPlayers = teams.flatMap(team => 
    team.players.map(p => ({
      id: `${team.id}_${p.name}`,
      name: p.name,
      scores: new Map(
        holes.map(h => {
          const score = h.team_scores[team.id];
          return [h.hole_number, score && score > 0 ? score : 0];
        }).filter(([_, score]) => score > 0) as [number, number][]
      ),
    }))
  );

  const handleFinishGame = async () => {
    try {
      const winningTeam = teamScores[0]?.team?.name || null;
      await supabase.from("scramble_games").update({ is_finished: true, winning_team: winningTeam }).eq("id", gameId);
      toast({ title: "Game finished!" });
      navigate(`/scramble/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("scramble_holes").delete().eq("game_id", gameId);
      await supabase.from("scramble_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <GameHeader
        gameTitle={game.round_name || "Scramble"}
        courseName={game.course_name}
        pageTitle="Leaderboard"
        isAdmin={isAdmin}
        onFinish={handleFinishGame}
        onSaveAndExit={() => navigate('/profile')}
        onDelete={handleDeleteGame}
        gameName="Scramble Game"
      />

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {teamScores.map((ts, index) => renderTeamCard(ts, index))}
      </div>

      {gameId && !isSpectatorLoading && <ScrambleBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
