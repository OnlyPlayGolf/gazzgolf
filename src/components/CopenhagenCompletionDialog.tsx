import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2 } from "lucide-react";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { normalizePoints } from "@/utils/copenhagenScoring";
import { CopenhagenScorecardView } from "@/components/CopenhagenScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface CopenhagenCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: CopenhagenGame;
  holes: CopenhagenHole[];
  courseHoles: CourseHole[];
}

export function CopenhagenCompletionDialog({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
}: CopenhagenCompletionDialogProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [userPosition, setUserPosition] = useState<number>(1);
  const { toast } = useToast();
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'copenhagen');

  const normalizedPts = normalizePoints(
    game.player_1_total_points,
    game.player_2_total_points,
    game.player_3_total_points
  );

  const playersUnsorted = [
    { index: 1, name: game.player_1, points: normalizedPts.player1 },
    { index: 2, name: game.player_2, points: normalizedPts.player2 },
    { index: 3, name: game.player_3, points: normalizedPts.player3 },
  ];

  const players = [...playersUnsorted].sort((a, b) => b.points - a.points);

  // Final score format: "8-3-0" (sorted by points descending)
  const finalScore = `${players[0].points}-${players[1].points}-${players[2].points}`;
  const winner = players[0];

  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
      
      // Fetch current user's profile to determine their position
      // Using same logic as unifiedRoundsLoader.ts for Profile round cards
      const fetchUserPosition = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Get user's profile - use display_name and username (same as Profile)
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .single();

          // Build participantNames array (same as unifiedRoundsLoader.ts)
          const participantNames = [profile?.display_name, profile?.username]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim());

          // Find which player the user is (exact matching, same as Profile)
          let userPlayerIndex: number | null = null;
          
          if (participantNames.some(n => n === game.player_1)) {
            userPlayerIndex = 1;
          } else if (participantNames.some(n => n === game.player_2)) {
            userPlayerIndex = 2;
          } else if (participantNames.some(n => n === game.player_3)) {
            userPlayerIndex = 3;
          } else if (game.user_id === user.id) {
            // Owner defaults to player 1
            userPlayerIndex = 1;
          }

          if (userPlayerIndex) {
            // Calculate position based on points (same as unifiedRoundsLoader.ts)
            const rawPoints = [
              { player: 1, pts: game.player_1_total_points || 0 },
              { player: 2, pts: game.player_2_total_points || 0 },
              { player: 3, pts: game.player_3_total_points || 0 },
            ];
            
            // Normalize points (subtract minimum so lowest is 0)
            const minPts = Math.min(...rawPoints.map(p => p.pts));
            const normalizedPoints = rawPoints.map(p => ({ ...p, pts: p.pts - minPts }));
            
            // Sort by points descending for position calculation
            const sortedPoints = [...normalizedPoints].sort((a, b) => b.pts - a.pts);
            
            const position = sortedPoints.findIndex(p => p.player === userPlayerIndex) + 1;
            setUserPosition(position);
          }
        } catch (error) {
          console.error("Error fetching user position:", error);
        }
      };

      fetchUserPosition();
    }
  }, [open, game]);

  // Build stroke play players data
  const buildStrokePlayPlayers = () => {
    return [1, 2, 3].map(idx => {
      const playerName = idx === 1 ? game.player_1 : idx === 2 ? game.player_2 : game.player_3;
      const scoresMap = new Map<number, number>();
      let totalScore = 0;

      holes.forEach(hole => {
        const score = idx === 1 ? hole.player_1_gross_score : idx === 2 ? hole.player_2_gross_score : hole.player_3_gross_score;
        if (score !== null && score > 0) {
          scoresMap.set(hole.hole_number, score);
          totalScore += score;
        }
      });

      return {
        name: playerName,
        scores: scoresMap,
        totalScore,
      };
    });
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
      const holeScoresData: Record<number, { p1: number | null; p2: number | null; p3: number | null; p1pts: number; p2pts: number; p3pts: number }> = {};
      const holeParsData: Record<number, number> = {};
      
      holes.forEach(hole => {
        holeScoresData[hole.hole_number] = {
          p1: hole.player_1_gross_score,
          p2: hole.player_2_gross_score,
          p3: hole.player_3_gross_score,
          p1pts: hole.player_1_hole_points,
          p2pts: hole.player_2_hole_points,
          p3pts: hole.player_3_hole_points,
        };
      });
      
      courseHoles.forEach(hole => {
        holeParsData[hole.hole_number] = hole.par;
      });

      const scorecardJson = JSON.stringify({
        holeScores: holeScoresData,
        holePars: holeParsData,
      });

      // Create structured copenhagen scorecard marker
      // Format: [COPENHAGEN_SCORECARD]roundName|courseName|date|player1|player2|player3|p1pts|p2pts|p3pts|winner|gameId|scorecardJson[/COPENHAGEN_SCORECARD]
      const copenhagenScorecard = `[COPENHAGEN_SCORECARD]${game.round_name || 'Copenhagen'}|${game.course_name}|${game.date_played}|${game.player_1}|${game.player_2}|${game.player_3}|${normalizedPts.player1}|${normalizedPts.player2}|${normalizedPts.player3}|${winner.name}|${game.id}|${scorecardJson}[/COPENHAGEN_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${copenhagenScorecard}`
        : copenhagenScorecard;

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
        {/* Use CopenhagenScorecardView - matches shared post exactly */}
        <div className="flex-1 overflow-y-auto">
          <CopenhagenScorecardView
            roundName={game.round_name || 'Copenhagen'}
            courseName={game.course_name}
            datePlayed={game.date_played}
            playerCount={3}
            position={userPosition}
            finalScore={finalScore}
            game={game}
            holes={holes}
            courseHoles={courseHoles}
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
