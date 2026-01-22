import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DrillCompletionDialog } from "@/components/DrillCompletionDialog";
import { useNavigate } from "react-router-dom";

interface EasyChipComponentProps {
  onTabChange?: (tab: string) => void;
  onScoreSaved?: () => void;
}

const EasyChipComponent = ({ onTabChange, onScoreSaved }: EasyChipComponentProps) => {
  const [consecutiveMakes, setConsecutiveMakes] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [savedScore, setSavedScore] = useState<number>(0);
  const [savedResultId, setSavedResultId] = useState<string | undefined>();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  const saveScore = async () => {
    const score = parseInt(consecutiveMakes, 10);
    if (isNaN(score) || score < 0) {
      toast({
        title: "Invalid score",
        description: "Please enter a valid number.",
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
      const { data: drillId, error: drillError } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: 'Easy Chip Drill' });

      if (drillError || !drillId) {
        console.error('Drill not found or could not create:', drillError);
        toast({
          title: "Error",
          description: "Could not save score.",
          variant: "destructive",
        });
        return;
      }

      const { data: resultData, error: resultError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillId,
          user_id: userId,
          total_points: score,
          attempts_json: { consecutive_makes: score }
        })
        .select('id')
        .single();

      if (resultError) throw resultError;

      setSavedScore(score);
      setSavedResultId(resultData?.id);
      setShowCompletionDialog(true);
      setConsecutiveMakes('');
      onScoreSaved?.();
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Error",
        description: "Failed to save score. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCompletionContinue = () => {
    // Navigation is now handled by DrillCompletionDialog
    onScoreSaved?.();
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" size={20} />
              Easy Chip Drill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-3 bg-primary text-primary-foreground rounded-md text-center">
              <div className="text-sm text-primary-foreground/80">Distance</div>
              <div className="text-2xl font-bold text-primary-foreground">10 meters from fairway</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                How many chips in a row stopped within one wedge length of the hole?
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={consecutiveMakes}
                onChange={(e) => setConsecutiveMakes(e.target.value)}
                placeholder="Enter number"
                className="text-center text-2xl h-14"
              />
            </div>

          </CardContent>
        </Card>
      </div>

      <DrillCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        drillTitle="Easy Chip Drill"
        score={savedScore}
        unit="consecutive chips"
        resultId={savedResultId}
        onContinue={handleCompletionContinue}
      />
    </>
  );
};

export default EasyChipComponent;
