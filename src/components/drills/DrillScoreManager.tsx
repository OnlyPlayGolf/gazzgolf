import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from '@supabase/supabase-js';

interface DrillScoreManagerProps {
  drillId: string;
  drillTitle: string;
  attempts: any[];
  totalPoints: number;
  onScoreSaved?: () => void;
}

const DrillScoreManager: React.FC<DrillScoreManagerProps> = ({
  drillId,
  drillTitle,
  attempts,
  totalPoints,
  onScoreSaved
}) => {
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleSaveScore = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your score.",
        variant: "destructive",
      });
      return;
    }

    if (attempts.length === 0) {
      toast({
        title: "No attempts to save",
        description: "Complete some attempts before saving your score.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get drill UUID from drills table
      const { data: drillData, error: drillError } = await (supabase as any)
        .from('drills')
        .select('id')
        .eq('title', drillTitle)
        .single();

      if (drillError || !drillData) {
        console.error('Drill not found:', drillError);
        toast({
          title: "Error",
          description: "Could not find drill in database.",
          variant: "destructive",
        });
        return;
      }

      // Save drill result
      const { error: saveError } = await (supabase as any)
        .from('drill_results')
        .insert({
          drill_id: drillData.id,
          user_id: user.id,
          total_points: totalPoints,
          attempts_json: attempts
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

      toast({
        title: "Score saved!",
        description: `Your score of ${totalPoints} points has been saved.`,
      });

      onScoreSaved?.();
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">Sign in to save your scores and compete with friends!</p>
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Save Your Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
            <span className="font-medium">Total Points:</span>
            <span className="text-lg font-bold text-primary">{totalPoints}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
            <span className="font-medium">Attempts:</span>
            <span>{attempts.length}</span>
          </div>
          <Button 
            onClick={handleSaveScore}
            disabled={saving || attempts.length === 0}
            className="w-full"
          >
            {saving ? "Saving..." : "Save Score"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DrillScoreManager;