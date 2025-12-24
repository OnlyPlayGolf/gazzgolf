import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

interface ScoreInputGridProps {
  par: number;
  currentScore: number | null;
  onScoreSelect: (score: number | null) => void;
  onMore?: () => void;
  onScoreAndAdvance?: (score: number) => void;
}

const getScoreLabel = (score: number, par: number): string | null => {
  if (score === 1) return "Hole in One";
  const diff = score - par;
  if (diff === -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double Bogey";
  if (diff === 3) return "Triple Bogey";
  return null;
};

export function ScoreInputGrid({ par, currentScore, onScoreSelect, onMore, onScoreAndAdvance }: ScoreInputGridProps) {
  const [showHighScores, setShowHighScores] = useState(false);
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const highScores = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  const handleScoreAndAdvance = (score: number) => {
    onScoreSelect(score);
    // If onScoreAndAdvance is provided, call it to advance to next player/hole
    if (onScoreAndAdvance) {
      onScoreAndAdvance(score);
    }
  };
  
  if (showHighScores) {
    return (
      <div className="p-2">
        <Button
          variant="ghost"
          onClick={() => setShowHighScores(false)}
          className="mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="grid grid-cols-5 gap-2">
          {highScores.map((score) => {
            const isSelected = currentScore === score;
            return (
              <Button
                key={score}
                variant="secondary"
                onClick={() => {
                  handleScoreAndAdvance(score);
                  setShowHighScores(false);
                }}
                className={`h-16 flex flex-col items-center justify-center rounded-lg ${
                  isSelected ? "ring-2 ring-primary bg-primary text-primary-foreground hover:bg-primary/90" : ""
                }`}
              >
                <span className="text-2xl font-bold">{score}</span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-3 gap-2 p-2">
      {scores.map((score) => {
        const label = getScoreLabel(score, par);
        const isSelected = currentScore === score;
        const isPar = score === par;
        
        return (
          <Button
            key={score}
            variant="secondary"
            onClick={() => handleScoreAndAdvance(score)}
            className={`h-20 flex flex-col items-center justify-center rounded-lg ${
              isPar 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                : "bg-secondary hover:bg-secondary/80"
            } ${isSelected && !isPar ? "ring-2 ring-primary bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
          >
            <span className="text-3xl font-bold">{score}</span>
            {label && (
              <span className="text-xs mt-0.5">{label}</span>
            )}
          </Button>
        );
      })}
      
      {/* Bottom row: 10+, -, More */}
      <Button
        variant="secondary"
        onClick={() => setShowHighScores(true)}
        className={`h-20 flex flex-col items-center justify-center rounded-lg ${
          currentScore !== null && currentScore >= 10 ? "ring-2 ring-primary bg-primary text-primary-foreground" : ""
        }`}
      >
        <span className="text-3xl font-bold">10+</span>
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => handleScoreAndAdvance(0)}
        className={`h-20 flex flex-col items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 ${
          currentScore === 0 ? "ring-2 ring-primary bg-primary text-primary-foreground" : ""
        }`}
      >
        <span className="text-3xl font-bold">–</span>
        <span className="text-xs mt-0.5">Strokes</span>
      </Button>
      
      <Button
        variant="default"
        onClick={onMore}
        className="h-20 flex flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <span className="text-lg font-bold">More</span>
      </Button>
    </div>
  );
}
