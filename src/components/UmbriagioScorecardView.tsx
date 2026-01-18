import { useState } from "react";
import { format } from "date-fns";
import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { ScorecardTypeSelector, ScorecardType } from "@/components/ScorecardTypeSelector";
import { UmbriagioSharedScorecard } from "@/components/UmbriagioSharedScorecard";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface UmbriagioScorecardViewProps {
  roundName: string;
  courseName: string;
  datePlayed: string;
  playerCount: number;
  matchResult: string;
  resultText: string;
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
  currentUserTeam?: 'A' | 'B' | null;
  strokePlayEnabled: boolean;
  strokePlayPlayers?: Array<{ name: string; scores: Map<number, number>; totalScore: number }>;
  onHeaderClick?: () => void;
  onScorecardClick?: () => void;
}

export function UmbriagioScorecardView({
  roundName,
  courseName,
  datePlayed,
  playerCount,
  matchResult,
  resultText,
  game,
  holes,
  courseHoles,
  currentUserTeam,
  strokePlayEnabled,
  strokePlayPlayers = [],
  onHeaderClick,
  onScorecardClick,
}: UmbriagioScorecardViewProps) {
  const [scorecardType, setScorecardType] = useState<ScorecardType>('primary');

  // Get color for match result - same logic as RoundCard
  const getMatchResultColor = (result: string) => {
    if (result === 'W') return 'text-emerald-600';
    if (result === 'L') return 'text-destructive';
    return 'text-foreground';
  };

  // Handle format tab change - only update local state, don't navigate
  const handleFormatChange = (newType: ScorecardType) => {
    setScorecardType(newType);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Round Card Style Header - Matching Profile Round Cards */}
      <div 
        className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-b border-primary/20 p-4 cursor-pointer hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/15 hover:to-primary/10 transition-colors"
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          {/* Left: Match Result with score below */}
          <div className="flex-shrink-0 w-14 text-center">
            <div className={`text-2xl font-bold ${getMatchResultColor(matchResult)}`}>
              {matchResult}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {resultText}
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
              <span>{playerCount} players</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Type Selector */}
      <div onClick={(e) => e.stopPropagation()}>
        <ScorecardTypeSelector
          primaryLabel="Umbriago"
          selectedType={scorecardType}
          onTypeChange={handleFormatChange}
          strokePlayEnabled={strokePlayEnabled}
        />
      </div>

      {/* Scorecard */}
      {courseHoles.length > 0 && (
        <div 
          className="px-4 pt-4 pb-4 cursor-pointer"
          onClick={onScorecardClick}
        >
          {scorecardType === 'stroke_play' && strokePlayPlayers.length > 0 ? (
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={courseHoles}
            />
          ) : (
            <UmbriagioSharedScorecard
              game={game}
              holes={holes}
              courseHoles={courseHoles}
            />
          )}
        </div>
      )}
    </div>
  );
}
