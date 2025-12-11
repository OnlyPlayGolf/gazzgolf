import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, Press } from "@/types/copenhagen";
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
import { Trash2, Save, X } from "lucide-react";

export default function CopenhagenSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          presses: (gameData.presses as unknown as Press[]) || [],
        });
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishGame = async () => {
    if (!game) return;

    try {
      const players = [
        { name: game.player_1, points: game.player_1_total_points },
        { name: game.player_2, points: game.player_2_total_points },
        { name: game.player_3, points: game.player_3_total_points },
      ].sort((a, b) => b.points - a.points);

      const winner = players[0].name;

      await supabase
        .from("copenhagen_games")
        .update({ is_finished: true, winner_player: winner })
        .eq("id", game.id);

      toast({ title: "Game finished!" });
      navigate(`/copenhagen/${game.id}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("copenhagen_holes").delete().eq("game_id", gameId);
      await supabase.from("copenhagen_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleFinishGame}
              className="w-full"
              variant="default"
            >
              <Save size={16} className="mr-2" />
              Finish Game
            </Button>

            <Button
              onClick={() => navigate(`/copenhagen/${gameId}/summary`)}
              className="w-full"
              variant="outline"
            >
              <X size={16} className="mr-2" />
              Save & Exit
            </Button>

            <Button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full"
              variant="destructive"
            >
              <Trash2 size={16} className="mr-2" />
              Delete Game
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Course</span>
              <span>{game.course_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holes</span>
              <span>{game.holes_played}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stake</span>
              <span>${game.stake_per_point}/point</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Handicaps</span>
              <span>{game.use_handicaps ? "Enabled" : "Disabled"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this game? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGame} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
