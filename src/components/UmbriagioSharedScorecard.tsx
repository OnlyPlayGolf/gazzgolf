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
        <TableCell className="font-bold text-xs px-1 py-1.5 sticky left-0 bg-background z-10 max-w-[60px] truncate" title={teamName}>
          {truncateTeamName(teamName)}
        </TableCell>
        {holeSet.map(hole => {
          const points = getTeamPoints(hole.hole_number, team);
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
          {totalForNine !== 0 ? totalForNine : ''}
        </TableCell>
        {showTotal && (
          <TableCell className="text-center font-bold bg-primary/10 text-xs px-1 py-1.5">
            {grandTotal}
          </TableCell>
        )}
      </TableRow>
    );
  };

  if (courseHoles.length === 0) return null;

  const hasBackNine = backNine.length > 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Front 9 */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10 min-w-[60px]">Hole</TableHead>
              {frontNine.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Out</TableHead>
              {!hasBackNine && (
                <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Tot</TableHead>
              )}
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
              {!hasBackNine && (
                <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
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
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-center font-bold text-xs px-1 py-2 sticky left-0 bg-primary/5 z-10 min-w-[60px]">Hole</TableHead>
                {backNine.map(hole => (
                  <TableHead key={hole.hole_number} className="text-center font-bold text-xs px-2 py-2 w-[32px]">
                    {hole.hole_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">In</TableHead>
                <TableHead className="text-center font-bold text-xs px-2 py-2 bg-primary/10 w-[36px]">Tot</TableHead>
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
                <TableCell className="text-center font-bold bg-muted text-xs px-1 py-1.5">
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
