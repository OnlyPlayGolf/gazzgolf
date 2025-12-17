import { Button } from "@/components/ui/button";

interface ScoreInputGridProps {
  par: number;
  currentScore: number | null;
  onScoreSelect: (score: number | null) => void;
}

const getScoreLabel = (score: number, par: number): string | null => {
  const diff = score - par;
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double Bogey";
  return null;
};

export function ScoreInputGrid({ par, currentScore, onScoreSelect }: ScoreInputGridProps) {
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
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
            onClick={() => onScoreSelect(score)}
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
      
      {/* Bottom row: Clear, -, 10+ */}
      <Button
        variant="secondary"
        onClick={() => onScoreSelect(null)}
        className="h-20 flex flex-col items-center justify-center rounded-lg"
      >
        <span className="text-lg font-semibold">Clear</span>
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => onScoreSelect(0)}
        className={`h-20 flex flex-col items-center justify-center rounded-lg ${
          currentScore === 0 ? "ring-2 ring-primary bg-primary text-primary-foreground" : ""
        }`}
      >
        <span className="text-3xl font-bold">—</span>
      </Button>
      
      <Button
        variant="secondary"
        onClick={() => onScoreSelect(10)}
        className={`h-20 flex flex-col items-center justify-center rounded-lg ${
          currentScore !== null && currentScore >= 10 ? "ring-2 ring-primary bg-primary text-primary-foreground" : ""
        }`}
      >
        <span className="text-3xl font-bold">10+</span>
      </Button>
    </div>
  );
}
