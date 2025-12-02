import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export default function RoundSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteRound = async () => {
    if (!roundId) return;
    
    setDeleting(true);
    try {
      // Delete all holes first
      await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundId);

      // Delete round players
      await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundId);

      // Delete the round
      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (error) throw error;

      toast({ title: "Round deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting round", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Round Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 size={16} className="mr-2" />
              Delete Round
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this round? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRound}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {roundId && <RoundBottomTabBar roundId={roundId} />}
    </div>
  );
}
