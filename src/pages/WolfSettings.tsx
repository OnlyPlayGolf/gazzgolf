import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame } from "@/types/wolf";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
  LeaveGameDialog,
} from "@/components/settings";

export default function WolfSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<WolfGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [loneWolfWinPoints, setLoneWolfWinPoints] = useState(3);
  const [loneWolfLossPoints, setLoneWolfLossPoints] = useState(1);
  const [teamWinPoints, setTeamWinPoints] = useState(1);
  const [doubleEnabled, setDoubleEnabled] = useState(true);
  const [wolfPosition, setWolfPosition] = useState<'first' | 'last'>('last');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
    
    if (gameId) {
      fetchGame();
      fetchProgress();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
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
        setDoubleEnabled(typedGame.double_enabled ?? true);
        setWolfPosition(typedGame.wolf_position as 'first' | 'last');
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("wolf_holes" as any)
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const saveSettings = async (updates: Record<string, any>) => {
    try {
      await supabase
        .from("wolf_games" as any)
        .update(updates)
        .eq("id", gameId);
    } catch (error: any) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    }
  };

  const handleDoubleChange = (value: boolean) => {
    setDoubleEnabled(value);
    saveSettings({ double_enabled: value });
  };

  const handleWolfPositionChange = (value: 'first' | 'last') => {
    setWolfPosition(value);
    saveSettings({ wolf_position: value });
  };

  const handleLoneWolfWinChange = (value: string) => {
    const points = parseInt(value);
    setLoneWolfWinPoints(points);
    saveSettings({ lone_wolf_win_points: points });
  };

  const handleLoneWolfLossChange = (value: string) => {
    const points = parseInt(value);
    setLoneWolfLossPoints(points);
    saveSettings({ lone_wolf_loss_points: points });
  };

  const handleTeamWinChange = (value: string) => {
    const points = parseInt(value);
    setTeamWinPoints(points);
    saveSettings({ team_win_points: points });
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const points = [
        { name: game.player_1, points: game.player_1_points },
        { name: game.player_2, points: game.player_2_points },
        { name: game.player_3, points: game.player_3_points },
        ...(game.player_4 ? [{ name: game.player_4, points: game.player_4_points }] : []),
        ...(game.player_5 ? [{ name: game.player_5, points: game.player_5_points }] : []),
      ].sort((a, b) => b.points - a.points);
      
      await supabase
        .from("wolf_games" as any)
        .update({ is_finished: true, winner_player: points[0].name })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/wolf/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  const handleLeaveGame = async () => {
    setLeaving(true);
    try {
      toast({ title: "Left the game" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLeaving(false);
      setShowLeaveDialog(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <WolfBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const playerNames = [
    game.player_1,
    game.player_2,
    game.player_3,
    game.player_4,
    game.player_5,
  ].filter(Boolean) as string[];

  const players: GamePlayer[] = playerNames.map(name => ({ name }));

  const gameDetails: GameDetailsData = {
    format: "Wolf",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo: "Standard",
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `Lone Wolf: ${loneWolfWinPoints}/${loneWolfLossPoints} pts • Team: ${teamWinPoints} pts`,
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Double</Label>
                <p className="text-xs text-muted-foreground">
                  Allow teams to double the points on a hole
                </p>
              </div>
              <Switch checked={doubleEnabled} onCheckedChange={handleDoubleChange} />
            </div>

            <div className="space-y-2">
              <Label>Wolf Position</Label>
              <Select value={wolfPosition} onValueChange={(v) => handleWolfPositionChange(v as 'first' | 'last')}>
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
              <Select value={loneWolfWinPoints.toString()} onValueChange={handleLoneWolfWinChange}>
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
              <Select value={loneWolfLossPoints.toString()} onValueChange={handleLoneWolfLossChange}>
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
              <Select value={teamWinPoints.toString()} onValueChange={handleTeamWinChange}>
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

          </CardContent>
        </Card>

        <RoundActionsSection
          isAdmin={currentUserId === game.user_id}
          onFinish={handleFinishGame}
          onSaveAndExit={() => navigate(`/wolf/${gameId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
          onLeave={() => setShowLeaveDialog(true)}
        />
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={players}
        useHandicaps={false}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Wolf Game"
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveGame}
        leaving={leaving}
      />

      {gameId && <WolfBottomTabBar gameId={gameId} />}
    </div>
  );
}
