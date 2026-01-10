import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { MatchPlayCompletionModal } from "@/components/MatchPlayCompletionModal";
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

export default function MatchPlaySummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [holes, setHoles] = useState<MatchPlayHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(true);

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

        if (gameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", gameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = gameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
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

  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getPlayerScore = (holeNumber: number, player: 1 | 2) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return player === 1 ? hole.player_1_gross_score : hole.player_2_gross_score;
  };

  const getHoleResult = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.hole_result || 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-8">
      <MatchPlayCompletionModal
        open={showCompletionModal}
        onOpenChange={setShowCompletionModal}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
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

        {/* Hole-by-Hole Scorecard - Umbriago Style */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Scorecard</h3>
          
          {/* Front 9 */}
          <div className="border rounded-lg overflow-hidden w-full">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                  {frontNine.map(hole => (
                    <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                      {hole.hole_number}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Out</TableHead>
                  {backNine.length > 0 && <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                  {frontNine.map(hole => (
                    <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                      {hole.par}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {frontNine.reduce((sum, h) => sum + h.par, 0)}
                  </TableCell>
                  {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">{game.player_1.split(' ')[0]}</TableCell>
                  {frontNine.map(hole => {
                    const score = getPlayerScore(hole.hole_number, 1);
                    const result = getHoleResult(hole.hole_number);
                    return (
                      <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${result === 1 ? 'bg-blue-100 dark:bg-blue-900/30 font-bold' : ''}`}>
                        {score || ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {frontNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 1) || 0), 0) || ''}
                  </TableCell>
                  {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">{game.player_2.split(' ')[0]}</TableCell>
                  {frontNine.map(hole => {
                    const score = getPlayerScore(hole.hole_number, 2);
                    const result = getHoleResult(hole.hole_number);
                    return (
                      <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${result === -1 ? 'bg-red-100 dark:bg-red-900/30 font-bold' : ''}`}>
                        {score || ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {frontNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 2) || 0), 0) || ''}
                  </TableCell>
                  {backNine.length > 0 && <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Back 9 */}
          {backNine.length > 0 && (
            <div className="border rounded-lg overflow-hidden w-full mt-2">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 w-[44px]">Hole</TableHead>
                    {backNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">In</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary/10">Tot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0 py-1 w-[44px]">Par</TableCell>
                    {backNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {backNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0) + backNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 w-[44px] truncate">{game.player_1.split(' ')[0]}</TableCell>
                    {backNine.map(hole => {
                      const score = getPlayerScore(hole.hole_number, 1);
                      const result = getHoleResult(hole.hole_number);
                      return (
                        <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${result === 1 ? 'bg-blue-100 dark:bg-blue-900/30 font-bold' : ''}`}>
                          {score || ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {backNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 1) || 0), 0) || ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {player1TotalStrokes || ''}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 w-[44px] truncate">{game.player_2.split(' ')[0]}</TableCell>
                    {backNine.map(hole => {
                      const score = getPlayerScore(hole.hole_number, 2);
                      const result = getHoleResult(hole.hole_number);
                      return (
                        <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${result === -1 ? 'bg-red-100 dark:bg-red-900/30 font-bold' : ''}`}>
                          {score || ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {backNine.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 2) || 0), 0) || ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {player2TotalStrokes || ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
