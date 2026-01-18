import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, ArrowRight, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface RoundShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundName: string;
  courseName: string;
  score: number;
  scoreVsPar: number;
  holesPlayed: number;
  roundId?: string;
  onContinue: () => void;
}

export function RoundShareDialog({
  open,
  onOpenChange,
  roundName,
  courseName,
  score,
  scoreVsPar,
  holesPlayed,
  roundId,
  onContinue,
}: RoundShareDialogProps) {
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const formatScoreVsPar = (diff: number) => {
    if (diff === 0) return "E";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to share", variant: "destructive" });
        return;
      }

      // Create structured post content with round result marker (include roundId if available)
      const roundResult = roundId 
        ? `[ROUND_RESULT]${roundName}|${courseName}|${score}|${scoreVsPar}|${holesPlayed}|${roundId}[/ROUND_RESULT]`
        : `[ROUND_RESULT]${roundName}|${courseName}|${score}|${scoreVsPar}|${holesPlayed}[/ROUND_RESULT]`;
      const postContent = comment.trim()
        ? `${comment}\n\n${roundResult}`
        : roundResult;

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
        });

      if (error) throw error;

      toast({ title: "Shared!", description: "Your round has been posted" });
      setShowShareForm(false);
      setComment("");
      onOpenChange(false);
      onContinue();
    } catch (error) {
      console.error('Error sharing round:', error);
      toast({ title: "Error", description: "Failed to share round", variant: "destructive" });
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
          <DialogTitle className="text-center">Round Complete</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center p-3 rounded-full bg-primary/20">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{courseName}</p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div>
                <p className="text-4xl font-bold text-foreground">{score}</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className={`text-4xl font-bold ${scoreVsPar <= 0 ? 'text-green-500' : scoreVsPar <= 5 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {formatScoreVsPar(scoreVsPar)}
                </p>
                <p className="text-xs text-muted-foreground">vs Par</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{holesPlayed} holes</p>
          </div>

          {showShareForm ? (
            <div className="w-full space-y-3">
              <Textarea
                ref={commentTextareaRef}
                placeholder="Add your post-round thoughts..."
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  const textarea = commentTextareaRef.current;
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                  }
                }}
                className="min-h-[2.5rem] resize-none overflow-hidden"
                rows={1}
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
                Done
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
