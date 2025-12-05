import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, ArrowRight, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UmbriagioShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  teamAPoints: number;
  teamBPoints: number;
  winningTeam: 'A' | 'B' | 'TIE' | null;
  teamAPlayers: string;
  teamBPlayers: string;
  onContinue: () => void;
}

export function UmbriagioShareDialog({
  open,
  onOpenChange,
  courseName,
  teamAPoints,
  teamBPoints,
  winningTeam,
  teamAPlayers,
  teamBPlayers,
  onContinue,
}: UmbriagioShareDialogProps) {
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to share", variant: "destructive" });
        return;
      }

      // Create structured post content with umbriago result marker
      const umbriagioResult = `[UMBRIAGO_RESULT]${courseName}|${teamAPoints}|${teamBPoints}|${winningTeam}|${teamAPlayers}|${teamBPlayers}[/UMBRIAGO_RESULT]`;
      const postContent = comment.trim()
        ? `${comment}\n\n${umbriagioResult}`
        : umbriagioResult;

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
        });

      if (error) throw error;

      toast({ title: "Shared!", description: "Your Umbriago game has been posted" });
      setShowShareForm(false);
      setComment("");
      onOpenChange(false);
      onContinue();
    } catch (error) {
      console.error('Error sharing umbriago game:', error);
      toast({ title: "Error", description: "Failed to share game", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue();
  };

  const getWinnerText = () => {
    if (winningTeam === 'TIE') return 'Tie Game!';
    if (winningTeam === 'A') return `Team A Wins!`;
    if (winningTeam === 'B') return `Team B Wins!`;
    return 'Game Complete';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Umbriago Complete</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center p-3 rounded-full bg-yellow-500/20">
            <Trophy className="h-8 w-8 text-yellow-500" />
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{courseName}</p>
            <p className="text-lg font-bold mt-1">{getWinnerText()}</p>
            
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{teamAPoints}</p>
                <p className="text-xs text-muted-foreground">Team A</p>
              </div>
              <span className="text-lg font-bold text-muted-foreground">vs</span>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{teamBPoints}</p>
                <p className="text-xs text-muted-foreground">Team B</p>
              </div>
            </div>
          </div>

          {showShareForm ? (
            <div className="w-full space-y-3">
              <Textarea
                placeholder="Add your post-game thoughts..."
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
