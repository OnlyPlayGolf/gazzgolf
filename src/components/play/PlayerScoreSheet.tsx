import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScoreInputGrid } from "./ScoreInputGrid";
import { formatHandicapWithPrefix } from "@/lib/utils";

interface PlayerScoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  handicap?: number | string | null;
  par: number;
  holeNumber: number;
  currentScore: number | null;
  onScoreSelect: (score: number | null) => void;
  onMore?: () => void;
  onEnterAndNext?: () => void;
}

export function PlayerScoreSheet({
  open,
  onOpenChange,
  playerName,
  handicap,
  par,
  holeNumber,
  currentScore,
  onScoreSelect,
  onMore,
  onEnterAndNext,
}: PlayerScoreSheetProps) {

  const handleScoreSelect = (score: number | null) => {
    onScoreSelect(score);
  };

  const handleScoreAndAdvance = (score: number) => {
    // Called after score is selected to advance to next player/hole
    if (onEnterAndNext) {
      onEnterAndNext();
    }
  };

  const handleMore = () => {
    if (onMore) {
      onMore();
    } else if (onEnterAndNext) {
      // Fallback for other game modes - just call onEnterAndNext
      onEnterAndNext();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-lg font-bold">
            HOLE {holeNumber} | PAR {par}
          </SheetTitle>
        </SheetHeader>
        
        {/* Player Info Bar */}
        <div className="bg-primary text-primary-foreground p-4 rounded-lg mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{playerName}</div>
            {handicap !== null && handicap !== undefined && (
              <div className="text-sm opacity-80">{formatHandicapWithPrefix(handicap)}</div>
            )}
          </div>
          <div className="flex flex-col items-center">
            <div className={`bg-background text-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${currentScore === null || currentScore === 0 || currentScore === -1 ? 'text-muted-foreground' : ''}`}>
              {currentScore === -1 ? '–' : currentScore !== null && currentScore > 0 ? currentScore : '0'}
            </div>
            {currentScore === 0 && (
              <span className="text-xs text-muted-foreground mt-1">Strokes</span>
            )}
          </div>
        </div>
        
        <ScoreInputGrid
          par={par}
          currentScore={currentScore}
          onScoreSelect={handleScoreSelect}
          onMore={handleMore}
          onScoreAndAdvance={handleScoreAndAdvance}
        />
      </SheetContent>
    </Sheet>
  );
}
