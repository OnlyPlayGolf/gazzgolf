import { useState } from "react";
import { format } from "date-fns";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
import { normalizePoints } from "@/utils/copenhagenScoring";
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

interface CopenhagenScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  position: number;
  finalScore: string;
  game: CopenhagenGame;
  holes: CopenhagenHole[];
  courseHoles: CourseHole[];
  strokePlayEnabled: boolean;
  strokePlayPlayers?: Array<{ name: string; scores: Map<number, number>; totalScore: number }>;
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function CopenhagenScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  position,
  finalScore,
  game,
  holes,
  courseHoles,
  strokePlayEnabled,
  strokePlayPlayers = [],
  onHeaderClick,
  onScorecardClick,
}: CopenhagenScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Handle format tab change - only update local state, don't navigate
  const handleFormatChange = (newType: ScorecardType) => {
    setScorecardType(newType);
  };

  // Create holes map for quick lookup
  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);

  const getPlayerPoints = (holeNumber: number, playerIndex: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    if (playerIndex === 1) return hole.player_1_hole_points;
    if (playerIndex === 2) return hole.player_2_hole_points;
    return hole.player_3_hole_points;
  };

  const getPlayerGrossScore = (holeNumber: number, playerIndex: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    if (playerIndex === 1) return hole.player_1_gross_score;
    if (playerIndex === 2) return hole.player_2_gross_score;
    return hole.player_3_gross_score;
  };

  const normalizedPts = normalizePoints(
    game.player_1_total_points,
    game.player_2_total_points,
    game.player_3_total_points
  );

  const players = [
    { index: 1, name: game.player_1, points: normalizedPts.player1 },
    { index: 2, name: game.player_2, points: normalizedPts.player2 },
    { index: 3, name: game.player_3, points: normalizedPts.player3 },
  ].sort((a, b) => b.points - a.points);

  // Truncate player name
  const truncateName = (name: string, maxLength: number = 8) => {
    const firstName = name.split(' ')[0];
    if (firstName.length <= maxLength) return firstName;
    return firstName.slice(0, maxLength - 1) + "…";
  };

  const renderCopenhagenScorecard = () => {
    const hasBackNine = backNine.length > 0;

    const renderPointsRows = (nineHoles: CourseHole[], isBackNine: boolean) => {
      return players.map((player) => {
        const ninePoints = nineHoles.reduce((sum, h) => sum + (getPlayerPoints(h.hole_number, player.index) || 0), 0);

        return (
          <TableRow key={`points-${player.index}`} className="font-bold">
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate">
              {truncateName(player.name)}
            </TableCell>
            {nineHoles.map(hole => {
              const points = getPlayerPoints(hole.hole_number, player.index);
              return (
                <TableCell 
                  key={hole.hole_number} 
                  className={`text-center font-bold text-[10px] px-0 py-1 ${
                    points !== null && points >= 6 ? 'text-emerald-600' : 
                    points !== null && points >= 4 ? 'text-blue-600' : 
                    points === 0 ? 'text-red-600' : ''
                  }`}
                >
                  {points !== null ? points : ''}
                </TableCell>
              );
            })}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {ninePoints > 0 ? ninePoints : ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {(isBackNine || !hasBackNine) ? player.points : ''}
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
              {renderPointsRows(frontNine, false)}
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
                {renderPointsRows(backNine, true)}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  // Format position for display (1st, 2nd, 3rd)
  const formatPosition = (pos: number) => {
    if (pos === 1) return '1st';
    if (pos === 2) return '2nd';
    if (pos === 3) return '3rd';
    return `${pos}th`;
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className={`bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 ${onHeaderClick ? 'cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors' : ''}`}
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Position and Final Score - Matching Profile RoundCard */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${position === 1 ? 'text-emerald-600' : 'text-foreground'}`}>
              {formatPosition(position)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {finalScore}
            </div>
          </div>
          
          {/* Right: Round Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-foreground">
              {roundName || 'Copenhagen'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <span className="truncate">{courseName}</span>
              <span>·</span>
              <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <span>Copenhagen</span>
              <span>·</span>
              <span>{playerCount} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Type Selector */}
      <div onClick={(e) => e.stopPropagation()}>
        <ScorecardTypeSelector
          primaryLabel="Copenhagen"
          selectedType={scorecardType}
          onTypeChange={handleFormatChange}
          strokePlayEnabled={strokePlayEnabled}
        />
      </div>

      {/* Scorecard */}
      {courseHoles.length > 0 && (
        <div 
          className={`px-4 pt-4 pb-4 ${onScorecardClick ? 'cursor-pointer' : ''}`}
          onClick={onScorecardClick}
        >
          {scorecardType === 'stroke_play' && strokePlayPlayers.length > 0 ? (
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={courseHoles}
            />
          ) : (
            renderCopenhagenScorecard()
          )}
        </div>
      )}
    </div>
  );
}
