import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WolfGame, WolfHole } from "@/types/wolf";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { StrokePlayToggle } from "@/components/StrokePlayToggle";
import { MyStatsSettings } from "@/components/play/MyStatsSettings";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
  LeaveGameDialog,
} from "@/components/settings";
import { getTeeDisplayName } from "@/components/TeeSelector";
import { GameHeader } from "@/components/GameHeader";
import { WolfCompletionModal } from "@/components/WolfCompletionModal";

export default function WolfSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('wolf', gameId);
  const [game, setGame] = useState<WolfGame | null>(null);
  const [holes, setHoles] = useState<WolfHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
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

  // Per-player stats mode
  const { 
    statsMode: playerStatsMode, 
    loading: statsModeLoading,
    saving: statsModeSaving,
    setStatsMode: setPlayerStatsMode,
    deletePlayerStats,
  } = usePlayerStatsMode(gameId, 'wolf');

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

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (gameId) {
        fetchGame();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
        setDoubleEnabled(typedGame.double_enabled ?? false);
        setWolfPosition(typedGame.wolf_position as 'first' | 'last');

        // Fetch holes for completion dialog
        const { data: holesData } = await supabase
          .from("wolf_holes" as any)
          .select("*")
          .eq("game_id", gameId)
          .order("hole_number");
        
        if (holesData) {
          setHoles(holesData as unknown as WolfHole[]);
        }

        // Fetch course holes
        if (typedGame.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", typedGame.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = typedGame.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
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

  const handleFinishGame = () => {
    setShowCompletionDialog(true);
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

  if (loading || isSpectatorLoading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <WolfBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
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

  // Wolf doesn't have individual player tees, use tee_set from database if available
  const gameTeeSet = (game as any).tee_set;
  const teeInfo = gameTeeSet ? getTeeDisplayName(gameTeeSet) : "Standard";
  const players: GamePlayer[] = playerNames.map(name => ({ 
    name,
    tee: gameTeeSet || undefined,
  }));

  const gameDetails: GameDetailsData = {
    format: "Wolf",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `Lone Wolf: ${loneWolfWinPoints}/${loneWolfLossPoints} pts • Team: ${teamWinPoints} pts`,
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={(game as any).round_name || "Wolf"}
        courseName={game.course_name}
        pageTitle="Settings"
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* My Stats Settings - Available for all participants (not spectators) */}
        {!isSpectator && currentUserId && !statsModeLoading && (
          <MyStatsSettings
            currentMode={playerStatsMode}
            onModeChange={setPlayerStatsMode}
            onDeleteStats={deletePlayerStats}
            saving={statsModeSaving}
          />
        )}
        {/* Game Rules - Visible for all but locked for spectators or when edit window expired */}
        <Card className={(isSpectator || (isEditWindowExpired ?? false)) ? 'opacity-90' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                Game Rules
                {(isSpectator || (isEditWindowExpired ?? false)) && (
                  <span className="text-xs text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded">
                    (Locked)
                  </span>
                )}
              </div>
              {!(isSpectator || (isEditWindowExpired ?? false)) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/game-settings/wolf/${gameId}?returnPath=/wolf/${gameId}/settings`)}
                  className="h-8 w-8"
                >
                  <Settings size={16} />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrokePlayToggle gameId={gameId} gameType="wolf" disabled={isSpectator || (isEditWindowExpired ?? false)} />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Double</Label>
                <p className="text-xs text-muted-foreground">
                  Allow teams to double the points on a hole
                </p>
              </div>
              <Switch 
                checked={doubleEnabled} 
                onCheckedChange={handleDoubleChange} 
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              />
            </div>

            <div className="space-y-2">
              <Label>Wolf Position</Label>
              <Select 
                value={wolfPosition} 
                onValueChange={(v) => handleWolfPositionChange(v as 'first' | 'last')}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
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
              <Select 
                value={loneWolfWinPoints.toString()} 
                onValueChange={handleLoneWolfWinChange}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
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
              <Select 
                value={loneWolfLossPoints.toString()} 
                onValueChange={handleLoneWolfLossChange}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
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
              <Select 
                value={teamWinPoints.toString()} 
                onValueChange={handleTeamWinChange}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
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

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
          isAdmin={currentUserId === game.user_id}
          onFinish={handleFinishGame}
          onDelete={() => setShowDeleteDialog(true)}
            onLeave={() => setShowLeaveDialog(true)}
          />
        )}
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

      {gameId && <WolfBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}

      {game && (
        <WolfCompletionModal
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          game={game}
          holes={holes}
          courseHoles={courseHoles}
        />
      )}
    </div>
  );
}
