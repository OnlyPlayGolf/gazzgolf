import { useState } from "react";
import { format } from "date-fns";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
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

interface ScrambleScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  position: number;
  scoreToPar: string;
  game: ScrambleGame;
  teams: ScrambleTeam[];
  holes: ScrambleHole[];
  courseHoles: CourseHole[];
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function ScrambleScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  position,
  scoreToPar,
  game,
  teams,
  holes,
  courseHoles,
  onHeaderClick,
  onScorecardClick,
}: ScrambleScorecardViewProps) {
  // Format position for display (1st, 2nd, 3rd)
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  // Create holes map for quick lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getTeamScore = (holeNumber: number, teamId: string) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    const score = hole.team_scores[teamId];
    return score !== null && score !== undefined ? score : null;
  };

  // Calculate team totals for display
  const calculateTeamTotal = (teamId: string) => {
    let total = 0;
    holes.forEach(hole => {
      const score = hole.team_scores[teamId];
      if (score !== null && score !== undefined && score > 0) {
        total += score;
      }
    });
    return total;
  };

  // Truncate team name
  const truncateName = (name: string, maxLength: number = 8) => {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength - 1) + "…";
  };

  const renderScrambleScorecard = () => {
    const hasBackNine = backNine.length > 0;
    const frontNinePar = frontNine.reduce((sum, h) => sum + h.par, 0);
    const backNinePar = backNine.reduce((sum, h) => sum + h.par, 0);
    const totalPar = frontNinePar + backNinePar;

    // Sort teams by score (lowest first)
    const sortedTeams = [...teams].map(team => ({
      team,
      total: calculateTeamTotal(team.id),
    })).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    const renderTeamRows = (nineHoles: CourseHole[], isBackNine: boolean) => {
      return sortedTeams.map(({ team, total }) => {
        const nineTotal = nineHoles.reduce((sum, h) => {
          const s = getTeamScore(h.hole_number, team.id);
          return sum + (s !== null && s > 0 ? s : 0);
        }, 0);

        return (
          <TableRow key={team.id} className="font-bold">
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
              {truncateName(team.name)}
            </TableCell>
            {nineHoles.map(hole => {
              const score = getTeamScore(hole.hole_number, team.id);
              return (
                <TableCell key={hole.hole_number} className="text-center px-0 py-1">
                  {score !== null && score > 0 ? (
                    <ScorecardScoreCell score={score} par={hole.par} />
                  ) : score === -1 ? '–' : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineTotal > 0 ? nineTotal : ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {(isBackNine || !hasBackNine) && total > 0 ? total : ''}
            </TableCell>
          </TableRow>
        );
      });
    };

    return (
      <div className="border rounded-lg overflow-hidden w-full">
        {/* Front 9 */}
        <div className="w-full">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-primary">
                <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                {frontNine.map(hole => (
                  <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-white">
                    {hole.hole_number}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                  {hasBackNine ? '' : 'Tot'}
                </TableHead>
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
                  {frontNinePar}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {hasBackNine ? '' : frontNinePar}
                </TableCell>
              </TableRow>
              {renderTeamRows(frontNine, false)}
            </TableBody>
          </Table>
        </div>

        {/* Back 9 */}
        {hasBackNine && (
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
                  <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                  {backNine.map(hole => (
                    <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                      {hole.par}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {backNinePar}
                  </TableCell>
                  <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                    {totalPar}
                  </TableCell>
                </TableRow>
                {renderTeamRows(backNine, true)}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className={`bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 ${onHeaderClick ? 'cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors' : ''}`}
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Position and Score to Par - Matching Profile RoundCard */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatPosition(position)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {scoreToPar}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Scramble'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>Scramble</span>
              <span>·</span>
              <span>{playerCount} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard - No format tabs for Scramble */}
      {courseHoles.length > 0 && (
        <div 
          className={`px-4 pt-4 pb-4 ${onScorecardClick ? 'cursor-pointer' : ''}`}
          onClick={onScorecardClick}
        >
          {renderScrambleScorecard()}
        </div>
      )}
    </div>
  );
}
