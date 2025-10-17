import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PGATour18ComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

const distances = [
  { hole: 1, distance: "1.5m (5ft)" },
  { hole: 2, distance: "12m" },
  { hole: 3, distance: "0.6m (2ft)" },
  { hole: 4, distance: "4m" },
  { hole: 5, distance: "1.2m (4ft)" },
  { hole: 6, distance: "16m" },
  { hole: 7, distance: "8m" },
  { hole: 8, distance: "3m" },
  { hole: 9, distance: "6m" },
  { hole: 10, distance: "9m" },
  { hole: 11, distance: "0.9m (3ft)" },
  { hole: 12, distance: "7m" },
  { hole: 13, distance: "2.1m (7ft)" },
  { hole: 14, distance: "3.5m" },
  { hole: 15, distance: "10m" },
  { hole: 16, distance: "1.8m (6ft)" },
  { hole: 17, distance: "5m" },
  { hole: 18, distance: "2.4m (8ft)" },
];

const PGATour18Component = ({ onTabChange, onScoreSaved }: PGATour18ComponentProps) => {
  const [totalPutts, setTotalPutts] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [drillStarted, setDrillStarted] = useState(false);
  const [completedHoles, setCompletedHoles] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const handleSave = async () => {
    const putts = parseInt(totalPutts);
    if (isNaN(putts) || putts < 18 || putts > 100) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid number of putts (18-100)",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure drill exists and get its UUID by title
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'PGA Tour 18 Holes' });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        return;
      }

      // Save drill result to Supabase
      const { error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: putts,
          attempts_json: [{ totalPutts: putts }]
        });

      if (saveError) {
        console.error('Error saving score:', saveError);
        toast({
          title: "Error saving score",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setTotalPutts("");
      
      toast({
        title: "Score Saved",
        description: `Your score of ${putts} putts has been recorded`,
      });

      onScoreSaved?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };


  const handleStartDrill = () => {
    setDrillStarted(true);
    onTabChange?.('score');
  };

  const toggleHoleCompletion = (holeNumber: number) => {
    setCompletedHoles(prev => 
      prev.includes(holeNumber)
        ? prev.filter(h => h !== holeNumber)
        : [...prev, holeNumber]
    );
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

      {drillStarted && (
        <>
          {/* Distances Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Hole Distances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {distances.map((item) => (
                  <div 
                    key={item.hole} 
                    onClick={() => toggleHoleCompletion(item.hole)}
                    className={`flex justify-between items-center p-2 rounded-md cursor-pointer transition-colors ${
                      completedHoles.includes(item.hole)
                        ? 'bg-green-500/20 border-2 border-green-500'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
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
              
              <Button 
                onClick={handleSave}
                disabled={!totalPutts}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Save Score
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default PGATour18Component;