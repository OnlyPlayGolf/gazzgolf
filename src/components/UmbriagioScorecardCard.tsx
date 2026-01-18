import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UmbriagioScorecardCardProps {
  gameId: string;
  roundName: string;
  courseName: string;
  datePlayed: string;
  teamAName: string;
  teamBName: string;
  normalizedA: number;
  normalizedB: number;
  winningTeam: 'A' | 'B' | 'TIE' | null;
  currentUserTeam: 'A' | 'B' | null;
  holePoints: Record<number, { teamA: number; teamB: number }>; // hole_number -> points
  holePars: Record<number, number>; // hole_number -> par
  onClick?: () => void;
}

// Truncate team name with ellipsis if too long
const truncateTeamName = (name: string, maxLength: number = 10) => {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 1) + "…";
};

export function UmbriagioScorecardCard({
  gameId,
  roundName,
  courseName,
  datePlayed,
  teamAName,
  teamBName,
  normalizedA,
  normalizedB,
  winningTeam,
  currentUserTeam,
  holePoints,
  holePars,
  onClick,
}: UmbriagioScorecardCardProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which holes to show based on data
  const frontNineHoles = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(h => holePars[h] !== undefined);
  const backNineHoles = [10, 11, 12, 13, 14, 15, 16, 17, 18].filter(h => holePars[h] !== undefined);
  const hasBackNine = backNineHoles.length > 0;

  const getTeamFrontNineTotal = (team: 'A' | 'B') => {
    return frontNineHoles.reduce((sum, h) => {
      const points = holePoints[h];
      return sum + (points ? (team === 'A' ? points.teamA : points.teamB) : 0);
    }, 0);
  };

  const getTeamBackNineTotal = (team: 'A' | 'B') => {
    return backNineHoles.reduce((sum, h) => {
      const points = holePoints[h];
      return sum + (points ? (team === 'A' ? points.teamA : points.teamB) : 0);
    }, 0);
  };

  const getScoreDisplay = () => {
    return `${normalizedA} - ${normalizedB}`;
  };

  const getResultDisplay = () => {
    if (winningTeam === 'TIE') return 'T';
    if (winningTeam === currentUserTeam) return 'W';
    if (winningTeam) return 'L';
    return '—';
  };

  const getResultColor = () => {
    if (winningTeam === currentUserTeam) return 'text-emerald-600';
    if (winningTeam && winningTeam !== 'TIE') return 'text-destructive';
    return 'text-foreground';
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (gameId) {
      // Mark as coming from feed to prevent share dialog
      sessionStorage.setItem(`spectator_umbriago_${gameId}`, 'true');
      navigate(`/umbriago/${gameId}/summary`);
    }
  };

  const renderTeamRow = (team: 'A' | 'B', holeSet: number[], showTotal: boolean) => {
    const teamName = team === 'A' ? teamAName : teamBName;
    const totalForNine = holeSet === frontNineHoles ? getTeamFrontNineTotal(team) : getTeamBackNineTotal(team);
    const grandTotal = team === 'A' ? normalizedA : normalizedB;

    return (
      <TableRow className="font-bold">
        <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate" title={teamName}>
          {truncateTeamName(teamName, 6)}
        </TableCell>
        {holeSet.map(hole => {
          const points = holePoints[hole] ? (team === 'A' ? holePoints[hole].teamA : holePoints[hole].teamB) : null;
          return (
            <TableCell 
              key={hole} 
              className={`text-center font-bold text-[10px] px-0 py-1 ${
                points !== null && points > 0 ? 'text-green-600' : 
                points !== null && points < 0 ? 'text-destructive' : ''
              }`}
            >
              {points !== null ? (points > 0 ? `+${points}` : points !== 0 ? points : '') : ''}
            </TableCell>
          );
        })}
        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
          {totalForNine !== 0 ? totalForNine : ''}
        </TableCell>
        <TableCell className="text-center font-bold bg-primary text-primary-foreground text-[10px] px-0 py-1">
          {showTotal ? grandTotal : ''}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all"
      onClick={handleClick}
    >
      {/* Green Header - Round Card Style - Matching Profile Round Cards */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4">
        <div className="flex items-center gap-4">
          {/* Left: W/L/T Result with score below */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${getResultColor()}`}>
              {getResultDisplay()}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {getScoreDisplay()}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Umbriago'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>Umbriago</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                4
              </span>
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
                  {frontNineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0)}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {!hasBackNine ? Object.values(holePars).reduce((sum, p) => sum + p, 0) : ''}
                </TableCell>
              </TableRow>
              {renderTeamRow('A', frontNineHoles, !hasBackNine)}
              {renderTeamRow('B', frontNineHoles, !hasBackNine)}
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
                      {backNineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {Object.values(holePars).reduce((sum, p) => sum + p, 0)}
                    </TableCell>
                  </TableRow>
                  {renderTeamRow('A', backNineHoles, true)}
                  {renderTeamRow('B', backNineHoles, true)}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
