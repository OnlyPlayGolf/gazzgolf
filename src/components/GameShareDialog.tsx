import { useState } from "react";
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
  winner?: string;
  resultText?: string;
  additionalInfo?: string;
  onContinue: () => void;
}

export function GameShareDialog({
  open,
  onOpenChange,
  gameType,
  courseName,
  winner,
  resultText,
  additionalInfo,
  onContinue,
}: GameShareDialogProps) {
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      let content = `🏌️ Just finished a ${gameType} round at ${courseName}!`;
      if (winner) {
        content += `\n🏆 Winner: ${winner}`;
      }
      if (resultText) {
        content += `\n📊 ${resultText}`;
      }
      if (additionalInfo) {
        content += `\n${additionalInfo}`;
      }
      if (comment.trim()) {
        content += `\n\n${comment}`;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content,
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
