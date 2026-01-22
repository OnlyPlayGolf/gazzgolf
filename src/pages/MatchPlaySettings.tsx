import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { MatchPlayGame } from "@/types/matchPlay";
import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function MatchPlaySettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isEditWindowExpired } = useIsSpectator('match_play', gameId);
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [allGamesInEvent, setAllGamesInEvent] = useState<MatchPlayGame[]>([]);
  const [loading, setLoading] = useState(true);
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
  } = usePlayerStatsMode(gameId, 'match_play');

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
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (data) {
        setGame(data as MatchPlayGame);
        
        // If this game is part of an event, fetch all games in that event
        if (data.event_id) {
          const { data: eventGames } = await supabase
            .from("match_play_games")
            .select("*")
            .eq("event_id", data.event_id)
            .order("created_at");
          
          if (eventGames) {
            setAllGamesInEvent(eventGames as MatchPlayGame[]);
          }
        } else {
          setAllGamesInEvent([data as MatchPlayGame]);
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
      .from("match_play_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const winner = game.match_status > 0 ? game.player_1 : 
                     game.match_status < 0 ? game.player_2 : null;
      
      await supabase
        .from("match_play_games")
        .update({ is_finished: true, winner_player: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/match-play/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("match_play_holes").delete().eq("game_id", gameId);
      await supabase.from("match_play_games").delete().eq("id", gameId);
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

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  // Build players list from ALL games in the event (all groups)
  // Use individual player tees from the database - these are the actual per-player tees set in Game Settings
  const players: GamePlayer[] = allGamesInEvent.flatMap((g, gameIndex) => {
    const groupLabel = allGamesInEvent.length > 1 ? `Match ${gameIndex + 1}` : undefined;
    const defaultTee = g.tee_set || 'white';
    return [
      { 
        name: g.player_1, 
        handicap: undefined,
        tee: g.player_1_tee || defaultTee, // Individual player tee from DB, fallback to default
        team: groupLabel,
      },
      { 
        name: g.player_2, 
        handicap: undefined,
        tee: g.player_2_tee || defaultTee, // Individual player tee from DB, fallback to default
        team: groupLabel,
      },
    ];
  });

  // tee_set is the "Default Tee" from Game Settings - this controls Game Details display
  // If all players have the same tee, show that; if different tees, show "Combo"
  const teeInfo = (() => {
    // Get all unique player tees
    const player1Tee = game.player_1_tee || game.tee_set;
    const player2Tee = game.player_2_tee || game.tee_set;
    
    // If tee_set is defined, use it as the primary display
    if (game.tee_set) {
      // Check if all players are using the default tee
      const allSameTee = player1Tee === game.tee_set && player2Tee === game.tee_set;
      if (allSameTee || (!game.player_1_tee && !game.player_2_tee)) {
        return getTeeDisplayName(game.tee_set);
      }
      // Players have different tees from default
      if (player1Tee === player2Tee) {
        return getTeeDisplayName(player1Tee!);
      }
      return "Combo";
    }
    // Fallback: if no tee_set, check individual tees
    if (player1Tee && player2Tee) {
      if (player1Tee === player2Tee) {
        return getTeeDisplayName(player1Tee);
      }
      return "Combo";
    }
    if (player1Tee) return getTeeDisplayName(player1Tee);
    return "Not specified";
  })();

  const gameDetails: GameDetailsData = {
    format: "Match Play",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: "Gross scoring",
    roundName: (game as any).round_name,
  };

  const handleUpdateMulligans = async (value: string) => {
    const newValue = parseInt(value);
    try {
      await supabase
        .from("match_play_games")
        .update({ mulligans_per_player: newValue })
        .eq("id", gameId);
      
      setGame(prev => prev ? { ...prev, mulligans_per_player: newValue } : null);
      toast({ title: "Settings updated" });
    } catch (error: any) {
      toast({ title: "Error updating settings", description: error.message, variant: "destructive" });
    }
  };


  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={game.round_name || "Match Play"}
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

        {/* Game Settings Card - Visible for all but locked for spectators or when edit window expired */}
        <Card className={(isSpectator || (isEditWindowExpired ?? false)) ? 'opacity-90' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-primary" />
                Settings
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
                  onClick={() => navigate(`/game-settings/match-play/${gameId}?returnPath=/match-play/${gameId}/settings`)}
                  className="h-8 w-8"
                >
                  <Settings size={16} />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrokePlayToggle gameId={gameId} gameType="match_play" disabled={isSpectator || (isEditWindowExpired ?? false)} />


            <div className="space-y-2">
              <Label htmlFor="mulligans">Mulligans per Player</Label>
              <Select 
                value={(game.mulligans_per_player || 0).toString()} 
                onValueChange={handleUpdateMulligans}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
                <SelectTrigger id="mulligans">
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
                Number of allowed do-overs per player
              </p>
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
        gameName="Match Play Game"
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveGame}
        leaving={leaving}
      />

      {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
    </div>
  );
}
