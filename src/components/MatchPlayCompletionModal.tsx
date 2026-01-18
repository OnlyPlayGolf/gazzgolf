import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { MatchPlayScorecardView } from "@/components/MatchPlayScorecardView";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface MatchPlayCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: MatchPlayGame;
  holes: MatchPlayHole[];
  courseHoles: CourseHole[];
  onContinue: () => void;
}

export function MatchPlayCompletionModal({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
  onContinue,
}: MatchPlayCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'match_play');

  // Get final match status
  const finalMatchStatus = game.match_status || 0;

  // Prepare stroke play data
  const player1Scores = new Map<number, number>();
  const player2Scores = new Map<number, number>();
  let player1Total = 0;
  let player2Total = 0;
  
  holes.forEach(hole => {
    if (hole.player_1_gross_score && hole.player_1_gross_score > 0) {
      player1Scores.set(hole.hole_number, hole.player_1_gross_score);
      player1Total += hole.player_1_gross_score;
    }
    if (hole.player_2_gross_score && hole.player_2_gross_score > 0) {
      player2Scores.set(hole.hole_number, hole.player_2_gross_score);
      player2Total += hole.player_2_gross_score;
    }
  });

  const strokePlayPlayers = [
    { name: game.player_1, scores: player1Scores, totalScore: player1Total },
    { name: game.player_2, scores: player2Scores, totalScore: player2Total },
  ];

  const player1HolesWon = holes.filter(h => h.hole_result === 1).length;
  const player2HolesWon = holes.filter(h => h.hole_result === -1).length;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to share", variant: "destructive" });
        return;
      }

      // Share as match play scorecard
      const holeScoresObj: Record<number, { player1: number | null; player2: number | null; result: number; statusAfter: number }> = {};
      const holeParsObj: Record<number, number> = {};
      
      holes.forEach(hole => {
        holeScoresObj[hole.hole_number] = {
          player1: hole.player_1_gross_score,
          player2: hole.player_2_gross_score,
          result: hole.hole_result,
          statusAfter: hole.match_status_after,
        };
      });
      
      courseHoles.forEach(hole => {
        holeParsObj[hole.hole_number] = hole.par;
      });

      const scorecardData = JSON.stringify({ holeScores: holeScoresObj, holePars: holeParsObj });
      const resultText = game.final_result || `${player1HolesWon}-${player2HolesWon}`;

      const roundResult = `[MATCH_PLAY_SCORECARD]${game.round_name || 'Match Play'}|${game.course_name}|${game.date_played}|${game.player_1}|${game.player_2}|${resultText}|${game.winner_player || ''}|${game.id}|${scorecardData}[/MATCH_PLAY_SCORECARD]`;
      const postContent = comment.trim() ? `${comment}\n\n${roundResult}` : roundResult;

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postContent,
        });

      if (error) throw error;

      toast({ title: "Shared!", description: "Your match has been posted" });
      setShowShareForm(false);
      setComment("");
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error('Error sharing match:', error);
      toast({ title: "Error", description: "Failed to share match", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    navigate("/");
  };


  return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Match Play Scorecard View - Not clickable in modal */}
        <MatchPlayScorecardView
          roundName={game.round_name || 'Match Play'}
          courseName={game.course_name}
          datePlayed={game.date_played}
          player1Name={game.player_1}
          player2Name={game.player_2}
          matchStatus={finalMatchStatus}
          holes={holes}
          courseHoles={courseHoles}
          strokePlayEnabled={strokePlayEnabled}
          strokePlayPlayers={strokePlayPlayers}
        />

        {/* Actions */}
        <div className="p-4">
          {showShareForm ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Add your post-match thoughts..."
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
            <div className="flex gap-3">
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
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
