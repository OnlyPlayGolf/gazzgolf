import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, Loader2 } from "lucide-react";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { ScrambleScorecardView } from "@/components/ScrambleScorecardView";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface ScrambleCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: ScrambleGame;
  teams: ScrambleTeam[];
  holes: ScrambleHole[];
  courseHoles: CourseHole[];
}

export function ScrambleCompletionDialog({
  open,
  onOpenChange,
  game,
  teams,
  holes,
  courseHoles,
}: ScrambleCompletionDialogProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userScoreToPar, setUserScoreToPar] = useState<string>("E");
  const { toast } = useToast();

  // Calculate team scores - memoized to prevent unnecessary re-renders
  const teamScores = useMemo(() => {
    return teams.map(team => {
      let total = 0;
      let parTotal = 0;

      holes.forEach(hole => {
        const score = hole.team_scores[team.id];
        if (score !== null && score !== undefined && score > 0) {
          total += score;
          parTotal += hole.par;
        }
      });

      return {
        team,
        total,
        toPar: total - parTotal,
      };
    }).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });
  }, [teams, holes]);

  // Format score to par
  const formatScoreToPar = (toPar: number) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  // Reset share form state when dialog opens
  useEffect(() => {
    if (open) {
      setShowShareForm(false);
      setComment("");
    }
  }, [open]);

  // Fetch user position when dialog opens
  useEffect(() => {
    if (!open) return;
    
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

          // Find which team the user is on
          let userTeamId: string | null = null;
          
          for (const team of teams) {
            for (const player of team.players) {
              if (participantNames.includes(player.name)) {
                userTeamId = team.id;
                break;
              }
            }
            if (userTeamId) break;
          }

          // If not found in teams but user owns the game, default to first team
          if (!userTeamId && game.user_id === user.id && teams.length > 0) {
            userTeamId = teams[0].id;
          }

          if (userTeamId) {
            // Find user's team position
            const userTeamIndex = teamScores.findIndex(ts => ts.team.id === userTeamId);
            if (userTeamIndex !== -1) {
              setUserPosition(userTeamIndex + 1);
              setUserScoreToPar(formatScoreToPar(teamScores[userTeamIndex].toPar));
            }
          }
        } catch (error) {
          console.error("Error fetching user position:", error);
      }
    };

    fetchUserPosition();
  }, [open, game.user_id, teams, teamScores]);

  // Count total players
  const totalPlayers = teams.reduce((sum, team) => sum + team.players.length, 0);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      // Build scorecard data for the post
      const holeScoresData: Record<number, Record<string, number | null>> = {};
      const holeParsData: Record<number, number> = {};
      
      holes.forEach(hole => {
        holeScoresData[hole.hole_number] = hole.team_scores;
      });
      
      courseHoles.forEach(hole => {
        holeParsData[hole.hole_number] = hole.par;
      });

      // Serialize teams data
      const teamsData = teams.map(t => ({
        id: t.id,
        name: t.name,
        players: t.players.map(p => ({ id: p.id, name: p.name })),
      }));

      const scorecardJson = JSON.stringify({
        holeScores: holeScoresData,
        holePars: holeParsData,
        courseHoles: courseHoles.map(h => ({
          hole_number: h.hole_number,
          par: h.par,
          stroke_index: h.stroke_index ?? h.hole_number,
        })),
        teams: teamsData,
      });

      // Create structured scramble scorecard marker
      // Format: [SCRAMBLE_SCORECARD]roundName|courseName|date|winningTeam|gameId|scorecardJson[/SCRAMBLE_SCORECARD]
      const winningTeam = teamScores[0]?.team?.name || '';
      const scrambleScorecard = `[SCRAMBLE_SCORECARD]${game.round_name || 'Scramble'}|${game.course_name}|${game.date_played}|${winningTeam}|${game.id}|${scorecardJson}[/SCRAMBLE_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${scrambleScorecard}`
        : scrambleScorecard;

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
        {/* Use ScrambleScorecardView - matches shared post exactly */}
        <div className="flex-1 overflow-y-auto">
          <ScrambleScorecardView
            roundName={game.round_name || 'Scramble'}
            courseName={game.course_name}
            datePlayed={game.date_played}
            playerCount={totalPlayers}
            position={userPosition}
            scoreToPar={userScoreToPar}
            game={game}
            teams={teams}
            holes={holes}
            courseHoles={courseHoles}
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
