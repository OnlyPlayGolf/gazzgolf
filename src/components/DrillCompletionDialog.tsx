import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Share2, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DrillCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drillTitle: string;
  score: number;
  unit?: string;
  onContinue: () => void;
}

export function DrillCompletionDialog({
  open,
  onOpenChange,
  drillTitle,
  score,
  unit = "points",
  onContinue,
}: DrillCompletionDialogProps) {
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      checkPersonalBest();
    }
  }, [open, drillTitle, score]);

  const checkPersonalBest = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: drillId } = await (supabase as any)
        .rpc('get_or_create_drill_by_title', { p_title: drillTitle });

      if (!drillId) {
        setLoading(false);
        return;
      }

      // Check if lower is better for this drill
      const { data: drillData } = await supabase
        .from('drills')
        .select('lower_is_better')
        .eq('id', drillId)
        .single();

      const lowerIsBetter = drillData?.lower_is_better ?? false;

      // Get previous best (excluding current result which was just saved)
      const { data: results } = await supabase
        .from('drill_results')
        .select('total_points')
        .eq('drill_id', drillId)
        .eq('user_id', user.id)
        .order('total_points', { ascending: lowerIsBetter })
        .limit(2);

      if (results && results.length > 0) {
        const previousBest = results.length > 1 ? results[1].total_points : results[0].total_points;
        
        if (lowerIsBetter) {
          setIsPersonalBest(score <= previousBest && results.length === 1 || score < previousBest);
        } else {
          setIsPersonalBest(score >= previousBest && results.length === 1 || score > previousBest);
        }
      } else {
        // First attempt is always a PB
        setIsPersonalBest(true);
      }
    } catch (error) {
      console.error('Error checking personal best:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to share", variant: "destructive" });
        return;
      }

      // Create structured post content with drill result marker
      const drillResult = `[DRILL_RESULT]${drillTitle}|${score}|${unit}|${isPersonalBest}[/DRILL_RESULT]`;
      const postContent = comment.trim()
        ? `${comment}\n\n${drillResult}`
        : drillResult;

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
        });

      if (error) throw error;

      toast({ title: "Shared!", description: "Your result has been posted" });
      setShowShareForm(false);
      setComment("");
      onOpenChange(false);
      onContinue();
    } catch (error) {
      console.error('Error sharing result:', error);
      toast({ title: "Error", description: "Failed to share result", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {loading ? "Loading..." : isPersonalBest ? "🏆 Personal Best!" : "Drill Complete"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {isPersonalBest && !loading && (
            <div className="flex items-center justify-center p-3 rounded-full bg-primary/20">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          )}
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{drillTitle}</p>
            <p className="text-4xl font-bold text-foreground">{score}</p>
            <p className="text-sm text-muted-foreground">{unit}</p>
          </div>

          {showShareForm ? (
            <div className="w-full space-y-3">
              <Textarea
                placeholder="Add a comment about your result..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowShareForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Post"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowShareForm(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                className="flex-1"
                onClick={handleContinue}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
