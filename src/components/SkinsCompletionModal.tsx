import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { SkinsScorecardView } from "@/components/SkinsScorecardView";

interface SkinsPlayer {
  id?: string;
  odId?: string;
  name: string;
  displayName?: string;
  handicap?: number | null;
  tee?: string | null;
  avatarUrl?: string | null;
}

interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  player_scores: Record<string, number>;
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

interface SkinsGame {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  round_name: string | null;
  user_id: string;
  is_finished: boolean;
  skin_value: number;
  carryover_enabled: boolean;
  use_handicaps: boolean;
  players: any;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface SkinsCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: SkinsGame;
  holes: SkinsHole[];
  players: SkinsPlayer[];
  courseHoles: CourseHole[];
}

export function SkinsCompletionModal({
  open,
  onOpenChange,
  game,
  holes,
  players,
  courseHoles,
}: SkinsCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [userPosition, setUserPosition] = useState<number>(1);
  const [userSkinsWon, setUserSkinsWon] = useState<number>(0);
  const { toast } = useToast();
  const { strokePlayEnabled } = useStrokePlayEnabled(game.id, 'skins');

  const getPlayerId = (player: SkinsPlayer) => {
    return player.odId || player.id || player.name;
  };

  const getPlayerName = (player: SkinsPlayer) => {
    return player.displayName || player.name || "Player";
  };

  const getPlayerSkinCount = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    return holes
      .filter(h => h.winner_player === playerId)
      .reduce((sum, h) => sum + h.skins_available, 0);
  };

  const getPlayerTotalScore = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    let total = 0;
    for (const hole of holes) {
      const score = hole.player_scores[playerId];
      if (score && score > 0) {
        total += score;
      }
    }
    return total;
  };

  // Sort players by skin count for display
  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b) - getPlayerSkinCount(a)
  );

  const winner = sortedPlayers[0];
  const winnerName = winner ? getPlayerName(winner) : 'N/A';
  const winnerSkins = winner ? getPlayerSkinCount(winner) : 0;

  // Reset state when dialog opens and calculate user position
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
        let userPlayerId: string | null = null;
        
        for (const player of players) {
          const playerName = getPlayerName(player);
          if (participantNames.includes(playerName)) {
            userPlayerId = getPlayerId(player);
            break;
          }
        }

        // If not found by name but user owns the game, default to first player
        if (!userPlayerId && game.user_id === user.id && players.length > 0) {
          userPlayerId = getPlayerId(players[0]);
        }

        if (userPlayerId) {
          // Calculate position based on skins
          const playerSkins = sortedPlayers.map(p => ({
            id: getPlayerId(p),
            skins: getPlayerSkinCount(p),
          }));

          const userSkins = playerSkins.find(p => p.id === userPlayerId)?.skins || 0;
          const position = playerSkins.filter(p => p.skins > userSkins).length + 1;
          
          setUserPosition(position);
          setUserSkinsWon(userSkins);
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

      // Build scorecard data for the post
      const playerScoresData: Record<string, { name: string; skins: number; total: number }> = {};
      players.forEach(player => {
        const playerId = getPlayerId(player);
        playerScoresData[playerId] = {
          name: getPlayerName(player),
          skins: getPlayerSkinCount(player),
          total: getPlayerTotalScore(player),
        };
      });

      const holeResultsData: Record<number, { winnerId: string | null; skinsAvailable: number; par: number; playerScores: Record<string, number> }> = {};
      holes.forEach(hole => {
        holeResultsData[hole.hole_number] = {
          winnerId: hole.winner_player,
          skinsAvailable: hole.skins_available,
          par: hole.par,
          playerScores: hole.player_scores,
        };
      });

      const scorecardJson = JSON.stringify({
        playerScores: playerScoresData,
        holeResults: holeResultsData,
      });

      // Create structured skins scorecard marker
      // Format: [SKINS_SCORECARD]roundName|courseName|date|winnerId|winnerName|winnerSkins|gameId|scorecardJson[/SKINS_SCORECARD]
      const winnerId = winner ? getPlayerId(winner) : '';
      const skinsScorecard = `[SKINS_SCORECARD]${game.round_name || 'Skins'}|${game.course_name}|${game.date_played}|${winnerId}|${winnerName}|${winnerSkins}|${game.id}|${scorecardJson}[/SKINS_SCORECARD]`;
      
      const postContent = comment.trim()
        ? `${comment}\n\n${skinsScorecard}`
        : skinsScorecard;

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

  const handleDone = () => {
    onOpenChange(false);
    navigate("/");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
        {/* Use SkinsScorecardView - matches shared post exactly */}
        <div className="flex-1 overflow-y-auto">
          <SkinsScorecardView
            roundName={game.round_name || 'Skins'}
            courseName={game.course_name}
            datePlayed={game.date_played}
            playerCount={players.length}
            position={userPosition}
            skinsWon={userSkinsWon}
            players={players}
            holes={holes}
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
              <Button className="flex-1" onClick={handleDone}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
