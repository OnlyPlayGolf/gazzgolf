import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";

interface BestBallPlayerScoreData {
  playerId: string;
  playerName: string;
  grossScore: number;
}

interface BestBallScorecardCardProps {
  gameId?: string;
  roundName: string;
  courseName: string;
  datePlayed: string;
  teamAName: string;
  teamBName: string;
  teamAPlayers: { id: string; name: string }[];
  teamBPlayers: { id: string; name: string }[];
  matchStatus: number; // From user's perspective: positive = user winning
  userTeam: 'A' | 'B';
  holeScores: Record<number, {
    teamAScores: BestBallPlayerScoreData[];
    teamBScores: BestBallPlayerScoreData[];
    matchStatusAfter: number;
  }>;
  holePars: Record<number, number>;
  onClick?: () => void;
}

export function BestBallScorecardCard({
  roundName,
  courseName,
  datePlayed,
  teamAName,
  teamBName,
  teamAPlayers,
  teamBPlayers,
  matchStatus,
  userTeam,
  holeScores,
  holePars,
  onClick,
}: BestBallScorecardCardProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d");
    } catch {
      return "";
    }
  };

  // Build hole arrays from pars
  const allHoleNumbers = Object.keys(holePars).map(Number).sort((a, b) => a - b);
  const frontNine = allHoleNumbers.filter(h => h <= 9);
  const backNine = allHoleNumbers.filter(h => h > 9);
  const hasBackNine = backNine.length > 0;

  const playerCount = teamAPlayers.length + teamBPlayers.length;

  // Get match result from user's perspective
  const getMatchResultDisplay = () => {
    if (matchStatus === 0) return { result: 'T', statusText: 'AS' };
    if (matchStatus > 0) return { result: 'W', statusText: `${matchStatus} UP` };
    return { result: 'L', statusText: `${Math.abs(matchStatus)} DOWN` };
  };

  const { result, statusText } = getMatchResultDisplay();

  const getMatchStatusAfterHole = (holeNumber: number): { text: string; leadingTeam: 'A' | 'B' | null } => {
    const holeData = holeScores[holeNumber];
    if (!holeData) return { text: '', leadingTeam: null };
    const status = holeData.matchStatusAfter;
    if (status === 0) return { text: 'AS', leadingTeam: null };
    const upBy = Math.abs(status);
    const leadingTeam = status > 0 ? 'A' : 'B';
    return { text: `${upBy}UP`, leadingTeam };
  };

  const getPlayerScoreForHole = (holeNumber: number, playerId: string, team: 'A' | 'B'): number | null => {
    const holeData = holeScores[holeNumber];
    if (!holeData) return null;
    const scores = team === 'A' ? holeData.teamAScores : holeData.teamBScores;
    const playerScore = scores.find(s => s.playerId === playerId || s.playerName === playerId);
    return playerScore?.grossScore || null;
  };

  const getPlayerTotal = (playerId: string, team: 'A' | 'B', holes: number[]) => {
    return holes.reduce((sum, h) => {
      const score = getPlayerScoreForHole(h, playerId, team);
      return sum + (score || 0);
    }, 0);
  };

  const renderNine = (nineHoles: number[], isBackNine: boolean = false) => {
    if (nineHoles.length === 0) return null;

    const nineLabel = isBackNine ? "In" : "Out";
    const ninePar = nineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0);
    const totalPar = allHoleNumbers.reduce((sum, h) => sum + (holePars[h] || 0), 0);

    return (
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                {hole}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">{nineLabel}</TableHead>
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
              {isBackNine ? "Tot" : (hasBackNine ? "" : "Tot")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Par Row */}
          <TableRow className="bg-muted/50">
            <TableCell className="font-medium text-foreground text-[10px] px-0.5 py-1 bg-muted/50">Par</TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole} className="text-center font-semibold text-foreground text-[10px] px-0 py-1 bg-muted/50">
                {holePars[hole] || ""}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted/50 text-foreground text-[10px] px-0 py-1">
              {ninePar}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted/50 text-foreground text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? totalPar : ""}
            </TableCell>
          </TableRow>

          {/* Team A Players */}
          {teamAPlayers.map((player) => {
            const nineTotal = getPlayerTotal(player.id, 'A', nineHoles);
            const fullTotal = getPlayerTotal(player.id, 'A', allHoleNumbers);

            return (
              <TableRow key={player.id}>
                <TableCell className="font-medium text-blue-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {player.name.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => {
                  const score = getPlayerScoreForHole(hole, player.id, 'A');
                  const par = holePars[hole] || 4;
                  return (
                    <TableCell key={hole} className="text-center px-0 py-1">
                      {score ? (
                        <ScorecardScoreCell score={score} par={par} />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineTotal || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {isBackNine || !hasBackNine ? (fullTotal || '') : ''}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Match Status Row */}
          <TableRow className="bg-muted/50">
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-muted/50">Score</TableCell>
            {nineHoles.map(hole => {
              const { text, leadingTeam } = getMatchStatusAfterHole(hole);
              return (
                <TableCell
                  key={hole}
                  className={`text-center font-bold text-[10px] px-0 py-1 ${
                    leadingTeam === 'A' ? 'bg-blue-500 text-white' :
                    leadingTeam === 'B' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''
                  }`}
                >
                  {text}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1"></TableCell>
          </TableRow>

          {/* Team B Players */}
          {teamBPlayers.map((player) => {
            const nineTotal = getPlayerTotal(player.id, 'B', nineHoles);
            const fullTotal = getPlayerTotal(player.id, 'B', allHoleNumbers);

            return (
              <TableRow key={player.id}>
                <TableCell className="font-medium text-red-600 text-[10px] px-0.5 py-1 bg-background truncate">
                  {player.name.split(' ')[0]}
                </TableCell>
                {nineHoles.map(hole => {
                  const score = getPlayerScoreForHole(hole, player.id, 'B');
                  const par = holePars[hole] || 4;
                  return (
                    <TableCell key={hole} className="text-center px-0 py-1">
                      {score ? (
                        <ScorecardScoreCell score={score} par={par} />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">-</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {nineTotal || ''}
                </TableCell>
                <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                  {isBackNine || !hasBackNine ? (fullTotal || '') : ''}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all group overflow-hidden"
      onClick={onClick}
    >
      {/* Grey Header */}
      <div className="bg-muted/50 p-3">
        <div className="flex items-center gap-3">
          {/* Left: W/L/T with match status */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-xl font-bold text-foreground">{result}</div>
            <div className="text-xs text-muted-foreground">{statusText}</div>
          </div>

          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate text-foreground">{roundName || "Best Ball Match Play"}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{formatDate(datePlayed)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Best Ball Match Play · {playerCount} players</div>
          </div>

          {/* Chevron */}
          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Scorecard */}
      <CardContent className="p-0">
        <div>
          {renderNine(frontNine, false)}
          {hasBackNine && (
            <div className="border-t">
              {renderNine(backNine, true)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
