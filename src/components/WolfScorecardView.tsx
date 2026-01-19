import { useState } from "react";
import { format } from "date-fns";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WolfPlayer {
  num: number;
  name: string;
  points: number;
}

interface WolfHoleData {
  hole_number: number;
  scores: Record<number, number | null>;
  points: Record<number, number | null>;
  par: number;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index?: number;
}

interface WolfScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  position: number;
  pointsWon: number;
  players: WolfPlayer[];
  holes: WolfHoleData[];
  courseHoles: CourseHole[];
  strokePlayEnabled: boolean;
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function WolfScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  position,
  pointsWon,
  players,
  holes,
  courseHoles,
  strokePlayEnabled,
  onHeaderClick,
  onScorecardClick,
}: WolfScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Format position for display (1st, 2nd, 3rd)
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  // Sort players by points for display
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  // Build course holes from wolf holes if not provided
  const effectiveCourseHoles: CourseHole[] = courseHoles.length > 0 
    ? courseHoles 
    : holes.map(h => ({ hole_number: h.hole_number, par: h.par, stroke_index: 0 }));

  // Prepare stroke play data
  const strokePlayPlayers = players.map(player => {
    const scores = new Map<number, number>();
    let total = 0;
    
    holes.forEach(hole => {
      const score = hole.scores[player.num];
      if (score && score > 0 && score !== -1) {
        scores.set(hole.hole_number, score);
        total += score;
      }
    });
    
    return { name: player.name, scores, totalScore: total };
  });

  // Truncate name helper
  const truncateName = (name: string, maxLength: number = 8) => {
    if (name.length <= maxLength) return name;
    return name.slice(0, maxLength - 1) + "…";
  };

  const renderWolfScorecard = () => {
    const frontNine = effectiveCourseHoles.filter(h => h.hole_number <= 9);
    const backNine = effectiveCourseHoles.filter(h => h.hole_number > 9);
    const hasBackNine = backNine.length > 0;

    const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
      if (nineHoles.length === 0) return null;

      const nineLabel = isBackNine ? 'In' : 'Out';

      return (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-primary">
              <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
              {nineHoles.map(hole => (
                <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                  {hole.hole_number}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">{nineLabel}</TableHead>
              <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary text-primary-foreground">
                {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Par row */}
            <TableRow>
              <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
              {nineHoles.map(hole => (
                <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                  {hole.par}
                </TableCell>
              ))}
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {nineHoles.reduce((sum, h) => sum + h.par, 0)}
              </TableCell>
              <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                {isBackNine ? effectiveCourseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
              </TableCell>
            </TableRow>

            {/* Player rows - showing points per hole */}
            {sortedPlayers.map((player, index) => {
              // Calculate points for this nine
              let ninePoints = 0;
              nineHoles.forEach(hole => {
                const holeData = holes.find(h => h.hole_number === hole.hole_number);
                if (holeData) {
                  const pts = holeData.points[player.num];
                  if (pts !== null && pts !== undefined) {
                    ninePoints += pts;
                  }
                }
              });

              const totalPoints = player.points;

              return (
                <TableRow key={index}>
                  <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
                    {truncateName(player.name.split(' ')[0])}
                  </TableCell>
                  {nineHoles.map(hole => {
                    const holeData = holes.find(h => h.hole_number === hole.hole_number);
                    const pts = holeData?.points[player.num];
                    
                    return (
                      <TableCell 
                        key={hole.hole_number} 
                        className={`text-center font-bold text-[10px] px-0 py-1 ${
                          pts !== null && pts !== undefined && pts > 0 ? 'text-green-600' : 
                          pts !== null && pts !== undefined && pts < 0 ? 'text-red-600' : ''
                        }`}
                      >
                        {pts !== null && pts !== undefined ? (pts > 0 ? `+${pts}` : pts === 0 ? '0' : pts) : ''}
                      </TableCell>
                    );
                  })}
                  <TableCell className={`text-center font-bold bg-muted text-[10px] px-0 py-1 ${
                    ninePoints > 0 ? 'text-green-600' : ninePoints < 0 ? 'text-red-600' : ''
                  }`}>
                    {ninePoints !== 0 ? (ninePoints > 0 ? `+${ninePoints}` : ninePoints) : '0'}
                  </TableCell>
                  <TableCell className={`text-center font-bold bg-muted text-[10px] px-0 py-1 ${
                    totalPoints > 0 ? 'text-green-600' : totalPoints < 0 ? 'text-red-600' : ''
                  }`}>
                    {(isBackNine || !hasBackNine) ? (totalPoints > 0 ? `+${totalPoints}` : totalPoints) : ''}
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
  };

  // Build final score string (e.g., "8-5-3-0") from sorted players
  const finalScoreString = sortedPlayers.map(p => p.points).join('-');

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className={`bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 ${onHeaderClick ? 'cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors' : ''}`}
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Position and All Players' Points - Matching Profile RoundCard */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatPosition(position)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {finalScoreString}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Wolf'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>Wolf</span>
              <span>·</span>
              <span>{playerCount} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Type Selector */}
      <ScorecardTypeSelector
        primaryLabel="Wolf"
        selectedType={scorecardType}
        onTypeChange={setScorecardType}
        strokePlayEnabled={strokePlayEnabled}
      />

      {/* Scorecard */}
      {effectiveCourseHoles.length > 0 && (
        <div 
          className={`px-4 pt-3 pb-4 ${onScorecardClick ? 'cursor-pointer' : ''}`}
          onClick={onScorecardClick}
        >
          {scorecardType === 'stroke_play' ? (
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={effectiveCourseHoles}
            />
          ) : (
            renderWolfScorecard()
          )}
        </div>
      )}
    </div>
  );
}
