import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RoundCard, RoundCardData } from "@/components/RoundCard";
import { StrokePlayScorecardView } from "@/components/StrokePlayScorecardView";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface RoundCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  datePlayed: string;
  holesPlayed: number;
  totalScore: number;
  scoreVsPar: number;
  totalPar: number;
  courseHoles: CourseHole[];
  holeScores: Map<number, number>;
  roundId?: string;
  roundName: string;
  playerName?: string; // Optional player name, defaults to "Player" if not provided
  onContinue: () => void;
}

export function RoundCompletionModal({
  open,
  onOpenChange,
  courseName,
  datePlayed,
  holesPlayed,
  totalScore,
  scoreVsPar,
  totalPar,
  courseHoles,
  holeScores,
  roundId,
  roundName,
  playerName = "Player",
  onContinue,
}: RoundCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset textarea height when share form is closed
  useEffect(() => {
    if (!showShareForm && commentTextareaRef.current) {
      commentTextareaRef.current.style.height = '2.5rem';
      setComment("");
    }
  }, [showShareForm]);

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

      // Prepare scorecard data as JSON for the extended format
      const holeScoresObj: Record<number, number> = {};
      const holeParsObj: Record<number, number> = {};
      courseHoles.forEach(hole => {
        const score = holeScores.get(hole.hole_number);
        if (score && score > 0) {
          holeScoresObj[hole.hole_number] = score;
        }
        holeParsObj[hole.hole_number] = hole.par;
      });
      
      const scorecardData = JSON.stringify({ scores: holeScoresObj, pars: holeParsObj, totalPar });

      // Extended format with scorecard: [ROUND_SCORECARD]name|course|date|score|vspar|holes|totalPar|roundId|scorecardJson[/ROUND_SCORECARD]
      const roundResult = `[ROUND_SCORECARD]${roundName}|${courseName}|${datePlayed}|${totalScore}|${scoreVsPar}|${holesPlayed}|${totalPar}|${roundId || ''}|${scorecardData}[/ROUND_SCORECARD]`;
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
      navigate("/");
    } catch (error) {
      console.error('Error sharing round:', error);
      toast({ title: "Error", description: "Failed to share round", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    navigate("/");
  };

  const handleHeaderClick = () => {
    if (roundId) {
      navigate(`/rounds/${roundId}/leaderboard`);
    }
  };

  const handleScorecardClick = () => {
    handleHeaderClick();
  };

  // Calculate total score from holeScores
  const calculatedTotalScore = Array.from(holeScores.values())
    .reduce((sum, score) => sum + (score && score > 0 ? score : 0), 0);

  // Convert single player's holeScores to PlayerScore format for StrokePlayScorecardView
  const strokePlayPlayers = [{
    name: playerName,
    scores: holeScores,
    totalScore: calculatedTotalScore || totalScore,
  }];

  // Build RoundCardData for the header
  const roundCardData: RoundCardData = {
    id: roundId || '',
    round_name: roundName,
    course_name: courseName,
    date: datePlayed,
    score: scoreVsPar,
    playerCount: 1,
    gameMode: 'Stroke Play',
    gameType: 'round',
    totalScore: totalScore,
    holesPlayed: holesPlayed,
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Round Card Header - Clickable to navigate to leaderboard */}
        <div onClick={handleHeaderClick} className="cursor-pointer">
          <RoundCard 
            round={roundCardData} 
            className="border-0 shadow-none hover:shadow-none rounded-t-lg"
          />
        </div>

        {/* Scorecard - Using StrokePlayScorecardView (compact scorecard table, same as in-game leaderboard) */}
        {courseHoles.length > 0 && (
          <div onClick={handleScorecardClick} className="cursor-pointer px-4 pt-3 pb-4">
            <StrokePlayScorecardView
              players={strokePlayPlayers}
              courseHoles={courseHoles}
            />
          </div>
        )}

        {/* Actions */}
        <div className="p-4">
          {showShareForm ? (
            <div className="space-y-3">
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
