import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStorageItem, setStorageItem } from "@/utils/storageManager";
import { STORAGE_KEYS } from "@/constants/app";

interface PGATour18ComponentProps {
  onTabChange: (tab: string) => void;
}

interface Score {
  name: string;
  score: number;
  timestamp: number;
}

const distances = [
  { hole: 1, distance: "2.5m" },
  { hole: 2, distance: "4.1m" },
  { hole: 3, distance: "3.2m" },
  { hole: 4, distance: "5.8m" },
  { hole: 5, distance: "2.1m" },
  { hole: 6, distance: "3.7m" },
  { hole: 7, distance: "4.5m" },
  { hole: 8, distance: "2.9m" },
  { hole: 9, distance: "6.2m" },
  { hole: 10, distance: "3.4m" },
  { hole: 11, distance: "4.8m" },
  { hole: 12, distance: "2.3m" },
  { hole: 13, distance: "5.1m" },
  { hole: 14, distance: "3.8m" },
  { hole: 15, distance: "4.2m" },
  { hole: 16, distance: "2.7m" },
  { hole: 17, distance: "5.5m" },
  { hole: 18, distance: "3.9m" },
];

const PGATour18Component = ({ onTabChange }: PGATour18ComponentProps) => {
  const [totalPutts, setTotalPutts] = useState<string>("");
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load last score
    const scores = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    if (scores.length > 0) {
      setLastScore(scores[scores.length - 1]);
    }
  }, []);

  const handleSave = () => {
    const putts = parseInt(totalPutts);
    if (isNaN(putts) || putts < 18 || putts > 100) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number of putts (18-100)",
        variant: "destructive",
      });
      return;
    }

    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, null) || "Anonymous";
    
    const newScore = {
      name: displayName,
      score: putts,
      timestamp: Date.now(),
    };

    const existingScores = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    existingScores.push(newScore);
    setStorageItem(STORAGE_KEYS.PGA18_SCORES, existingScores);
    
    setLastScore(newScore);
    setTotalPutts("");
    
    toast({
      title: "Score Saved",
      description: `Your score of ${putts} putts has been recorded`,
    });
  };

  const handleReset = () => {
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, null) || "Anonymous";
    const existingScores = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    const filteredScores = existingScores.filter((score: Score) => score.name !== displayName);
    
    setStorageItem(STORAGE_KEYS.PGA18_SCORES, filteredScores);
    setLastScore(null);
    setTotalPutts("");
    
    toast({
      title: "Score Reset",
      description: "Your scores have been cleared",
    });
  };

  const handleStartDrill = () => {
    onTabChange('score');
  };

  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="text-primary" size={20} />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Practice putting at the distances shown below. Each hole represents the average first putt distance for that hole on the PGA Tour.
          </p>
          <Button 
            onClick={handleStartDrill}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Start Drill
          </Button>
        </CardContent>
      </Card>

      {/* Distances Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Hole Distances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {distances.map((item) => (
              <div key={item.hole} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                <span className="font-medium">Hole {item.hole}</span>
                <span className="text-muted-foreground">{item.distance}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scoring Section */}
      <Card>
        <CardHeader>
          <CardTitle>Record Your Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastScore && (
            <div className="p-3 bg-muted/50 rounded-md">
              <div className="text-sm text-muted-foreground">Last Score</div>
              <div className="font-medium">{lastScore.score} putts</div>
              <div className="text-xs text-muted-foreground">
                {new Date(lastScore.timestamp).toLocaleDateString()}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="total-putts">Total Putts (18 holes)</Label>
            <Input
              id="total-putts"
              type="number"
              min="18"
              max="100"
              value={totalPutts}
              onChange={(e) => setTotalPutts(e.target.value)}
              placeholder="Enter total putts"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSave}
              disabled={!totalPutts}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Save Score
            </Button>
            {lastScore && (
              <Button 
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                Reset Score
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PGATour18Component;