import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface PlayerScore {
  name: string;
  scores: Map<number, number>;
  totalScore: number;
  team?: 'A' | 'B'; // Optional team assignment for coloring
}

interface StrokePlayScorecardViewProps {
  players: PlayerScore[];
  courseHoles: CourseHole[];
  showNetRow?: boolean; // Optional prop to control Net row visibility, defaults to true
  showTeamColors?: boolean; // Optional prop to enable team-based coloring
}

export function StrokePlayScorecardView({
  players,
  courseHoles,
  showNetRow = true, // Default to true to match RoundLeaderboard behavior
  showTeamColors = false, // Default to false for backward compatibility
}: StrokePlayScorecardViewProps) {
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
  const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
  const totalPar = frontNinePar + backNinePar;

  const getPlayerFrontNineTotal = (player: PlayerScore) => {
    return frontNine.reduce((sum, h) => {
      const score = player.scores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getPlayerBackNineTotal = (player: PlayerScore) => {
    return backNine.reduce((sum, h) => {
      const score = player.scores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
    if (nineHoles.length === 0) return null;

    const nineLabel = isBackNine ? 'In' : 'Out';
    const ninePar = isBackNine ? backNinePar : frontNinePar;

    return (
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
                {hole.hole_number}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">{nineLabel}</TableHead>
            <TableHead className="text-center font-bold text-[10px] px-0 py-1 bg-primary text-primary-foreground">
              {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                {hole.par}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {ninePar}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine ? totalPar : (hasBackNine ? '' : ninePar)}
            </TableCell>
          </TableRow>

          {players.flatMap((player, index) => {
            const nineTotal = isBackNine ? getPlayerBackNineTotal(player) : getPlayerFrontNineTotal(player);
            const teamColorClass = showTeamColors && player.team 
              ? (player.team === 'A' ? 'text-blue-600' : 'text-red-600')
              : '';
            
            return [
              <TableRow key={`player-${index}`}>
                <TableCell className={`font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate ${teamColorClass}`}>
                  {player.name.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => {
                  const score = player.scores.get(hole.hole_number);
                  return (
                    <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                      {score && score > 0 ? (
                        <ScorecardScoreCell score={score} par={hole.par} />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineTotal > 0 ? nineTotal : ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {(isBackNine || !hasBackNine) && player.totalScore > 0 ? player.totalScore : ''}
                </TableCell>
              </TableRow>,
              // Net row - conditionally shown based on showNetRow prop
              ...(showNetRow ? [<TableRow key={`net-${index}`}>
                <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Net</TableCell>
                {nineHoles.map(hole => {
                  const score = player.scores.get(hole.hole_number);
                  const hasScore = player.scores.has(hole.hole_number);
                  return (
                    <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                      {hasScore && score && score > 0 ? (
                        <ScorecardScoreCell score={score} par={hole.par} />
                      ) : hasScore ? (score === -1 ? '–' : '') : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineTotal > 0 ? nineTotal : ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {(isBackNine || !hasBackNine) && player.totalScore > 0 ? player.totalScore : ''}
                </TableCell>
              </TableRow>] : [])
            ];
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {renderNine(frontNine, false)}
      
      {hasBackNine && (
        <div className="border-t">
          {renderNine(backNine, true)}
        </div>
      )}
    </div>
  );
}
