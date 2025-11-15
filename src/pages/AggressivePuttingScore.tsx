import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { STORAGE_KEYS } from "@/constants/app";
import { getStorageItem, setStorageItem } from "@/utils/storageManager";

interface Score {
  name: string;
  score: number;
  timestamp: number;
}
interface Attempt {
  attemptNumber: number;
  distance: number;
  outcome: string;
  points: number;
}

export default function AggressivePuttingScore() {
  const { toast } = useToast();
  
  const [points, setPoints] = useState(0);
  const [putts, setPutts] = useState(0);
  const [distanceIndex, setDistanceIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  
  const distances = [4, 5, 6]; // meters, cycling pattern
  const targetPoints = 15;
  const tourAverage = 12.28;

  useEffect(() => {
    // Load existing scores
    const scores: Score[] = getStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, []);
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    
    // Find user's most recent score
    const userScores = scores.filter(score => score.name === displayName);
    if (userScores.length > 0) {
      const mostRecentScore = userScores.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      setLastScore(mostRecentScore);
    }
  }, []);

  const handleOutcome = (outcome: 'holed' | 'good-pace' | 'short' | 'long-miss') => {
    if (isFinished) return;

    let pointChange = 0;
    switch (outcome) {
      case 'holed':
        pointChange = 3;
        break;
      case 'good-pace':
        pointChange = 1;
        break;
      case 'short':
        pointChange = -3;
        break;
      case 'long-miss':
        pointChange = -3;
        break;
    }

    // Record attempt before updating indices
    const outcomeLabels: Record<string, string> = {
      'holed': 'Holed',
      'good-pace': 'Good Pace',
      'short': 'Short',
      'long-miss': 'Long Miss',
    };

    const attempt: Attempt = {
      attemptNumber: putts + 1,
      distance: distances[distanceIndex],
      outcome: outcomeLabels[outcome],
      points: pointChange,
    };
    setAttempts((prev) => [...prev, attempt]);

    const newPoints = Math.max(0, points + pointChange);
    const newPutts = putts + 1;
    const newDistanceIndex = (distanceIndex + 1) % distances.length;

    setPoints(newPoints);
    setPutts(newPutts);
    setDistanceIndex(newDistanceIndex);

    if (newPoints >= targetPoints) {
      setIsFinished(true);
      handleSave(newPutts);
    }
  };

  const handleSave = (finalPutts: number) => {
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    
    const newScore: Score = {
      name: displayName,
      score: finalPutts,
      timestamp: Date.now(),
    };

    const existingScores: Score[] = getStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, []);
    const updatedScores = [...existingScores, newScore];
    setStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, updatedScores);
    
    setLastScore(newScore);
    
    const comparison = finalPutts < tourAverage ? "Better than tour average!" : 
                     finalPutts === tourAverage ? "Right on tour average!" : 
                     "Keep practicing to beat the tour average!";
    
    toast({
      title: "Score Saved!",
      description: `${finalPutts} putts - ${comparison}`,
    });
  };

  const handleReset = () => {
    setPoints(0);
    setPutts(0);
    setDistanceIndex(0);
    setIsFinished(false);
  };

  const handleResetScores = () => {
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    const existingScores: Score[] = getStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, []);
    const filteredScores = existingScores.filter(score => score.name !== displayName);
    setStorageItem(STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, filteredScores);
    setLastScore(null);
    
    toast({
      title: "Scores Reset",
      description: "All your scores for this drill have been cleared.",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="text-primary" />
              Putt {putts + 1}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-lg">Score: {points}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-2">Distance</div>
            <div className="text-4xl font-bold text-foreground">
              {distances[distanceIndex]}m
            </div>
          </div>

          {!isFinished && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center mb-2">Select outcome:</p>
              <Button onClick={() => handleOutcome('holed')} className="w-full" variant="outline" size="lg">
                <span className="flex-1 text-left">Holed</span>
                <span className="font-bold">+3</span>
              </Button>
              <Button onClick={() => handleOutcome('good-pace')} className="w-full" variant="outline" size="lg">
                <span className="flex-1 text-left">Good Pace</span>
                <span className="font-bold">+1</span>
              </Button>
              <Button onClick={() => handleOutcome('short')} className="w-full" variant="outline" size="lg">
                <span className="flex-1 text-left">Short</span>
                <span className="font-bold">-3</span>
              </Button>
              <Button onClick={() => handleOutcome('long-miss')} className="w-full" variant="outline" size="lg">
                <span className="flex-1 text-left">Long Miss</span>
                <span className="font-bold">-3</span>
              </Button>
            </div>
          )}

          <Button onClick={handleReset} variant="ghost" className="w-full">
            Reset Drill
          </Button>
        </CardContent>
      </Card>

      {attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attempt History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...attempts].reverse().map((attempt) => (
                <div key={attempt.attemptNumber} className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-sm">Putt {attempt.attemptNumber}: {attempt.distance}m</span>
                  <span className="text-sm font-semibold">{attempt.outcome} ({attempt.points > 0 ? '+' : ''}{attempt.points})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
