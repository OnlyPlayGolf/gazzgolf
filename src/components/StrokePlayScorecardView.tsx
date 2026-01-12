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

interface PlayerScore {
  name: string;
  scores: Map<number, number>;
  totalScore: number;
}

interface StrokePlayScorecardViewProps {
  players: PlayerScore[];
  courseHoles: CourseHole[];
}

export function StrokePlayScorecardView({
  players,
  courseHoles,
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
          <TableRow className="bg-primary/5">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                {hole.hole_number}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">{nineLabel}</TableHead>
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
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

          {players.map((player, index) => {
            const nineTotal = isBackNine ? getPlayerBackNineTotal(player) : getPlayerFrontNineTotal(player);
            
            return (
              <TableRow key={index}>
                <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
                  {player.name.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => {
                  const score = player.scores.get(hole.hole_number);
                  const par = hole.par;
                  let colorClass = '';
                  if (score && score > 0) {
                    if (score < par) colorClass = 'text-red-500';
                    else if (score > par) colorClass = 'text-blue-500';
                  }
                  return (
                    <TableCell key={hole.hole_number} className={`text-center font-bold text-[10px] px-0 py-1 ${colorClass}`}>
                      {score && score > 0 ? score : ''}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineTotal > 0 ? nineTotal : ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                  {(isBackNine || !hasBackNine) && player.totalScore > 0 ? player.totalScore : ''}
                </TableCell>
              </TableRow>
            );
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
