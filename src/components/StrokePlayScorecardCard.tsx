import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";

interface StrokePlayScorecardCardProps {
  roundId?: string;
  roundName: string;
  courseName: string;
  datePlayed: string;
  holesPlayed: number;
  totalScore: number;
  scoreVsPar: number;
  totalPar: number;
  holeScores: Record<number, number>; // hole_number -> score
  holePars: Record<number, number>; // hole_number -> par
  onClick?: () => void;
}

export function StrokePlayScorecardCard({
  roundId,
  roundName,
  courseName,
  datePlayed,
  holesPlayed,
  totalScore,
  scoreVsPar,
  totalPar,
  holeScores,
  holePars,
  onClick,
}: StrokePlayScorecardCardProps) {
  const formatScoreVsPar = (diff: number) => {
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  // Determine which holes to show based on holesPlayed
  const frontNineHoles = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(h => holePars[h] !== undefined);
  const backNineHoles = [10, 11, 12, 13, 14, 15, 16, 17, 18].filter(h => holePars[h] !== undefined);
  const hasBackNine = backNineHoles.length > 0;

  const getFrontNineScoreTotal = () => {
    return frontNineHoles.reduce((sum, h) => {
      const score = holeScores[h];
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getBackNineScoreTotal = () => {
    return backNineHoles.reduce((sum, h) => {
      const score = holeScores[h];
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getFrontNineParTotal = () => {
    return frontNineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0);
  };

  const getBackNineParTotal = () => {
    return backNineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0);
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all"
      onClick={onClick}
    >
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div className="border-b border-primary/20 p-4">
        <div className="flex items-center gap-4">
          {/* Left: Score with vs par below */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-3xl font-bold text-foreground">{totalScore}</div>
            <div className={`text-sm ${scoreVsPar <= 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {formatScoreVsPar(scoreVsPar)}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Round'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Stroke Play · {holesPlayed} holes
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard */}
      <CardContent className="p-4 pt-4">
        <div className="border rounded-lg overflow-hidden">
          {/* Front 9 */}
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-primary">
                <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                {frontNineHoles.map(hole => (
                  <TableHead key={hole} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                    {hole}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                  {!hasBackNine ? 'Tot' : ''}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                {frontNineHoles.map(hole => (
                  <TableCell key={hole} className="text-center font-semibold text-[10px] px-0 py-1">
                    {holePars[hole]}
                  </TableCell>
                ))}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getFrontNineParTotal()}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {!hasBackNine ? totalPar : ''}
                </TableCell>
              </TableRow>
              <TableRow className="font-bold">
                <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">Player</TableCell>
                {frontNineHoles.map(hole => {
                  const score = holeScores[hole];
                  return (
                    <TableCell key={hole} className="text-center px-0 py-1">
                      {score && score > 0 ? (
                        <ScorecardScoreCell score={score} par={holePars[hole]} />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {getFrontNineScoreTotal() > 0 ? getFrontNineScoreTotal() : ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                  {!hasBackNine ? totalScore : ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Back 9 */}
          {hasBackNine && (
            <div className="border-t">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                    {backNineHoles.map(hole => (
                      <TableHead key={hole} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                        {hole}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">In</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Tot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                    {backNineHoles.map(hole => (
                      <TableCell key={hole} className="text-center font-semibold text-[10px] px-0 py-1">
                        {holePars[hole]}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {getBackNineParTotal()}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {totalPar}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">Player</TableCell>
                    {backNineHoles.map(hole => {
                      const score = holeScores[hole];
                      return (
                        <TableCell key={hole} className="text-center px-0 py-1">
                          {score && score > 0 ? (
                            <ScorecardScoreCell score={score} par={holePars[hole]} />
                          ) : (
                            <span className="text-muted-foreground text-[10px]">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {getBackNineScoreTotal() > 0 ? getBackNineScoreTotal() : ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
                      {totalScore}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
