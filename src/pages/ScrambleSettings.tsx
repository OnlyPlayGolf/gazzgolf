import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/notify";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam, ScrambleHole } from "@/types/scramble";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { MyStatsSettings } from "@/components/play/MyStatsSettings";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { useRoundNavigation } from "@/hooks/useRoundNavigation";
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
import { ScrambleCompletionDialog } from "@/components/ScrambleCompletionDialog";

export default function ScrambleSettings() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('scramble', gameId);
  const { handleBack } = useRoundNavigation({ gameId: gameId || '', mode: 'scramble' });
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [minDrives, setMinDrives] = useState<string>('none');
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [scoringType, setScoringType] = useState<'gross' | 'net'>('gross');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [holes, setHoles] = useState<ScrambleHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<Array<{ hole_number: number; par: number; stroke_index: number }>>([]);

  // Per-player stats mode
  const { 
    statsMode: playerStatsMode, 
    loading: statsModeLoading,
    saving: statsModeSaving,
    setStatsMode: setPlayerStatsMode,
    deletePlayerStats,
  } = usePlayerStatsMode(gameId, 'scramble');

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
        .from('scramble_games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (data) {
        const typedGame = {
          ...data,
          teams: (data.teams as unknown as ScrambleTeam[]) || [],
        } as ScrambleGame;
        setGame(typedGame);
        setMinDrives(data.min_drives_per_player?.toString() || 'none');
        setScoringType(data.scoring_type as 'gross' | 'net');

        // Fetch holes data for completion dialog
        const { data: holesData } = await supabase
          .from("scramble_holes")
          .select("*")
          .eq("game_id", gameId)
          .order("hole_number");

        if (holesData) {
          setHoles(holesData.map(h => ({
            ...h,
            team_scores: (h.team_scores as Record<string, number | null>) || {},
            team_tee_shots: ((h as Record<string, unknown>).team_tee_shots as Record<string, string | null>) || {}
          })));
        }

        // Fetch course holes for scorecard structure
        if (data.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", data.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = data.holes_played === 9 
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
      .from("scramble_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const saveSettings = async (updates: {
    minDrives?: string;
    useHandicaps?: boolean;
    scoringType?: 'gross' | 'net';
  }) => {
    const minDrivesValue = updates.minDrives ?? minDrives;
    const useHandicapsValue = false;
    const scoringTypeValue = updates.scoringType ?? scoringType;

    const { error } = await supabase
      .from('scramble_games')
      .update({
        min_drives_per_player: minDrivesValue === 'none' ? null : parseInt(minDrivesValue),
        use_handicaps: useHandicapsValue,
        scoring_type: scoringTypeValue
      })
      .eq('id', gameId);

    if (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleMinDrivesChange = (value: string) => {
    setMinDrives(value);
    saveSettings({ minDrives: value });
  };

  const handleUseHandicapsChange = (value: boolean) => {
    setUseHandicaps(value);
    saveSettings({ useHandicaps: value });
  };

  const handleScoringTypeChange = (value: 'gross' | 'net') => {
    setScoringType(value);
    saveSettings({ scoringType: value });
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      await supabase
        .from('scramble_games')
        .update({ is_finished: true })
        .eq('id', gameId);
      
      toast.success("Game finished!");
      setShowCompletionDialog(true);
    } catch (error) {
      toast.error("Failed to finish round");
    }
  };

  const handleDeleteGame = async () => {
    const { error } = await supabase
      .from('scramble_games')
      .delete()
      .eq('id', gameId);

    if (error) {
      toast.error("Failed to delete game");
      return;
    }

    toast.success("Game deleted");
    navigate('/rounds-play');
  };

  const handleLeaveGame = async () => {
    setLeaving(true);
    try {
      toast.success("Left the game");
      navigate("/rounds-play");
    } catch (error) {
      toast.error("Failed to leave game");
    } finally {
      setLeaving(false);
      setShowLeaveDialog(false);
    }
  };

  if (loading || isSpectatorLoading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p>Loading...</p>
        {gameId && <ScrambleBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  // Use individual player tees from the teams array - these are set per-player in Game Settings
  const defaultTee = game.tee_set || 'white';
  const players: GamePlayer[] = game.teams.flatMap((team) =>
    team.players.map(p => ({
      name: p.name,
      handicap: undefined,
      tee: p.tee || defaultTee, // Individual player tee from DB, fallback to default
      team: team.name,
      userId: p.userId || null,
    }))
  );

  // tee_set is the "Default Tee" - display it in Game Details
  // If all players have same tee, show that; if different, show "Combo"
  const allPlayerTees = players.map(p => p.tee);
  const uniqueTees = [...new Set(allPlayerTees)];
  const teeInfo = (() => {
    if (game.tee_set && uniqueTees.length === 1 && uniqueTees[0] === game.tee_set) {
      return getTeeDisplayName(game.tee_set);
    }
    if (uniqueTees.length === 1) {
      return getTeeDisplayName(uniqueTees[0]!);
    }
    if (uniqueTees.length > 1) {
      return "Combo";
    }
    return game.tee_set ? getTeeDisplayName(game.tee_set) : "Not specified";
  })();

  const scoringParts = [scoringType === 'net' ? 'Net scoring' : 'Gross scoring'];
  if (minDrives !== 'none') scoringParts.push(`Min ${minDrives} drives/player`);

  const gameDetails: GameDetailsData = {
    format: "Scramble",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: scoringParts.join(" • "),
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <GameHeader
        gameTitle={(game as any).round_name || "Scramble"}
        courseName={game.course_name}
        pageTitle="Settings"
        onBack={handleBack}
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Minimum drives per player</Label>
                <p className="text-xs text-muted-foreground">Require each player's drive to be used</p>
              </div>
              <Select 
                value={minDrives} 
                onValueChange={handleMinDrivesChange}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {false && (
              <div className="flex items-center justify-between">
                <Label>Scoring Type</Label>
                <Select 
                  value={scoringType} 
                  onValueChange={handleScoringTypeChange}
                  disabled={isSpectator || (isEditWindowExpired ?? false)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="net">Net</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
        currentUserId={currentUserId}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Scramble Game"
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveGame}
        leaving={leaving}
      />

      {/* Completion Dialog */}
      {game && (
        <ScrambleCompletionDialog
          open={showCompletionDialog}
          onOpenChange={setShowCompletionDialog}
          game={game}
          teams={game.teams}
          holes={holes}
          courseHoles={courseHoles}
        />
      )}

      <ScrambleBottomTabBar gameId={gameId!} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />
    </div>
  );
}
