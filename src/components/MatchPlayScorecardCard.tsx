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

interface MatchPlayScorecardCardProps {
  gameId?: string;
  roundName: string;
  courseName: string;
  datePlayed: string;
  player1Name: string;
  player2Name: string;
  finalResult: string;
  winnerPlayer: string | null;
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
    if (status === 0) return { text: "AS", color: "bg-muted text-muted-foreground" };
    if (status > 0) {
      return { text: `${status}UP`, color: "bg-blue-500 text-white" };
    }
    return { text: `${Math.abs(status)}UP`, color: "bg-destructive text-destructive-foreground" };
  };

  const renderScoreCell = (holeNumber: number, playerNum: 1 | 2) => {
    const holeData = holeScores[holeNumber];
    if (!holeData) return "";
    
    const score = playerNum === 1 ? holeData.player1 : holeData.player2;
    if (score === null) return "";
    
    const displayScore = score === -1 ? "–" : score;
    const won = (playerNum === 1 && holeData.result === 1) || (playerNum === 2 && holeData.result === -1);
    
    if (won) {
      const colorClass = playerNum === 1 ? "text-blue-500" : "text-destructive";
      return <span className={`font-bold ${colorClass}`}>{displayScore}</span>;
    }
    return displayScore;
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
          <TableRow className="bg-primary/5">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole} className="text-center font-bold text-[10px] px-0 py-1.5">
                {hole}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">{nineLabel}</TableHead>
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
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
              <TableCell key={hole} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole, 1)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getNineTotal(nineHoles, 1) || ""}
            </TableCell>
            <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (getTotalScore(1) || "") : ""}
            </TableCell>
          </TableRow>

          <TableRow className="bg-muted/30">
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-muted/30">Score</TableCell>
            {nineHoles.map(hole => {
              const holeData = holeScores[hole];
              if (!holeData) {
                return <TableCell key={hole} className="text-center text-[10px] px-0 py-1"></TableCell>;
              }
              const status = getMatchStatusDisplay(holeData.statusAfter);
              return (
                <TableCell key={hole} className="text-center text-[10px] px-0 py-1">
                  <span className={`inline-flex items-center justify-center px-0.5 py-0 rounded text-[8px] font-bold ${status.color}`}>
                    {status.text}
                  </span>
                </TableCell>
              );
            })}
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center bg-primary/10 text-[10px] px-0 py-1"></TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-destructive">
              {player2Name.split(" ")[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole, 2)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {getNineTotal(nineHoles, 2) || ""}
            </TableCell>
            <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
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
      {/* Green Header - Match Card Style */}
      <div className="bg-primary text-primary-foreground p-3">
        <div className="flex items-center gap-3">
          {/* Left: Match Result */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className="text-xl font-bold">{finalResult}</div>
            <div className="text-xs opacity-75">
              {winnerPlayer ? "Winner" : "Halved"}
            </div>
          </div>

          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{roundName || "Match Play"}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs opacity-90">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{formatDate(datePlayed)}</span>
            </div>
            <div className="text-xs opacity-75 mt-0.5">Match Play · 2 players</div>
          </div>

          {/* Chevron */}
          <ChevronRight size={20} className="text-primary-foreground/60 flex-shrink-0 group-hover:text-primary-foreground transition-colors" />
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
