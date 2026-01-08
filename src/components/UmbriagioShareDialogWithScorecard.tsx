import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2, Trophy } from "lucide-react";
import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { UmbriagioScorecard } from "@/components/UmbriagioScorecard";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface UmbriagioShareDialogWithScorecardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: UmbriagioGame;
  holes: UmbriagioHole[];
  courseHoles: CourseHole[];
  currentUserTeam: 'A' | 'B' | null;
  onContinue: () => void;
}

export function UmbriagioShareDialogWithScorecard({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
  currentUserTeam,
  onContinue,
}: UmbriagioShareDialogWithScorecardProps) {
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

  const getWinnerName = () => {
    if (game.winning_team === 'A') return `${game.team_a_player_1} & ${game.team_a_player_2}`;
    if (game.winning_team === 'B') return `${game.team_b_player_1} & ${game.team_b_player_2}`;
    return undefined;
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      const { normalizedA, normalizedB } = normalizeUmbriagioPoints(
        game.team_a_total_points, 
        game.team_b_total_points
      );

      // Create structured game result marker
      const gameResult = `[GAME_RESULT]Umbriago|${game.course_name}|${game.round_name || ''}|${getWinnerName() || ''}|${normalizedA} - ${normalizedB}|Team A vs Team B|${game.id}[/GAME_RESULT]`;
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
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Round Complete!
          </DialogTitle>
          <DialogDescription>
            {game.course_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-4">
          <div className="space-y-4 pb-4">
            {/* Scorecard - same design as leaderboard */}
            <UmbriagioScorecard
              game={game}
              holes={holes}
              courseHoles={courseHoles}
              currentUserTeam={currentUserTeam}
            />

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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
