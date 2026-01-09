import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2 } from "lucide-react";
import { UmbriagioGame, UmbriagioHole } from "@/types/umbriago";
import { UmbriagioScorecard } from "@/components/UmbriagioScorecard";
import { normalizeUmbriagioPoints } from "@/utils/umbriagioScoring";
import { format } from "date-fns";

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden [&>button]:hidden">
        {/* Green Header - Round Card Style */}
        <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: W/L/T Result with score below - matching RoundCard */}
            <div className="flex-shrink-0 w-14 text-center">
              <div className={`text-2xl font-bold ${
                game.winning_team === currentUserTeam ? 'text-emerald-300' : 
                game.winning_team && game.winning_team !== 'TIE' ? 'text-red-400' : 
                'text-primary-foreground'
              }`}>
                {game.winning_team === 'TIE' ? 'T' : 
                 game.winning_team === currentUserTeam ? 'W' : 
                 game.winning_team ? 'L' : '—'}
              </div>
              <div className="text-xs opacity-75 mt-0.5">
                {getScoreDisplay()}
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {game.round_name || 'Umbriago'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm opacity-90">
                <span className="truncate">{game.course_name}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(game.date_played), "MMM d")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs opacity-75 mt-1">
                <span>Umbriago</span>
                <span>·</span>
                <span>4 players</span>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-180px)] px-4">
          <div className="space-y-4 pb-4 pt-4">
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
