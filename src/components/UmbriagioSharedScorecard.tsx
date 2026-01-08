import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
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

interface UmbriagioSharedScorecardProps {
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
}

// Truncate team name with ellipsis if too long
const truncateTeamName = (name: string, maxLength: number = 10) => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + "…";
};

export function UmbriagioSharedScorecard({ 
  game, 
  holes, 
  courseHoles,
}: UmbriagioSharedScorecardProps) {
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

  const getTeamFrontNineTotal = (team: 'A' | 'B') => {
    return frontNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, team) || 0), 0);
  };

  const getTeamBackNineTotal = (team: 'A' | 'B') => {
    return backNine.reduce((sum, h) => sum + (getTeamPoints(h.hole_number, team) || 0), 0);
  };

  const renderTeamRow = (team: 'A' | 'B', holeSet: CourseHole[], showTotal: boolean) => {
    const teamName = team === 'A' ? game.team_a_name : game.team_b_name;
    const totalForNine = holeSet === frontNine ? getTeamFrontNineTotal(team) : getTeamBackNineTotal(team);
    const grandTotal = team === 'A' ? normalizedA : normalizedB;

    return (
      <TableRow className="font-bold">
        <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate" title={teamName}>
          {truncateTeamName(teamName, 6)}
        </TableCell>
        {holeSet.map(hole => {
          const points = getTeamPoints(hole.hole_number, team);
          return (
            <TableCell 
              key={hole.hole_number} 
              className={`text-center font-bold text-[10px] px-0 py-1 ${
                points !== null && points > 0 ? 'text-green-600' : 
                points !== null && points < 0 ? 'text-red-600' : ''
              }`}
            >
              {points !== null ? (points > 0 ? `+${points}` : points) : ''}
            </TableCell>
          );
        })}
        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
          {totalForNine !== 0 ? totalForNine : ''}
        </TableCell>
        {showTotal && (
          <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
            {grandTotal}
          </TableCell>
        )}
      </TableRow>
    );
  };

  if (courseHoles.length === 0) return null;

  const hasBackNine = backNine.length > 0;

  // Calculate column count for consistent widths
  const holeCount = frontNine.length; // Should be 9 for a full course
  const totalColumns = holeCount + 2; // holes + label + out/in column (+ tot if needed)

  return (
    <div className="border rounded-lg overflow-hidden w-full">
      {/* Front 9 */}
      <div className="w-full">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
              {frontNine.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Out</TableHead>
              {!hasBackNine && (
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Tot</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
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
              {!hasBackNine && (
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {frontNine.reduce((sum, h) => sum + h.par, 0)}
                </TableCell>
              )}
            </TableRow>
            {renderTeamRow('A', frontNine, !hasBackNine)}
            {renderTeamRow('B', frontNine, !hasBackNine)}
          </TableBody>
        </Table>
      </div>

      {/* Back 9 */}
      {hasBackNine && (
        <div className="w-full border-t">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                {backNine.map(hole => (
                  <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                    {hole.hole_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">In</TableHead>
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Tot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
              {renderTeamRow('A', backNine, true)}
              {renderTeamRow('B', backNine, true)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
