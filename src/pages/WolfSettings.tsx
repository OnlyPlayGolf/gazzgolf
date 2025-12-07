import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame } from "@/types/wolf";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function WolfSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<WolfGame | null>(null);
  const [loneWolfWinPoints, setLoneWolfWinPoints] = useState(3);
  const [loneWolfLossPoints, setLoneWolfLossPoints] = useState(1);
  const [teamWinPoints, setTeamWinPoints] = useState(1);
  const [wolfPosition, setWolfPosition] = useState<'first' | 'last'>('last');

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    const { data } = await supabase
      .from("wolf_games" as any)
      .select("*")
      .eq("id", gameId)
      .single();
    if (data) {
      const typedGame = data as unknown as WolfGame;
      setGame(typedGame);
      setLoneWolfWinPoints(typedGame.lone_wolf_win_points);
      setLoneWolfLossPoints(typedGame.lone_wolf_loss_points);
      setTeamWinPoints(typedGame.team_win_points);
      setWolfPosition(typedGame.wolf_position as 'first' | 'last');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await supabase
        .from("wolf_games" as any)
        .update({
          lone_wolf_win_points: loneWolfWinPoints,
          lone_wolf_loss_points: loneWolfLossPoints,
          team_win_points: teamWinPoints,
          wolf_position: wolfPosition,
        })
        .eq("id", gameId);
      toast({ title: "Settings saved" });
    } catch (error: any) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("wolf_holes" as any).delete().eq("game_id", gameId);
      await supabase.from("wolf_games" as any).delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <h1 className="text-xl font-bold text-center">Settings</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">Game Settings</h2>
          
          <div className="space-y-2">
            <Label>Wolf Position</Label>
            <Select value={wolfPosition} onValueChange={(v) => setWolfPosition(v as 'first' | 'last')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last">Wolf tees off Last</SelectItem>
                <SelectItem value="first">Wolf tees off First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lone Wolf Win Points</Label>
            <Select value={loneWolfWinPoints.toString()} onValueChange={(v) => setLoneWolfWinPoints(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lone Wolf Loss Points (per opponent)</Label>
            <Select value={loneWolfLossPoints.toString()} onValueChange={(v) => setLoneWolfLossPoints(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team Win Points (per player)</Label>
            <Select value={teamWinPoints.toString()} onValueChange={(v) => setTeamWinPoints(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} points</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveSettings} className="w-full">
            Save Settings
          </Button>
        </Card>

        <Card className="p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Delete Game
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Game?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this game and all hole data. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGame}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>

      <WolfBottomTabBar gameId={gameId!} />
    </div>
  );
}
