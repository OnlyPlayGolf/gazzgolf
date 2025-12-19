import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { SkinsGame, SkinsPlayer } from "@/types/skins";
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

export default function SkinsSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          players: (gameData.players as unknown as SkinsPlayer[]) || [],
          handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
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
      await supabase
        .from("skins_games")
        .update({ is_finished: true })
        .eq("id", game.id);

      toast({ title: "Game finished!" });
      navigate(`/skins/${game.id}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("skins_holes").delete().eq("game_id", gameId);
      await supabase.from("skins_games").delete().eq("id", gameId);
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
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
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
              onClick={() => navigate(`/skins/${gameId}/summary`)}
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
              <span className="text-muted-foreground">Skin Value</span>
              <span>${game.skin_value}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Carryover</span>
              <span>{game.carryover_enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Handicaps</span>
              <span>{game.use_handicaps ? `Enabled (${game.handicap_mode})` : "Disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Players</span>
              <span>{game.players.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Players</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {game.players.map((player, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/50">
                <div>
                  <div className="font-medium">{player.name}</div>
                  <div className="text-xs text-muted-foreground">{player.group_name}</div>
                </div>
                {game.use_handicaps && player.handicap !== null && (
                  <span className="text-sm text-muted-foreground">HCP: {player.handicap}</span>
                )}
              </div>
            ))}
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

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
