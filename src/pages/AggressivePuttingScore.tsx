import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { STORAGE_KEYS } from "@/constants/app";
import { getStorageItem, setStorageItem } from "@/utils/storageManager";

interface Score {
  name: string;
  score: number;
  timestamp: number;
}

export default function AggressivePuttingScore() {
  const { toast } = useToast();
  
  const [points, setPoints] = useState(0);
  const [putts, setPutts] = useState(0);
  const [distanceIndex, setDistanceIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  
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
    <div className="space-y-6">
      {/* Point System */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trophy size={20} className="text-primary" />
            Point System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">
            Objective: Reach 15 points in as few putts as possible
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 p-2 bg-green-600/10 rounded">
              <span className="font-semibold text-green-600">+3</span>
              <span className="text-foreground">Holed</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-blue-600/10 rounded">
              <span className="font-semibold text-blue-600">+1</span>
              <span className="text-foreground">Good Pace (within 1m past)</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-orange-600/10 rounded">
              <span className="font-semibold text-orange-600">-3</span>
              <span className="text-foreground">Short (doesn't reach)</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-red-600/10 rounded">
              <span className="font-semibold text-red-600">-3</span>
              <span className="text-foreground">Long + Miss Return (&gt;1m)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Target size={20} className="text-primary" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{distances[distanceIndex]}m</div>
              <div className="text-sm text-muted-foreground">Next Distance</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{points}/15</div>
              <div className="text-sm text-muted-foreground">Points</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{putts}</div>
              <div className="text-sm text-muted-foreground">Putts</div>
            </div>
          </div>
          
          {isFinished && (
            <div className="text-center space-y-2 p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-center gap-2">
                <Trophy size={20} className="text-primary" />
                <span className="font-bold text-foreground">Drill Complete!</span>
              </div>
              <div className="text-lg font-bold text-foreground">Score: {putts} putts</div>
              <div className="text-sm text-muted-foreground">Tour Average: {tourAverage} putts</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outcome Buttons */}
      {!isFinished && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground">Record Outcome</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => handleOutcome('holed')}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Holed (+3 points)
            </Button>
            <Button 
              onClick={() => handleOutcome('good-pace')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Good Pace (+1 point)
            </Button>
            <Button 
              onClick={() => handleOutcome('short')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Short (-3 points)
            </Button>
            <Button 
              onClick={() => handleOutcome('long-miss')}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Long + Miss Return (-3 points)
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
