import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Share2, Loader2 } from "lucide-react";

interface GameShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameType: string;
  courseName: string;
  roundName?: string;
  winner?: string;
  resultText?: string;
  additionalInfo?: string;
  gameId?: string;
  onContinue: () => void;
  showShareFormOnly?: boolean;
}

export function GameShareDialog({
  open,
  onOpenChange,
  gameType,
  courseName,
  roundName,
  winner,
  resultText,
  additionalInfo,
  gameId,
  onContinue,
  showShareFormOnly = false,
}: GameShareDialogProps) {
  const [showShareForm, setShowShareForm] = useState(showShareFormOnly);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  // Reset share form state when dialog opens based on mode
  useEffect(() => {
    if (open) {
      setShowShareForm(showShareFormOnly);
      setComment("");
    }
  }, [open, showShareFormOnly]);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Create structured game result marker (now includes roundName)
      const gameResult = `[GAME_RESULT]${gameType}|${courseName}|${roundName || ''}|${winner || ''}|${resultText || ''}|${additionalInfo || ''}|${gameId || ''}[/GAME_RESULT]`;
      const postContent = comment.trim()
        ? `${comment}\n\n${gameResult}`
        : gameResult;

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: postContent,
      });

      if (error) throw error;

      toast({ title: "Shared to feed!" });
      onOpenChange(false);
      onContinue();
    } catch (error) {
      console.error("Error sharing:", error);
      toast({ title: "Failed to share", variant: "destructive" });
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
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Round Complete!
          </DialogTitle>
          <DialogDescription>
            Share your {gameType} results with friends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Result Preview */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">{courseName}</p>
            {winner && (
              <p className="font-semibold text-primary">{winner}</p>
            )}
            {resultText && (
              <p className="text-sm">{resultText}</p>
            )}
            {additionalInfo && (
              <p className="text-xs text-muted-foreground">{additionalInfo}</p>
            )}
          </div>

          {showShareForm ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Add a comment (optional)..."
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  Post
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowShareForm(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button className="flex-1" onClick={handleContinue}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
