import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, ArrowLeft } from "lucide-react";
import { useRoundNavigation } from "@/hooks/useRoundNavigation";
import { GameHeader } from "@/components/GameHeader";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTeeDisplayName } from "@/components/TeeSelector";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { usePlayerStatsMode } from "@/hooks/usePlayerStatsMode";
import { MyStatsSettings } from "@/components/play/MyStatsSettings";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
  LeaveGameDialog,
} from "@/components/settings";

interface RoundData {
  id: string;
  user_id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  tee_set: string | null;
  round_name: string | null;
  origin: string | null;
}

interface RoundPlayer {
  id: string;
  user_id: string | null;
  handicap: number | null;
  tee_color: string | null;
  is_guest?: boolean;
  guest_name?: string | null;
  profiles?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function RoundSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading, isEditWindowExpired } = useIsSpectator('round', roundId);
  
  // Use standardized navigation hook for back button behavior
  const { handleBack } = useRoundNavigation({
    gameId: roundId || '',
    mode: 'round',
  });
  
  const [round, setRound] = useState<RoundData | null>(null);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPlayerRecord, setCurrentPlayerRecord] = useState<RoundPlayer | null>(null);

  // Game settings state
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

  // Player stats mode for current user
  const { statsMode, saving: statsModeSaving, setStatsMode, deletePlayerStats } = usePlayerStatsMode(roundId, 'round');

  useEffect(() => {
    if (roundId) {
      fetchRound();
      loadSettings();
    }
  }, [roundId]);

  // Fetch progress when currentPlayerRecord is available
  useEffect(() => {
    if (roundId && currentPlayerRecord?.id) {
      fetchProgress();
    }
  }, [roundId, currentPlayerRecord?.id]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchRound();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && roundId) {
        fetchRound();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roundId]);

  // Set up realtime subscriptions for players and groups changes
  useEffect(() => {
    if (!roundId) return;

    const channel = supabase
      .channel(`round-settings-participants-${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_players',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          // Refetch round data when players change
          fetchRound();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_groups',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          // Refetch round data when groups change
          fetchRound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const loadSettings = () => {
    // First try round-specific settings (from localStorage for persistence)
    const roundSettings = localStorage.getItem(`roundSettings_${roundId}`);
    if (roundSettings) {
      const settings = JSON.parse(roundSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setGimmesEnabled(settings.gimmesEnabled || false);
      return;
    }
    
    // Fallback to session storage for new rounds
    const savedSettings = sessionStorage.getItem('strokePlaySettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setGimmesEnabled(settings.gimmesEnabled || false);
    }
  };

  const saveSettings = () => {
    // Save to round-specific localStorage for persistence
    localStorage.setItem(`roundSettings_${roundId}`, JSON.stringify({
      mulligansPerPlayer,
      gimmesEnabled,
    }));
    // Also save to session storage for backward compatibility
    sessionStorage.setItem('strokePlaySettings', JSON.stringify({
      mulligansPerPlayer,
      gimmesEnabled,
    }));
  };

  useEffect(() => {
    if (!loading && !isSpectator && !isEditWindowExpired) {
      saveSettings();
    }
  }, [mulligansPerPlayer, gimmesEnabled, loading, isSpectator, isEditWindowExpired]);

  const fetchRound = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundData) {
        setRound(roundData);
      }

      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id, handicap, tee_color, is_guest, guest_name")
        .eq("round_id", roundId);

      if (playersData && playersData.length > 0) {
        // Separate registered users and guests
        const registeredPlayerData = playersData.filter(p => !p.is_guest && p.user_id);
        const guestPlayerData = playersData.filter(p => p.is_guest);
        
        let allPlayers: RoundPlayer[] = [];
        
        // Fetch profiles for registered users
        if (registeredPlayerData.length > 0) {
          const userIds = registeredPlayerData.map(p => p.user_id).filter((id): id is string => id !== null);
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);

          const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
          
          const playersWithProfiles = registeredPlayerData.map(p => ({
            ...p,
            profiles: profilesMap.get(p.user_id!) || null
          }));

          allPlayers = playersWithProfiles;
        }
        
        // Add guest players
        guestPlayerData.forEach(g => {
          allPlayers.push({
            id: g.id,
            user_id: null,
            handicap: g.handicap,
            tee_color: g.tee_color,
            is_guest: true,
            guest_name: g.guest_name,
            profiles: {
              display_name: g.guest_name,
              username: null,
              avatar_url: null,
            },
          });
        });

        setPlayers(allPlayers as RoundPlayer[]);
        
        // Find current user's player record
        if (user) {
          const currentPlayer = allPlayers.find(p => p.user_id === user.id);
          setCurrentPlayerRecord(currentPlayer as RoundPlayer || null);
        }
        
        // Check if any player has handicap
      }
    } catch (error) {
      console.error("Error fetching round:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    if (!currentPlayerRecord?.id) {
      setHolesCompleted(0);
      return;
    }
    const { count } = await supabase
      .from("holes")
      .select("*", { count: "exact", head: true })
      .eq("round_id", roundId)
      .eq("player_id", currentPlayerRecord.id)
      .gt("score", 0); // Only count holes with actual scores
    setHolesCompleted(count || 0);
  };

  const handleFinishRound = async () => {
    toast({ title: "Round saved" });
    navigate(`/rounds/${roundId}/summary`);
  };

  const handleDeleteRound = async () => {
    if (!roundId) return;
    
    setDeleting(true);
    try {
      // Delete pro stats data if it exists
      const { data: proRound } = await supabase
        .from('pro_stats_rounds')
        .select('id')
        .eq('external_round_id', roundId)
        .maybeSingle();

      if (proRound?.id) {
        // Delete pro stats holes
        await supabase
          .from('pro_stats_holes')
          .delete()
          .eq('pro_round_id', proRound.id);
        
        // Delete pro stats round
        await supabase
          .from('pro_stats_rounds')
          .delete()
          .eq('id', proRound.id);
      }

      // Delete regular round data
      await supabase.from("holes").delete().eq("round_id", roundId);
      await supabase.from("round_players").delete().eq("round_id", roundId);
      const { error } = await supabase.from("rounds").delete().eq("id", roundId);

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

  const handleLeaveRound = async () => {
    if (!roundId || !currentPlayerRecord) return;
    
    setLeaving(true);
    try {
      // Delete player's holes
      await supabase.from("holes").delete().eq("player_id", currentPlayerRecord.id);
      // Delete player from round_players
      const { error } = await supabase.from("round_players").delete().eq("id", currentPlayerRecord.id);

      if (error) throw error;

      toast({ title: "Left round successfully" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error leaving round", description: error.message, variant: "destructive" });
    } finally {
      setLeaving(false);
      setShowLeaveDialog(false);
    }
  };

  const isAdmin = round?.user_id === currentUserId;

  const renderBottomTabBar = () => {
    if (!roundId || isSpectatorLoading) return null;
    if (round?.origin === "skins") {
      return <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />;
    }
    return <RoundBottomTabBar roundId={roundId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />;
  };

  if (loading || !round || isSpectatorLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Use individual player tees from DB - these are the actual per-player tees set in Game Settings
  const defaultTee = round.tee_set || 'white';
  const gamePlayers: GamePlayer[] = players.map(p => {
    // For guest players, use guest_name; for registered players, use profile
    const name = p.is_guest 
      ? (p.guest_name || "Guest")
      : (p.profiles?.display_name || p.profiles?.username || "Player");
    return {
      name,
      handicap: p.handicap,
      tee: p.tee_color || defaultTee, // Individual player tee from DB, fallback to default
      avatarUrl: p.profiles?.avatar_url,
    };
  });

  // tee_set is the "Default Tee" - display it in Game Details
  // If all players have same tee, show that; if different, show "Combo"
  const allPlayerTees = gamePlayers.map(p => p.tee);
  const uniqueTees = [...new Set(allPlayerTees)];
  const teeInfo = (() => {
    if (round.tee_set && uniqueTees.length === 1 && uniqueTees[0] === round.tee_set) {
      return getTeeDisplayName(round.tee_set);
    }
    if (uniqueTees.length === 1) {
      return getTeeDisplayName(uniqueTees[0]!);
    }
    if (uniqueTees.length > 1) {
      return "Combo";
    }
    return round.tee_set ? getTeeDisplayName(round.tee_set) : "Not specified";
  })();

  const hasHandicaps = false;

  const gameDetails: GameDetailsData = {
    format: "Stroke Play",
    courseName: round.course_name,
    datePlayed: round.date_played,
    players: gamePlayers,
    teeInfo,
    holesPlayed: round.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: "Gross scoring",
    roundName: round.round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader
        gameTitle={round.round_name || "Round"}
        courseName={round.course_name}
        pageTitle="Settings"
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* My Stats Settings - Available for all participants (not spectators) */}
        {!isSpectator && (
          <MyStatsSettings
            currentMode={statsMode}
            onModeChange={setStatsMode}
            onDeleteStats={deletePlayerStats}
            saving={statsModeSaving}
          />
        )}

        {/* Game Settings - Visible for all but locked for spectators or when edit window expired */}
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
                  onClick={() => navigate(`/game-settings/round/${roundId}?returnPath=/rounds/${roundId}/settings`)}
                  className="h-8 w-8"
                >
                  <Settings size={16} />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mulligans */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Mulligans per Player</Label>
                <p className="text-xs text-muted-foreground">
                  Extra shots allowed per player
                </p>
              </div>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select" />
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

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
                disabled={isSpectator || (isEditWindowExpired ?? false)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            isAdmin={isAdmin}
            onFinish={handleFinishRound}
            onDelete={isAdmin ? () => setShowDeleteDialog(true) : undefined}
            onLeave={!isAdmin ? () => setShowLeaveDialog(true) : undefined}
            finishLabel="Finish Round"
          />
        )}
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={gamePlayers}
        useHandicaps={hasHandicaps}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteRound}
        gameName="Round"
        deleting={deleting}
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveRound}
        leaving={leaving}
      />

      {renderBottomTabBar()}
    </div>
  );
}
