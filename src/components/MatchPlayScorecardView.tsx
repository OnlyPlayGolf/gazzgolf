import { useState } from "react";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";
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

interface MatchPlayHole {
  hole_number: number;
  player_1_gross_score?: number | null;
  player_2_gross_score?: number | null;
  hole_result?: number;
  match_status_after?: number;
}

interface MatchPlayScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  player1Name: string;
  player2Name: string;
  matchStatus: number;
  holes: MatchPlayHole[];
  courseHoles: CourseHole[];
  strokePlayEnabled: boolean;
  strokePlayPlayers?: { name: string; scores: Map<number, number>; totalScore: number }[];
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function MatchPlayScorecardView({
  roundName,
  courseName,
  datePlayed,
  player1Name,
  player2Name,
  matchStatus,
  holes,
  courseHoles,
  strokePlayEnabled,
  strokePlayPlayers,
  onHeaderClick,
  onScorecardClick,
}: MatchPlayScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Build RoundCardData for the header
  const matchResult: 'W' | 'L' | 'T' | null = matchStatus > 0 ? 'W' : matchStatus < 0 ? 'L' : 'T';
  const roundCardData: RoundCardData = {
    id: '',
    round_name: roundName || null,
    course_name: courseName,
    date: datePlayed,
    score: 0,
    playerCount: 2,
    gameMode: 'Match Play',
    gameType: 'match_play',
    matchResult: matchResult,
    matchFinalScore: matchStatus !== 0 ? `${Math.abs(matchStatus)} ${matchStatus > 0 ? 'UP' : 'DOWN'}` : null,
  };

  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const getPlayerScore = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return playerNum === 1 ? hole.player_1_gross_score : hole.player_2_gross_score;
  };

  const getMatchStatusDisplay = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    const status = hole?.match_status_after || 0;
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

  const renderScoreCell = (holeNumber: number, playerNum: number) => {
    const score = getPlayerScore(holeNumber, playerNum);
    
    if (score === null) return "";
    if (score === -1) return <span className="text-muted-foreground">–</span>;
    
    const hole = courseHoles.find(h => h.hole_number === holeNumber);
    const par = hole?.par || 4;
    
    return <ScorecardScoreCell score={score} par={par} />;
  };

  const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
    if (nineHoles.length === 0) return null;

    const nineLabel = isBackNine ? 'In' : 'Out';

    return (
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary text-primary-foreground w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
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
              {isBackNine ? courseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-blue-500">
              {player1Name.split(' ')[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole.hole_number, 1)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 1) || 0), 0) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_1_gross_score || 0), 0) || '') : ''}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-foreground text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
            {nineHoles.map(hole => {
              const holeData = holesMap.get(hole.hole_number);
              if (!holeData) {
                return (
                  <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1 bg-background">
                  </TableCell>
                );
              }
              const status = getMatchStatusDisplay(hole.hole_number);
              return (
                <TableCell key={hole.hole_number} className={`text-center text-[10px] px-0 py-1 ${status.color}`}>
                  {status.text}
                </TableCell>
              );
            })}
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-destructive">
              {player2Name.split(' ')[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole.hole_number, 2)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 2) || 0), 0) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_2_gross_score || 0), 0) || '') : ''}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    if (onHeaderClick && (e.target as HTMLElement).closest('svg')) {
      // Prevent navigation when clicking chevron icon
      return;
    }
    onHeaderClick?.();
  };

  const handleScorecardClick = () => {
    onScorecardClick?.();
  };

  return (
    <div className="space-y-0">
      {/* Round Card Header - Clickable if onHeaderClick provided */}
      {onHeaderClick ? (
        <div onClick={handleHeaderClick} className="cursor-pointer">
          <RoundCard 
            round={roundCardData} 
            className="border-0 shadow-none hover:shadow-none rounded-t-lg"
          />
        </div>
      ) : (
        <div style={{ pointerEvents: 'none' }} className="[&_svg:last-child]:hidden">
          <RoundCard 
            round={roundCardData} 
            className="border-0 shadow-none hover:shadow-none hover:border-primary/20 active:scale-100 rounded-t-lg !cursor-default"
            onClick={() => {}} // Prevent navigation
          />
        </div>
      )}

      {/* Scorecard Type Selector */}
      <ScorecardTypeSelector
        primaryLabel="Match Play"
        selectedType={scorecardType}
        onTypeChange={setScorecardType}
        strokePlayEnabled={strokePlayEnabled}
      />

      {/* Scorecard */}
      {courseHoles.length > 0 && (
        <div 
          className={onScorecardClick ? "px-4 pt-3 cursor-pointer" : "px-4 pt-3"}
          onClick={onScorecardClick}
        >
          {scorecardType === 'stroke_play' && strokePlayPlayers ? (
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={courseHoles}
              showNetRow={false}
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {renderNine(frontNine, false)}
              
              {hasBackNine && (
                <div className="border-t">
                  {renderNine(backNine, true)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
