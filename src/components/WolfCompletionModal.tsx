import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { WolfScorecardView } from "@/components/WolfScorecardView";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index?: number;
}

interface WolfCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: WolfGame;
  holes: WolfHole[];
  courseHoles: CourseHole[];
}

export function WolfCompletionModal({
  open,
  onOpenChange,
  game,
  holes,
  courseHoles,
}: WolfCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userPointsWon, setUserPointsWon] = useState<number>(0);
  const { toast } = useToast();
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'wolf');

  const getPlayerCount = () => {
    let count = 3;
    if (game.player_4) count = 4;
    if (game.player_5) count = 5;
    return count;
  };

  const getPlayerName = (num: number): string => {
    switch (num) {
      case 1: return game.player_1;
      case 2: return game.player_2;
      case 3: return game.player_3;
      case 4: return game.player_4 || '';
      case 5: return game.player_5 || '';
      default: return '';
    }
  };

  const getPlayerPoints = (num: number): number => {
    switch (num) {
      case 1: return game.player_1_points;
      case 2: return game.player_2_points;
      case 3: return game.player_3_points;
      case 4: return game.player_4_points;
      case 5: return game.player_5_points;
      default: return 0;
    }
  };

  const getHoleScore = (holeNumber: number, playerNum: number): number | null => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_score;
      case 2: return hole.player_2_score;
      case 3: return hole.player_3_score;
      case 4: return hole.player_4_score;
      case 5: return hole.player_5_score;
      default: return null;
    }
  };

  const getHolePoints = (holeNumber: number, playerNum: number): number | null => {
    const hole = holes.find(h => h.hole_number === holeNumber);
    if (!hole) return null;
    switch (playerNum) {
      case 1: return hole.player_1_hole_points;
      case 2: return hole.player_2_hole_points;
      case 3: return hole.player_3_hole_points;
      case 4: return hole.player_4_hole_points;
      case 5: return hole.player_5_hole_points;
      default: return null;
    }
  };

  const playerCount = getPlayerCount();
  
  // Build players array
  const players = Array.from({ length: playerCount }, (_, i) => ({
    num: i + 1,
    name: getPlayerName(i + 1),
    points: getPlayerPoints(i + 1),
  }));

  // Sort players by points for ranking
  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  // Build holes data for WolfScorecardView
  const holesData = holes.map(hole => ({
    hole_number: hole.hole_number,
    par: courseHoles.find(ch => ch.hole_number === hole.hole_number)?.par || 4,
    scores: {
      1: hole.player_1_score,
      2: hole.player_2_score,
      3: hole.player_3_score,
      4: hole.player_4_score,
      5: hole.player_5_score,
    } as Record<number, number | null>,
    points: {
      1: hole.player_1_hole_points,
      2: hole.player_2_hole_points,
      3: hole.player_3_hole_points,
      4: hole.player_4_hole_points,
      5: hole.player_5_hole_points,
    } as Record<number, number | null>,
  }));

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

  // Calculate user's position
  useEffect(() => {
    if (!open) return;

    const fetchUserPosition = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", user.id)
          .single();

        // Build participant names array
        const participantNames = [profile?.display_name, profile?.username]
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());

        // Find which player the user is
        let userPlayerNum: number | null = null;
        
        for (const player of players) {
          if (participantNames.includes(player.name)) {
            userPlayerNum = player.num;
            break;
          }
        }

        // If not found by name but user owns the game, default to first player
        if (!userPlayerNum && game.user_id === user.id && players.length > 0) {
          userPlayerNum = 1;
        }

        if (userPlayerNum) {
          const userPoints = getPlayerPoints(userPlayerNum);
          const position = sortedPlayers.filter(p => p.points > userPoints).length + 1;
          
          setUserPosition(position);
          setUserPointsWon(userPoints);
        }
      } catch (error) {
        console.error("Error fetching user position:", error);
      }
    };

    fetchUserPosition();
  }, [open, game.user_id, players, sortedPlayers]);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Mark game as finished first
      await supabase
        .from("wolf_games")
        .update({ is_finished: true })
        .eq("id", game.id);

      // Build scorecard data for sharing
      const playerScoresData: Record<string, { name: string; points: number }> = {};
      Array.from({ length: playerCount }, (_, i) => {
        const num = i + 1;
        playerScoresData[num.toString()] = {
          name: getPlayerName(num),
          points: getPlayerPoints(num),
        };
      });

      // Build hole results from courseHoles to ensure all holes are included
      const holeResultsData: Record<number, { scores: Record<number, number | null>; points: Record<number, number | null>; par: number }> = {};
      courseHoles.forEach(courseHole => {
        const hole = holes.find(h => h.hole_number === courseHole.hole_number);
        holeResultsData[courseHole.hole_number] = {
          scores: hole ? {
            1: hole.player_1_score,
            2: hole.player_2_score,
            3: hole.player_3_score,
            4: hole.player_4_score,
            5: hole.player_5_score,
          } : { 1: null, 2: null, 3: null, 4: null, 5: null },
          points: hole ? {
            1: hole.player_1_hole_points,
            2: hole.player_2_hole_points,
            3: hole.player_3_hole_points,
            4: hole.player_4_hole_points,
            5: hole.player_5_hole_points,
          } : { 1: null, 2: null, 3: null, 4: null, 5: null },
          par: courseHole.par,
        };
      });

      const scorecardJson = JSON.stringify({
        playerScores: playerScoresData,
        holeResults: holeResultsData,
      });

      const winner = sortedPlayers[0];
      const wolfScorecard = `[WOLF_SCORECARD]${game.round_name || 'Wolf'}|${game.course_name}|${game.date_played}|${winner.name}|${winner.points}|${game.id}|${scorecardJson}[/WOLF_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${wolfScorecard}`
        : wolfScorecard;

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
      toast({ title: "Error", description: "Failed to share round", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDone = async () => {
    // Mark game as finished before navigating
    try {
      await supabase
        .from("wolf_games")
        .update({ is_finished: true })
        .eq("id", game.id);
    } catch (error) {
      console.error("Error finishing game:", error);
    }
    
    onOpenChange(false);
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
        {/* Use WolfScorecardView - matches shared post exactly */}
        <div className="flex-1 overflow-y-auto">
          <WolfScorecardView
            roundName={game.round_name || 'Wolf'}
            courseName={game.course_name}
            datePlayed={game.date_played}
            playerCount={playerCount}
            position={userPosition}
            pointsWon={userPointsWon}
            players={players}
            holes={holesData}
            courseHoles={courseHoles}
            strokePlayEnabled={strokePlayEnabled}
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
                onClick={handleDone}
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
