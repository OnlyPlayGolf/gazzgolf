import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScoreInputGrid } from "./ScoreInputGrid";

interface PlayerScoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  handicap?: number | string | null;
  par: number;
  holeNumber: number;
  currentScore: number | null;
  onScoreSelect: (score: number | null) => void;
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
}: PlayerScoreSheetProps) {
  const formatHandicap = (hcp: number | string | null | undefined): string => {
    if (hcp === null || hcp === undefined) return "";
    const numHcp = typeof hcp === 'string' ? parseFloat(hcp) : hcp;
    if (isNaN(numHcp)) return "";
    if (numHcp < 0) return `HCP +${Math.abs(numHcp).toFixed(1)}`;
    if (numHcp === 0) return "HCP 0";
    return `HCP ${numHcp.toFixed(1)}`;
  };

  const handleScoreSelect = (score: number | null) => {
    onScoreSelect(score);
    if (score !== null) {
      onOpenChange(false);
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
              <div className="text-sm opacity-80">{formatHandicap(handicap)}</div>
            )}
          </div>
          <div className="bg-background text-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
            {currentScore ?? 0}
          </div>
        </div>
        
        <ScoreInputGrid
          par={par}
          currentScore={currentScore}
          onScoreSelect={handleScoreSelect}
        />
      </SheetContent>
    </Sheet>
  );
}
