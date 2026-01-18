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

interface MatchPlayScorecardCardProps {
  gameId?: string;
  roundName: string;
  courseName: string;
  datePlayed: string;
  player1Name: string;
  player2Name: string;
  finalResult: string;
  winnerPlayer: string | null;
  matchStatus: number;
  holeScores: Record<number, { player1: number | null; player2: number | null; result: number; statusAfter: number }>;
  holePars: Record<number, number>;
  onClick?: () => void;
}

export function MatchPlayScorecardCard({
  roundName,
  courseName,
  datePlayed,
  player1Name,
  player2Name,
  finalResult,
  winnerPlayer,
  matchStatus,
  holeScores,
  holePars,
  onClick,
}: MatchPlayScorecardCardProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d");
    } catch {
      return "";
    }
  };

  // Build hole arrays from pars (which contains all 18 holes) - not from scores (which may only have played holes)
  const allHoleNumbers = Object.keys(holePars).map(Number).sort((a, b) => a - b);
  const frontNine = allHoleNumbers.filter(h => h <= 9);
  const backNine = allHoleNumbers.filter(h => h > 9);
  const hasBackNine = backNine.length > 0;

  const getMatchStatusDisplay = (status: number) => {
    if (status === 0) return { text: "AS", color: "bg-background text-foreground font-bold" };
    // Player 1 is up (status > 0): blue background with blue text
    if (status > 0) {
      const absStatus = Math.abs(status);
      return { text: `${absStatus}UP`, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" };
    }
    // Player 2 is up (status < 0): red background with red text
    const absStatus = Math.abs(status);
    return { text: `${absStatus}UP`, color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold" };
  };

  const renderScoreCell = (holeNumber: number, playerNum: 1 | 2) => {
    const holeData = holeScores[holeNumber];
    if (!holeData) return <span className="text-muted-foreground text-[10px]">-</span>;
    
    const score = playerNum === 1 ? holeData.player1 : holeData.player2;
    if (score === null) return <span className="text-muted-foreground text-[10px]">-</span>;
    
    // Handle conceded holes
    if (score === -1) return <span className="text-muted-foreground text-[10px]">–</span>;
    
    const par = holePars[holeNumber] || 4;
    const won = (playerNum === 1 && holeData.result === 1) || (playerNum === 2 && holeData.result === -1);
    
    // Use unified score styling
    return <ScorecardScoreCell score={score} par={par} />;
  };

  const getNineTotal = (holes: number[], playerNum: 1 | 2) => {
    return holes.reduce((sum, h) => {
      const holeData = holeScores[h];
      if (!holeData) return sum;
      const score = playerNum === 1 ? holeData.player1 : holeData.player2;
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getTotalScore = (playerNum: 1 | 2) => {
    return allHoleNumbers.reduce((sum, h) => {
      const holeData = holeScores[h];
      if (!holeData) return sum;
      const score = playerNum === 1 ? holeData.player1 : holeData.player2;
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const renderNine = (nineHoles: number[], isBackNine: boolean = false) => {
    if (nineHoles.length === 0) return null;

    const nineLabel = isBackNine ? "In" : "Out";

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
          <TableRow>
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole} className="text-center font-semibold text-[10px] px-0 py-1">
                {holePars[hole] || ""}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0)}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine ? allHoleNumbers.reduce((sum, h) => sum + (holePars[h] || 0), 0) : (hasBackNine ? "" : nineHoles.reduce((sum, h) => sum + (holePars[h] || 0), 0))}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-blue-500">
              {player1Name.split(" ")[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole} className="text-center px-0 py-1">
                {renderScoreCell(hole, 1)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getNineTotal(nineHoles, 1) || ""}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (getTotalScore(1) || "") : ""}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-foreground text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
            {nineHoles.map(hole => {
              const holeData = holeScores[hole];
              if (!holeData) {
                return <TableCell key={hole} className="text-center text-[10px] px-0 py-1 bg-background"></TableCell>;
              }
              const status = getMatchStatusDisplay(holeData.statusAfter);
              return (
                <TableCell key={hole} className={`text-center text-[10px] px-0 py-1 ${status.color}`}>
                  {status.text}
                </TableCell>
              );
            })}
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-destructive">
              {player2Name.split(" ")[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole} className="text-center px-0 py-1">
                {renderScoreCell(hole, 2)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getNineTotal(nineHoles, 2) || ""}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (getTotalScore(2) || "") : ""}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all group overflow-hidden"
      onClick={onClick}
    >
      {/* Grey Header - Match Card Style */}
      <div className="bg-muted/50 p-3">
        <div className="flex items-center gap-3">
          {/* Left: W/L/T with match status */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-xl font-bold text-foreground">
              {matchStatus > 0 ? "W" : matchStatus < 0 ? "L" : "T"}
            </div>
            {matchStatus !== 0 && (
              <div className="text-xs text-muted-foreground">
                {Math.abs(matchStatus)} {matchStatus > 0 ? "UP" : "DOWN"}
              </div>
            )}
          </div>

          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate text-foreground">{roundName || "Match Play"}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{formatDate(datePlayed)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Match Play · 2 players</div>
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
