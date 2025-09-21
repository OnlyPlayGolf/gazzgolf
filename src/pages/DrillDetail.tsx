import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Target, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { APP_NAME, STORAGE_KEYS } from "@/constants/app";
import { getStorageItem, setStorageItem, migrateStorageKeys } from "@/utils/storageManager";

interface Score {
  name: string;
  score: number;
  timestamp: number;
}

const DrillDetail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [totalPutts, setTotalPutts] = useState("");
  const [lastScore, setLastScore] = useState<number | null>(null);

  useEffect(() => {
    // Migrate storage keys on first load
    migrateStorageKeys();
    
    // Load scores and find the latest for current user
    const scores: Score[] = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    
    const userScores = scores.filter(score => score.name === displayName);
    if (userScores.length > 0) {
      // Get the most recent score
      const latestScore = userScores.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      setLastScore(latestScore.score);
    }
  }, []);

  const handleSave = () => {
    const putts = parseInt(totalPutts);
    if (isNaN(putts) || putts < 0 || putts > 60) {
      toast({
        title: "Invalid input",
        description: "Please enter a number between 0 and 60",
        variant: "destructive",
      });
      return;
    }

    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    const scores: Score[] = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    
    const newScore: Score = {
      name: displayName,
      score: putts,
      timestamp: Date.now(),
    };
    
    scores.push(newScore);
    setStorageItem(STORAGE_KEYS.PGA18_SCORES, scores);
    
    setLastScore(putts);
    setTotalPutts("");
    
    toast({
      title: "Score saved",
      description: `Total putts: ${putts}`,
    });
  };

  const handleReset = () => {
    const displayName = getStorageItem(STORAGE_KEYS.DISPLAY_NAME, "User");
    const scores: Score[] = getStorageItem(STORAGE_KEYS.PGA18_SCORES, []);
    
    // Remove all scores for current user
    const filteredScores = scores.filter(score => score.name !== displayName);
    setStorageItem(STORAGE_KEYS.PGA18_SCORES, filteredScores);
    
    setLastScore(null);
    setTotalPutts("");
    
    toast({
      title: "Score reset",
      description: "Saved score has been cleared",
    });
  };

  const distances = [
    { hole: 1, distance: "1.5 m" },
    { hole: 2, distance: "12 m" },
    { hole: 3, distance: "0.6 m" },
    { hole: 4, distance: "4 m" },
    { hole: 5, distance: "1.2 m" },
    { hole: 6, distance: "16 m" },
    { hole: 7, distance: "8 m" },
    { hole: 8, distance: "3 m" },
    { hole: 9, distance: "6 m" },
    { hole: 10, distance: "9 m" },
    { hole: 11, distance: "0.9 m" },
    { hole: 12, distance: "7 m" },
    { hole: 13, distance: "2.1 m" },
    { hole: 14, distance: "3.5 m" },
    { hole: 15, distance: "10 m" },
    { hole: 16, distance: "1.8 m" },
    { hole: 17, distance: "5 m" },
    { hole: 18, distance: "2.4 m" },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills/putting')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Target size={24} className="text-primary" />
              PGA Tour 18 Holes
            </h1>
            <p className="text-sm text-muted-foreground">Putting • Mixed distances</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">
                Hit one putt at a time from the distances specified in the test. Vary the direction of the break and whether the putt is uphill or downhill. The exercise works best if you act as if you were in a competition — read the line, go through your routine, etc.
              </p>
            </CardContent>
          </Card>

          {/* Distances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Distances by Hole</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {distances.map((item) => (
                  <div key={item.hole} className="flex justify-between items-center py-1 border-b border-border last:border-b-0">
                    <span className="text-sm font-medium text-foreground">
                      Hole {item.hole}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.distance}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scoring */}
          <Card>
            <CardHeader>
              <CardTitle className="text-primary">Scoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="total-putts" className="text-sm font-medium text-foreground">
                  TOTAL PUTTS
                </Label>
                <Input
                  id="total-putts"
                  type="number"
                  min="0"
                  max="60"
                  value={totalPutts}
                  onChange={(e) => setTotalPutts(e.target.value)}
                  placeholder="Enter total putts (0-60)"
                  className="mt-1"
                />
              </div>

              <Button 
                onClick={handleSave}
                disabled={!totalPutts}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Save Score
              </Button>

              {lastScore !== null && (
                <div className="flex items-center justify-between p-3 bg-golf-light/20 rounded-md">
                  <span className="text-sm text-foreground">
                    Last score: <span className="font-semibold">{lastScore}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <RotateCcw size={16} />
                    Reset Score
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DrillDetail;