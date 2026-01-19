import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings } from "lucide-react";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { StrokePlayToggle } from "@/components/StrokePlayToggle";
import { MyStatsSettings } from "@/components/play/MyStatsSettings";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  LeaveGameDialog,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";
import { getTeeDisplayName } from "@/components/TeeSelector";
import { GameHeader } from "@/components/GameHeader";
import { CopenhagenCompletionDialog } from "@/components/CopenhagenCompletionDialog";

export default function CopenhagenSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('copenhagen', gameId);
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);

  // Per-player stats mode
  const { 
    statsMode: playerStatsMode, 
    loading: statsModeLoading,
    saving: statsModeSaving,
    setStatsMode: setPlayerStatsMode,
    deletePlayerStats,
  } = usePlayerStatsMode(gameId, 'copenhagen');

  // Game settings state
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);
  const [sweepRuleEnabled, setSweepRuleEnabled] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
    
    if (gameId) {
      fetchGame();
      fetchProgress();
      loadSettings();
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

  const loadSettings = () => {
    if (!gameId) return;
    
    // Try to load from game-specific localStorage first
    const savedSettings = localStorage.getItem(`copenhagenSettings_${gameId}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setGimmesEnabled(settings.gimmesEnabled || false);
      setSweepRuleEnabled(settings.sweepRuleEnabled !== false); // Default to true
    }
  };

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData as CopenhagenGame);

        // Fetch holes data for completion dialog
        const { data: holesData } = await supabase
          .from("copenhagen_holes")
          .select("*")
          .eq("game_id", gameId)
          .order("hole_number");

        if (holesData) {
          setHoles(holesData as CopenhagenHole[]);
        }

        // Fetch course holes for scorecard structure
        if (gameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", gameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = gameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("copenhagen_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const saveSettings = async () => {
    if (!gameId || !game) return;

    try {
      // Update database for use_handicaps (always false)
      await supabase
        .from("copenhagen_games")
        .update({ use_handicaps: false })
        .eq("id", gameId);

      // Save other settings to localStorage
      const settings = { mulligansPerPlayer, gimmesEnabled, useHandicaps: false, sweepRuleEnabled };
      localStorage.setItem(`copenhagenSettings_${gameId}`, JSON.stringify(settings));

      toast({ title: "Settings saved" });
    } catch (error: any) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    }
  };

  // Auto-save settings when they change
  useEffect(() => {
    if (game && gameId) {
      const settings = { mulligansPerPlayer, gimmesEnabled, useHandicaps: false, sweepRuleEnabled };
      localStorage.setItem(`copenhagenSettings_${gameId}`, JSON.stringify(settings));
    }
  }, [mulligansPerPlayer, gimmesEnabled, sweepRuleEnabled, gameId, game]);

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
        .update({ is_finished: true, winner_player: winner, use_handicaps: false })
        .eq("id", game.id);

      toast({ title: "Game finished!" });
      setShowCompletionDialog(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("copenhagen_holes").delete().eq("game_id", gameId);
      await supabase.from("copenhagen_games").delete().eq("id", gameId);
      localStorage.removeItem(`copenhagenSettings_${gameId}`);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLeaveGame = async () => {
    setLeaving(true);
    try {
      // For Copenhagen, we can't really "leave" since players are just names, not user accounts
      // But we could mark the game as left by this user in the future
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
        {gameId && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  // Use individual player tees from DB - these are the actual per-player tees set in Game Settings
  const defaultTee = game.tee_set || 'white';
  const player1Tee = game.player_1_tee || defaultTee;
  const player2Tee = game.player_2_tee || defaultTee;
  const player3Tee = game.player_3_tee || defaultTee;
  
  const players: GamePlayer[] = [
    { 
      name: game.player_1, 
      handicap: undefined,
      tee: player1Tee
    },
    { 
      name: game.player_2, 
      handicap: undefined,
      tee: player2Tee
    },
    { 
      name: game.player_3, 
      handicap: undefined,
      tee: player3Tee
    },
  ];

  // tee_set is the "Default Tee" - display it in Game Details
  // If all players have same tee, show that; if different, show "Combo"
  const teeInfo = (() => {
    if (game.tee_set) {
      // Check if all players are using the default tee
      const allSameTee = player1Tee === game.tee_set && player2Tee === game.tee_set && player3Tee === game.tee_set;
      if (allSameTee || (!game.player_1_tee && !game.player_2_tee && !game.player_3_tee)) {
        return getTeeDisplayName(game.tee_set);
      }
      // Check if all players have the same (non-default) tee
      if (player1Tee === player2Tee && player2Tee === player3Tee) {
        return getTeeDisplayName(player1Tee);
      }
      return "Combo";
    }
    // Fallback: check individual tees
    if (player1Tee === player2Tee && player2Tee === player3Tee) {
      return getTeeDisplayName(player1Tee);
    }
    return "Combo";
  })();

  const stake = (game as any).stake_per_point ?? 1;
  const gameDetails: GameDetailsData = {
    format: "Copenhagen",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `${stake} per point • Gross scoring`,
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={(game as any).round_name || "Copenhagen"}
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

        {/* Game Settings - Hidden for spectators */}
        {!isSpectator && (<Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                Game Settings
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/game-settings/copenhagen/${gameId}?returnPath=/copenhagen/${gameId}/settings`)}
                className="h-8 w-8"
              >
                <Settings size={16} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrokePlayToggle gameId={gameId} gameType="copenhagen" />


            {/* Mulligans */}
            <div className="space-y-2">
              <Label>Mulligans per Player</Label>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mulligans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No mulligans</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">1 per 9 holes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of allowed do-overs per player during the round
              </p>
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded without being played
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
              />
            </div>

            {/* Sweep Rule toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="sweep">Sweep Rule</Label>
                <p className="text-xs text-muted-foreground">
                  One player wins all 6 points with the outright lowest net score
                </p>
              </div>
              <Switch
                id="sweep"
                checked={sweepRuleEnabled}
                onCheckedChange={setSweepRuleEnabled}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            isAdmin={currentUserId === game.user_id}
            onFinish={handleFinishGame}
            onSaveAndExit={() => navigate('/profile')}
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
        gameName="Copenhagen Game"
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveGame}
        leaving={leaving}
      />

      {/* Completion Dialog */}
      {game && (
        <CopenhagenCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          game={game}
          holes={holes}
          courseHoles={courseHoles}
        />
      )}

      {gameId && <CopenhagenBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
