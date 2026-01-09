import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  onContinue,
}: RoundCompletionModalProps) {
  const navigate = useNavigate();
  const [showShareForm, setShowShareForm] = useState(false);
  const [comment, setComment] = useState("");
  const [isSharing, setIsSharing] = useState(false);

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

  const frontNine = courseHoles.filter(h => h.hole_number <= 9);
  const backNine = courseHoles.filter(h => h.hole_number > 9);
  const hasBackNine = backNine.length > 0;

  const getFrontNineTotal = () => {
    return frontNine.reduce((sum, h) => {
      const score = holeScores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  const getBackNineTotal = () => {
    return backNine.reduce((sum, h) => {
      const score = holeScores.get(h.hole_number);
      return sum + (score && score > 0 ? score : 0);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto [&>button]:hidden">
        {/* Green Header - Round Card Style */}
        <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
          <div className="flex items-center gap-4">
            {/* Left: Score with vs par below */}
            <div className="flex-shrink-0 w-14 text-center">
              <div className="text-3xl font-bold">{totalScore}</div>
              <div className={`text-sm ${scoreVsPar <= 0 ? 'text-green-200' : 'opacity-75'}`}>
                {formatScoreVsPar(scoreVsPar)}
              </div>
            </div>
            
            {/* Right: Round Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">
                {roundName || 'Round'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-sm opacity-90">
                <span className="truncate">{courseName}</span>
                <span>·</span>
                <span className="flex-shrink-0">{format(new Date(datePlayed), "MMM d")}</span>
              </div>
              <div className="text-xs opacity-75 mt-1">
                Stroke Play · 1 player
              </div>
            </div>
          </div>
        </div>

        {/* Scorecard */}
        {courseHoles.length > 0 && (
          <div className="px-4 pt-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Front 9 */}
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                    {frontNine.map(hole => (
                      <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                        {hole.hole_number}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Out</TableHead>
                    <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">
                      {!hasBackNine ? 'Tot' : ''}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                    {frontNine.map(hole => (
                      <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                        {hole.par}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {frontNine.reduce((sum, h) => sum + h.par, 0)}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {!hasBackNine ? totalPar : ''}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                    {frontNine.map(hole => {
                      const score = holeScores.get(hole.hole_number);
                      return (
                        <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                          {score && score > 0 ? score : ''}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                      {getFrontNineTotal() > 0 ? getFrontNineTotal() : ''}
                    </TableCell>
                    <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                      {!hasBackNine ? totalScore : ''}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Back 9 */}
              {hasBackNine && (
                <div className="border-t">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="bg-primary/5">
                        <TableHead className="text-center font-bold text-[10px] px-0.5 py-1.5 bg-primary/5 w-[44px]">Hole</TableHead>
                        {backNine.map(hole => (
                          <TableHead key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1.5">
                            {hole.hole_number}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">In</TableHead>
                        <TableHead className="text-center font-bold text-[10px] px-0 py-1.5 bg-primary/10">Tot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground text-[10px] px-0.5 py-1 bg-background">Par</TableCell>
                        {backNine.map(hole => (
                          <TableCell key={hole.hole_number} className="text-center font-semibold text-[10px] px-0 py-1">
                            {hole.par}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {backNine.reduce((sum, h) => sum + h.par, 0)}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {totalPar}
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-bold">
                        <TableCell className="font-bold text-[10px] px-0.5 py-1 bg-background">Score</TableCell>
                        {backNine.map(hole => {
                          const score = holeScores.get(hole.hole_number);
                          return (
                            <TableCell key={hole.hole_number} className="text-center font-bold text-[10px] px-0 py-1">
                              {score && score > 0 ? score : ''}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-muted text-[10px] px-0 py-1">
                          {getBackNineTotal() > 0 ? getBackNineTotal() : ''}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-primary/10 text-[10px] px-0 py-1">
                          {totalScore}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
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
                placeholder="Add your post-round thoughts..."
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
