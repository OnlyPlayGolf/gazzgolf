import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeeSelector, getTeeDisplayName } from "@/components/TeeSelector";
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
import { GameHeader } from "@/components/GameHeader";

interface SkinsGame {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  round_name: string | null;
  user_id: string;
  is_finished: boolean;
  skin_value: number;
  carryover_enabled: boolean;
  use_handicaps: boolean;
  players: any;
}

interface SkinsPlayer {
  id?: string;
  odId?: string;
  name: string;
  displayName?: string;
  handicap?: number | null;
  tee?: string | null;
  avatarUrl?: string | null;
}

export default function SimpleSkinsSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('skins', roundId);
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [players, setPlayers] = useState<SkinsPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  } = usePlayerStatsMode(roundId, 'skins');

  // Game settings state
  const [teeColor, setTeeColor] = useState("white");
  const [skinValue, setSkinValue] = useState(1);
  const [carryoverEnabled, setCarryoverEnabled] = useState(true);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
    
    if (roundId) {
      fetchGame();
      fetchProgress();
    }
  }, [roundId]);

  // Refetch data when page comes back into focus
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchGame();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [roundId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", roundId)
        .single();

      if (error) {
        console.error("Error fetching skins game:", error);
        setLoading(false);
        return;
      }

      if (gameData) {
        const gameWithDefaults: SkinsGame = {
          ...gameData,
          round_name: gameData.round_name || null,
        };
        setGame(gameWithDefaults);
        setSkinValue(gameData.skin_value || 1);
        setCarryoverEnabled(gameData.carryover_enabled ?? true);

        // Load saved tee preference from localStorage
        const savedTee = localStorage.getItem(`skins_tee_${roundId}`);
        if (savedTee) {
          setTeeColor(savedTee);
        }

        // Parse players from JSON
        const rawPlayers = gameData.players;
        const parsedPlayers: SkinsPlayer[] = Array.isArray(rawPlayers) 
          ? rawPlayers.map((p: any) => ({
              id: p.id,
              odId: p.odId,
              name: p.name || 'Player',
              displayName: p.displayName,
              handicap: p.handicap,
              tee: p.tee,
              avatarUrl: p.avatarUrl,
            }))
          : [];
        setPlayers(parsedPlayers);
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("skins_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", roundId);
    setHolesCompleted(count || 0);
  };

  const handleTeeChange = (newTee: string) => {
    setTeeColor(newTee);
    // Store tee preference locally since skins_games doesn't have tee_set column
    localStorage.setItem(`skins_tee_${roundId}`, newTee);
  };

  const handleSkinValueChange = async (value: string) => {
    const numValue = parseInt(value);
    setSkinValue(numValue);
    if (roundId) {
      await supabase
        .from("skins_games")
        .update({ skin_value: numValue })
        .eq("id", roundId);
    }
  };

  const handleCarryoverChange = async (checked: boolean) => {
    setCarryoverEnabled(checked);
    if (roundId) {
      await supabase
        .from("skins_games")
        .update({ carryover_enabled: checked })
        .eq("id", roundId);
    }
  };

  const handleFinishRound = async () => {
    if (roundId) {
      await supabase
        .from("skins_games")
        .update({ is_finished: true })
        .eq("id", roundId);
    }
    toast({ title: "Game saved" });
    navigate(`/skins/${roundId}/summary`);
  };

  const handleDeleteRound = async () => {
    if (!roundId) return;
    
    setDeleting(true);
    try {
      await supabase.from("skins_holes").delete().eq("game_id", roundId);
      await supabase.from("round_comments").delete().eq("round_id", roundId);
      const { error } = await supabase.from("skins_games").delete().eq("id", roundId);

      if (error) throw error;

      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleLeaveRound = async () => {
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
        {roundId && <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} />}
      </div>
    );
  }

  const defaultTee = teeColor || 'white';
  const gamePlayers: GamePlayer[] = players.map(p => ({
    name: p.displayName || p.name || "Player",
    handicap: p.handicap ?? null,
    tee: p.tee || defaultTee,
    avatarUrl: p.avatarUrl || null,
  }));

  // Determine tee display info
  const allPlayerTees = gamePlayers.map(p => p.tee);
  const uniqueTees = [...new Set(allPlayerTees)];
  const teeInfo = (() => {
    if (uniqueTees.length === 1) {
      return getTeeDisplayName(uniqueTees[0]!);
    }
    if (uniqueTees.length > 1) {
      return "Combo";
    }
    return getTeeDisplayName(defaultTee);
  })();

  const gameDetails: GameDetailsData = {
    format: "Skins",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players: gamePlayers,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `${skinValue} skin${skinValue !== 1 ? 's' : ''} per hole${carryoverEnabled ? " with carryover" : ""}`,
    roundName: game.round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || "Skins"}
        courseName={game.course_name}
        pageTitle="Settings"
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* My Stats Settings */}
        {currentUserId && !statsModeLoading && (
          <MyStatsSettings
            currentMode={playerStatsMode}
            onModeChange={setPlayerStatsMode}
            onDeleteStats={deletePlayerStats}
            saving={statsModeSaving}
          />
        )}

        {/* Game Settings - Hidden for spectators */}
        {!isSpectator && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-primary" />
                  Game Settings
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/game-settings/skins/${roundId}?returnPath=/skins/${roundId}/settings`)}
                  className="h-8 w-8"
                >
                  <Settings size={16} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StrokePlayToggle gameId={roundId} gameType="skins" />

              {/* Default Tee */}
              <div className="space-y-2">
                <Label>Default Tee Box</Label>
                <TeeSelector
                  value={teeColor}
                  onValueChange={handleTeeChange}
                  teeCount={5}
                  courseTeeNames={null}
                />
              </div>

              {/* Skin Value */}
              <div className="space-y-2">
                <Label>Skin Value</Label>
                <Select 
                  value={skinValue.toString()} 
                  onValueChange={handleSkinValueChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select skin value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 skin per hole</SelectItem>
                    <SelectItem value="2">2 skins per hole</SelectItem>
                    <SelectItem value="5">5 skins per hole</SelectItem>
                    <SelectItem value="10">10 skins per hole</SelectItem>
                    <SelectItem value="20">20 skins per hole</SelectItem>
                    <SelectItem value="50">50 skins per hole</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Carryover toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="carryover">Carryover</Label>
                  <p className="text-xs text-muted-foreground">
                    Ties carry the skin to the next hole
                  </p>
                </div>
                <Switch
                  id="carryover"
                  checked={carryoverEnabled}
                  onCheckedChange={handleCarryoverChange}
                />
              </div>

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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            isAdmin={currentUserId === game.user_id}
            onFinish={handleFinishRound}
            onSaveAndExit={() => navigate('/profile')}
            onDelete={() => setShowDeleteDialog(true)}
            onLeave={() => setShowLeaveDialog(true)}
            finishLabel="Finish Game"
          />
        )}
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={gamePlayers}
        useHandicaps={game.use_handicaps}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteRound}
        gameName="Game"
        deleting={deleting}
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveRound}
        leaving={leaving}
      />

      <SkinsBottomTabBar roundId={roundId!} isSpectator={isSpectator} />
    </div>
  );
}
