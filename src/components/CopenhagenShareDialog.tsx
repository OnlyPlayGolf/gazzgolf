import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenGame } from "@/types/copenhagen";

interface CopenhagenShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: CopenhagenGame;
}

export function CopenhagenShareDialog({ open, onOpenChange, game }: CopenhagenShareDialogProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [sharing, setSharing] = useState(false);

  const players = [
    { name: game.player_1, points: game.player_1_total_points },
    { name: game.player_2, points: game.player_2_total_points },
    { name: game.player_3, points: game.player_3_total_points },
  ].sort((a, b) => b.points - a.points);

  const handleShare = async () => {
    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in to share", variant: "destructive" });
        return;
      }

      const postContent = comment.trim() || 
        `Copenhagen at ${game.course_name}: ${players[0].name} wins with ${players[0].points} points! (${players.map(p => `${p.name}: ${p.points}`).join(", ")})`;

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: postContent,
      });

      if (error) throw error;

      toast({ title: "Shared to feed!" });
      onOpenChange(false);
      setComment("");
    } catch (error: any) {
      toast({ title: "Error sharing", description: error.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Copenhagen Result</DialogTitle>
          <DialogDescription>Share your game with friends</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Result Preview */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="font-medium">Copenhagen at {game.course_name}</div>
            <div className="text-sm space-y-1">
              {players.map((player, i) => (
                <div key={i} className="flex justify-between">
                  <span>{i === 0 ? "🏆 " : ""}{player.name}</span>
                  <span className="font-medium">{player.points} pts</span>
                </div>
              ))}
            </div>
          </div>

          <Textarea
            placeholder="Add a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={1}
          />

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={sharing} className="flex-1">
              {sharing ? "Sharing..." : "Share"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
