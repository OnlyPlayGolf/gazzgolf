import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2 } from "lucide-react";
import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { format } from "date-fns";
import { UmbriagioScorecardView } from "@/components/UmbriagioScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";

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
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'umbriago');

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

  const { normalizedA, normalizedB } = normalizeUmbriagioPoints(
    game.team_a_total_points, 
    game.team_b_total_points
  );

  const getScoreDisplay = () => {
    return `${normalizedA} - ${normalizedB}`;
  };

  // Calculate match result from user's perspective
  const winningTeam = game.winning_team;
  let matchResult: string = '—';
  let resultText = `${normalizedA} - ${normalizedB}`;
  
  if (winningTeam === 'TIE') {
    matchResult = 'T';
  } else if (winningTeam === currentUserTeam) {
    matchResult = 'W';
  } else if (winningTeam) {
    matchResult = 'L';
  }

  // Prepare stroke play players data from individual player scores in holes
  const buildStrokePlayPlayers = () => {
    const player1Scores = new Map<number, number>();
    const player2Scores = new Map<number, number>();
    const player3Scores = new Map<number, number>();
    const player4Scores = new Map<number, number>();
    
    let player1Total = 0;
    let player2Total = 0;
    let player3Total = 0;
    let player4Total = 0;

    holes.forEach(hole => {
      // Team A Player 1
      if (hole.team_a_player_1_score !== null && hole.team_a_player_1_score > 0) {
        player1Scores.set(hole.hole_number, hole.team_a_player_1_score);
        player1Total += hole.team_a_player_1_score;
      }
      // Team A Player 2
      if (hole.team_a_player_2_score !== null && hole.team_a_player_2_score > 0) {
        player2Scores.set(hole.hole_number, hole.team_a_player_2_score);
        player2Total += hole.team_a_player_2_score;
      }
      // Team B Player 1
      if (hole.team_b_player_1_score !== null && hole.team_b_player_1_score > 0) {
        player3Scores.set(hole.hole_number, hole.team_b_player_1_score);
        player3Total += hole.team_b_player_1_score;
      }
      // Team B Player 2
      if (hole.team_b_player_2_score !== null && hole.team_b_player_2_score > 0) {
        player4Scores.set(hole.hole_number, hole.team_b_player_2_score);
        player4Total += hole.team_b_player_2_score;
      }
    });

    return [
      { name: game.team_a_player_1, scores: player1Scores, totalScore: player1Total },
      { name: game.team_a_player_2, scores: player2Scores, totalScore: player2Total },
      { name: game.team_b_player_1, scores: player3Scores, totalScore: player3Total },
      { name: game.team_b_player_2, scores: player4Scores, totalScore: player4Total },
    ];
  };

  const strokePlayPlayers = buildStrokePlayPlayers();

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Build scorecard data for the post
      const holePointsData: Record<number, { teamA: number; teamB: number }> = {};
      const holeParsData: Record<number, number> = {};
      
      holes.forEach(hole => {
        holePointsData[hole.hole_number] = {
          teamA: hole.team_a_hole_points,
          teamB: hole.team_b_hole_points
        };
      });
      
      courseHoles.forEach(hole => {
        holeParsData[hole.hole_number] = hole.par;
      });

      const scorecardJson = JSON.stringify({
        holePoints: holePointsData,
        holePars: holeParsData
      });

      // Create structured umbriago scorecard marker
      // Format: [UMBRIAGO_SCORECARD]roundName|courseName|date|teamAName|teamBName|normalizedA|normalizedB|winningTeam|currentUserTeam|gameId|scorecardJson[/UMBRIAGO_SCORECARD]
      const umbriagioScorecard = `[UMBRIAGO_SCORECARD]${game.round_name || 'Umbriago'}|${game.course_name}|${game.date_played}|${game.team_a_name}|${game.team_b_name}|${normalizedA}|${normalizedB}|${game.winning_team || ''}|${currentUserTeam || ''}|${game.id}|${scorecardJson}[/UMBRIAGO_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${umbriagioScorecard}`
        : umbriagioScorecard;

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: postContent,
      });

      if (error) throw error;

      toast({ title: "Shared to feed!" });
      onOpenChange(false);
      navigate("/");
    } catch (error) {
      console.error("Error sharing:", error);
      toast({ title: "Failed to share", variant: "destructive" });
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
        {/* Use UmbriagioScorecardView - matches shared post exactly */}
        <div className="flex-1 overflow-y-auto">
          <UmbriagioScorecardView
            roundName={game.round_name || 'Umbriago'}
            courseName={game.course_name}
            datePlayed={game.date_played}
            playerCount={4}
            matchResult={matchResult}
            resultText={resultText}
            game={game}
            holes={holes}
            courseHoles={courseHoles}
            currentUserTeam={currentUserTeam}
            strokePlayEnabled={strokePlayEnabled}
            strokePlayPlayers={strokePlayPlayers}
          />
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex-shrink-0">
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
