import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { Trophy } from "lucide-react";
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

interface UmbriagioScorecardProps {
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
  currentUserTeam?: 'A' | 'B' | null;
}

export function UmbriagioScorecard({ 
  game, 
  holes, 
  courseHoles,
  currentUserTeam 
}: UmbriagioScorecardProps) {
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(
    game.team_a_total_points, 
    game.team_b_total_points
  );

  const getTeamPoints = (holeNumber: number, team: 'A' | 'B') => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return team === 'A' ? hole.team_a_hole_points : hole.team_b_hole_points;
  };

  // Determine which team to display - prioritize currentUserTeam, fall back to winning team, then A
  const displayTeam = currentUserTeam || game.winning_team || 'A';
  const teamToShow = displayTeam === 'TIE' ? 'A' : displayTeam;

  const teamName = teamToShow === 'A' ? game.team_a_name : game.team_b_name;
  const player1 = teamToShow === 'A' ? game.team_a_player_1 : game.team_b_player_1;
  const player2 = teamToShow === 'A' ? game.team_a_player_2 : game.team_b_player_2;
  const teamPoints = teamToShow === 'A' ? normalizedA : normalizedB;
  const isWinner = game.winning_team === teamToShow || (game.winning_team === 'TIE' && teamToShow);

  const getWinnerText = () => {
    if (game.winning_team === 'TIE') return 'Tie Game!';
    if (game.winning_team === teamToShow) return 'Winner!';
    return '';
  };

  return (
    <div className="space-y-4">
      {/* Result Header */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(isWinner && game.winning_team !== 'TIE') && (
              <div className="p-2 rounded-full bg-amber-500/20">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg">{teamName}</p>
              <p className="text-sm text-muted-foreground">{player1} & {player2}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{teamPoints}</p>
            <p className="text-sm text-muted-foreground">
              {getWinnerText() || 'Points'}
            </p>
          </div>
        </div>
        
        {/* Score vs Opponent */}
        <div className="mt-3 pt-3 border-t flex justify-center gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-500">{normalizedA}</p>
            <p className="text-xs text-muted-foreground">Team A</p>
          </div>
          <span className="text-lg font-bold text-muted-foreground self-center">vs</span>
          <div>
            <p className="text-2xl font-bold text-red-500">{normalizedB}</p>
            <p className="text-xs text-muted-foreground">Team B</p>
          </div>
        </div>
      </div>

      {/* Scorecard */}
      {courseHoles.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Front 9 */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                  {frontNine.map(hole => (
                    <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                      {hole.hole_number}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                  {frontNine.map(hole => (
                    <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                      {hole.par}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                    {frontNine.reduce((sum, h) => sum + h.par, 0)}
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold">
                  <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                  {frontNine.map(hole => {
                    const points = getTeamPoints(hole.hole_number, teamToShow);
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-xs px-1 py-1.5 ${
                          points !== null && points > 0 ? 'text-green-600' : 
                          points !== null && points < 0 ? 'text-red-600' : ''
                        }`}
                      >
                        {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                    {frontNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, teamToShow) || 0), 0) || ''}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Back 9 */}
          {backNine.length > 0 && (
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10">Hole</TableHead>
                    {backNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Par</TableCell>
                    {backNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-xs px-1 py-1.5">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {backNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10">Points</TableCell>
                    {backNine.map(hole => {
                      const points = getTeamPoints(hole.hole_number, teamToShow);
                      return (
                        <TableCell 
                          key={hole.hole_number} 
                          className={`text-center font-bold text-xs px-1 py-1.5 ${
                            points !== null && points > 0 ? 'text-green-600' : 
                            points !== null && points < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {points !== null ? (points > 0 ? `+${points}` : points) : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
                      {backNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, teamToShow) || 0), 0) || ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Total Row */}
          <div className="border-t bg-muted/50 p-2 flex justify-between items-center px-4">
            <span className="font-bold text-sm">Total</span>
            <span className="font-bold text-lg">{teamPoints} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}
