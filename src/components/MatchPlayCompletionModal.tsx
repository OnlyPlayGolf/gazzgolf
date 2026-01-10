import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { MatchPlayGame, MatchPlayHole } from "@/types/matchPlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const holesMap = new Map(holes.map(h => [h.hole_number, h]));
  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const player1HolesWon = holes.filter(h => h.hole_result === 1).length;
  const player2HolesWon = holes.filter(h => h.hole_result === -1).length;

  const getPlayerScore = (holeNumber: number, playerNum: number) => {
    const hole = holesMap.get(holeNumber);
    if (!hole) return null;
    return playerNum === 1 ? hole.player_1_gross_score : hole.player_2_gross_score;
  };

  const getHoleResult = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.hole_result || 0;
  };

  const getMatchStatusAfter = (holeNumber: number) => {
    const hole = holesMap.get(holeNumber);
    return hole?.match_status_after || 0;
  };

  const getMatchStatusDisplay = (holeNumber: number) => {
    const status = getMatchStatusAfter(holeNumber);
    if (status === 0) return { text: "AS", color: "bg-muted text-muted-foreground" };
    if (status > 0) {
      return { text: `${status}UP`, color: "bg-blue-500 text-white" };
    }
    return { text: `${Math.abs(status)}UP`, color: "bg-destructive text-destructive-foreground" };
  };

  const playerWonHole = (holeNumber: number, playerNum: number) => {
    const result = getHoleResult(holeNumber);
    if (playerNum === 1) return result === 1;
    if (playerNum === 2) return result === -1;
    return false;
  };

  const renderScoreCell = (holeNumber: number, playerNum: number) => {
    const score = getPlayerScore(holeNumber, playerNum);
    const won = playerWonHole(holeNumber, playerNum);
    
    if (score === null) return "";
    
    const displayScore = score === -1 ? "–" : score;
    
    if (won) {
      const colorClass = playerNum === 1 ? "text-blue-500" : "text-destructive";
      return (
        <span className={`font-bold ${colorClass}`}>
          {displayScore}
        </span>
      );
    }
    return displayScore;
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "You must be logged in to share", variant: "destructive" });
        return;
      }

      const resultText = game.final_result || `${player1HolesWon}-${player2HolesWon}`;
      const winnerText = game.winner_player ? `Winner: ${game.winner_player}` : "Match Halved";
      const roundResult = `[MATCH_PLAY]${game.round_name || 'Match Play'}|${game.course_name}|${game.date_played}|${resultText}|${winnerText}|${game.player_1} vs ${game.player_2}|${game.id}[/MATCH_PLAY]`;
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
    onContinue();
  };

  const renderNine = (nineHoles: CourseHole[], isBackNine: boolean = false) => {
    if (nineHoles.length === 0) return null;

    const nineLabel = isBackNine ? 'In' : 'Out';

    return (
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-primary/5">
            <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
            {nineHoles.map(hole => (
              <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                {hole.hole_number}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">{nineLabel}</TableHead>
            <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
              {isBackNine ? 'Tot' : (hasBackNine ? '' : 'Tot')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                {hole.par}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + h.par, 0)}
            </TableCell>
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {isBackNine ? courseHoles.reduce((sum, h) => sum + h.par, 0) : (hasBackNine ? '' : nineHoles.reduce((sum, h) => sum + h.par, 0))}
            </TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-blue-500">
              {game.player_1.split(' ')[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole.hole_number, 1)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 1) || 0), 0) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_1_gross_score || 0), 0) || '') : ''}
            </TableCell>
          </TableRow>

          <TableRow className="bg-muted/30">
            <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-muted/30">Score</TableCell>
            {nineHoles.map(hole => {
              const holeData = holesMap.get(hole.hole_number);
              if (!holeData) {
                return (
                  <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  </TableCell>
                );
              }
              const status = getMatchStatusDisplay(hole.hole_number);
              return (
                <TableCell key={hole.hole_number} className="text-center text-[10px] px-0 py-1">
                  <span className={`inline-flex items-center justify-center px-0.5 py-0 rounded text-[8px] font-bold ${status.color}`}>
                    {status.text}
                  </span>
                </TableCell>
              );
            })}
            <TableCell className="text-center bg-muted text-[10px] px-0 py-1"></TableCell>
            <TableCell className="text-center bg-primary/10 text-[10px] px-0 py-1"></TableCell>
          </TableRow>

          <TableRow>
            <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background max-w-[44px] truncate text-destructive">
              {game.player_2.split(' ')[0]}
            </TableCell>
            {nineHoles.map(hole => (
              <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                {renderScoreCell(hole.hole_number, 2)}
              </TableCell>
            ))}
            <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
              {nineHoles.reduce((sum, h) => sum + (getPlayerScore(h.hole_number, 2) || 0), 0) || ''}
            </TableCell>
            <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
              {isBackNine || !hasBackNine ? (holes.reduce((sum, h) => sum + (h.player_2_gross_score || 0), 0) || '') : ''}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Green Header - Match Card Style */}
        <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: Match Result */}
            <div className="flex-shrink-0 w-16 text-center">
              <div className="text-2xl font-bold">
                {game.final_result || `${player1HolesWon}-${player2HolesWon}`}
              </div>
              <div className="text-xs opacity-75">
                {game.winner_player ? "Winner" : "Halved"}
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {game.round_name || 'Match Play'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm opacity-90">
                <span className="truncate">{game.course_name}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(game.date_played), "MMM d")}</span>
              </div>
              <div className="text-xs opacity-75 mt-1">
                Match Play · {game.player_1} vs {game.player_2}
              </div>
            </div>
          </div>
        </div>

        {/* Winner Section */}
        {game.winner_player && (
          <div className="px-4 pt-3 text-center">
            <p className="text-sm text-muted-foreground">Winner</p>
            <p className="text-lg font-bold text-primary">{game.winner_player}</p>
          </div>
        )}

        {/* Scorecard */}
        {courseHoles.length > 0 && (
          <div className="px-4 pt-3">
            <div className="border rounded-lg overflow-hidden">
              {renderNine(frontNine, false)}
              
              {hasBackNine && (
                <div className="border-t">
                  {renderNine(backNine, true)}
                </div>
              )}
            </div>
          </div>
        )}

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
