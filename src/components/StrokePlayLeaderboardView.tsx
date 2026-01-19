import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, RotateCcw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorecardActions } from "@/components/ScorecardActions";
import { ScorecardScoreCell } from "@/components/ScorecardScoreCell";
interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export interface StrokePlayPlayer {
  id: string;
  name: string;
  handicap?: number | null;
  scores: Map<number, number>;
  mulligans?: Set<number>;
}

interface StrokePlayLeaderboardViewProps {
  players: StrokePlayPlayer[];
  courseHoles: CourseHole[];
  isSpectator?: boolean;
  gameId?: string;
  gameType?: 'round' | 'match_play' | 'best_ball' | 'umbriago' | 'wolf' | 'scramble' | 'copenhagen' | 'skins';
}

export function StrokePlayLeaderboardView({
  players,
  courseHoles,
  isSpectator = false,
  gameId,
  gameType,
}: StrokePlayLeaderboardViewProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(
    players.length > 0 ? players[0].id : null
  );

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const hasPlayerConcededAnyHole = (player: StrokePlayPlayer): boolean => {
    for (const score of player.scores.values()) {
      if (score === -1) return true;
    }
    return false;
  };

  const calculateTotals = (player: StrokePlayPlayer, holes: CourseHole[]) => {
    let totalScore = 0;
    let totalPar = 0;
    let holesCompleted = 0;

    holes.forEach(hole => {
      const score = player.scores.get(hole.hole_number);
      if (score && score > 0) {
        totalScore += score;
        totalPar += hole.par;
        holesCompleted++;
      }
    });

    return { totalScore, totalPar, holesCompleted };
  };

  const getScoreToPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const getPlayerScoreToParDisplay = (player: StrokePlayPlayer) => {
    if (hasPlayerConcededAnyHole(player)) return "-";
    
    const totals = calculateTotals(player, courseHoles);
    if (totals.totalScore > 0) {
      return getScoreToPar(totals.totalScore, totals.totalPar);
    }
    return "E";
  };

  // Calculate positions based on score to par
  const playersWithTotals = players.map(player => {
    const totals = calculateTotals(player, courseHoles);
    const hasConceded = hasPlayerConcededAnyHole(player);
    const scoreToPar = hasConceded ? Infinity : (totals.totalScore > 0 ? totals.totalScore - totals.totalPar : Infinity);
    return { player, scoreToPar, hasConceded };
  });
  
  // Sorted array for position calculation
  const sortedForRanking = [...playersWithTotals].sort((a, b) => a.scoreToPar - b.scoreToPar);
  
  // Display order: always sorted by score in stroke play view (lowest score on top)
  const displayOrder = sortedForRanking;
  
  const getPositionLabel = (scoreToPar: number, hasConceded: boolean): string => {
    if (hasConceded) return "-";
    
    const playersAhead = sortedForRanking.filter(p => p.scoreToPar < scoreToPar).length;
    const position = playersAhead + 1;
    const sameScoreCount = sortedForRanking.filter(p => p.scoreToPar === scoreToPar && !p.hasConceded).length;
    if (sameScoreCount > 1) {
      return `T${position}`;
    }
    return `${position}`;
  };

  if (players.length === 0 || courseHoles.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        No stroke play data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayOrder.map(({ player, scoreToPar, hasConceded }) => {
        const isExpanded = expandedPlayerId === player.id;
        const frontTotals = calculateTotals(player, frontNine);
        const backTotals = calculateTotals(player, backNine);
        const overallTotals = calculateTotals(player, courseHoles);
        const positionLabel = getPositionLabel(scoreToPar, hasConceded);

        return (
          <Card key={player.id} className="overflow-hidden">
            {/* Player Info Bar - Clickable */}
            <div 
              className="bg-card border-b border-border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ChevronDown 
                    size={20} 
                    className={`text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                  />
                  <div className="bg-muted rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold">
                    {positionLabel}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{player.name}</div>
                    {player.handicap !== undefined && player.handicap !== null && (
                      <div className="text-sm text-muted-foreground">
                        HCP {Number(player.handicap) === 0 ? '0' : `+${Math.abs(Number(player.handicap))}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {getPlayerScoreToParDisplay(player)}
                  </div>
                  <div className="text-sm text-muted-foreground">TO PAR</div>
                </div>
              </div>
            </div>

            {/* Scorecard Table - Only shown when expanded */}
            {isExpanded && (
              <>
                {/* Front 9 */}
                <div className="w-full">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-primary">
                        <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
                        {frontNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">Out</TableHead>
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                          {backNine.length > 0 ? '' : 'Tot'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                        {frontNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                            {hole.stroke_index}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                      </TableRow>
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
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNine.length > 0 ? '' : frontNine.reduce((sum, h) => sum + h.par, 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                        {frontNine.map(hole => {
                          const score = player.scores.get(hole.hole_number);
                          const hasScore = player.scores.has(hole.hole_number);
                          const hasMulligan = player.mulligans?.has(hole.hole_number);
                          return (
                            <TableCell 
                              key={hole.hole_number} 
                              className="text-center px-0 py-1"
                            >
                              <div className="flex items-center justify-center gap-0.5">
                                {hasScore ? (
                                  <ScorecardScoreCell score={score} par={hole.par} />
                                ) : ''}
                                {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {hasConceded ? '-' : (frontTotals.totalScore > 0 ? frontTotals.totalScore : '')}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNine.length > 0 ? '' : (hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : ''))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Back 9 */}
                {backNine.length > 0 && (
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
                          <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">HCP</TableCell>
                          {backNine.map(hole => (
                            <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                              {hole.stroke_index}
                            </TableCell>
                          ))}
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                          <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
                        </TableRow>
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
                        <TableRow className="font-bold">
                          <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">{player.name.split(' ')[0]}</TableCell>
                          {backNine.map(hole => {
                            const score = player.scores.get(hole.hole_number);
                            const hasScore = player.scores.has(hole.hole_number);
                            const hasMulligan = player.mulligans?.has(hole.hole_number);
                            return (
                              <TableCell 
                                key={hole.hole_number} 
                                className="text-center px-0 py-1"
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {hasScore ? (
                                    <ScorecardScoreCell score={score} par={hole.par} />
                                  ) : ''}
                                  {hasMulligan && <RotateCcw size={8} className="text-amber-500" />}
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {hasConceded ? '-' : (backTotals.totalScore > 0 ? backTotals.totalScore : '')}
                          </TableCell>
                          <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                            {hasConceded ? '-' : (overallTotals.totalScore > 0 ? overallTotals.totalScore : '')}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Scorecard Actions - Only shown when expanded */}
                {gameId && gameType && (
                  <div className="px-4 pb-3">
                    <ScorecardActions
                      gameId={gameId}
                      gameType={gameType}
                      scorecardPlayerId={player.id}
                      scorecardPlayerName={player.name}
                    />
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
