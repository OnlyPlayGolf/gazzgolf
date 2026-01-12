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
  course_name: string;
  date_played: string;
  holes_played: number;
  tee_set: string | null;
  round_name: string | null;
  origin: string | null;
  user_id: string;
}

interface RoundPlayer {
  id: string;
  user_id: string;
  handicap: number | null;
  tee_color: string | null;
  profiles?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function SimpleSkinsSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('skins', roundId);
  const [round, setRound] = useState<RoundData | null>(null);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

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
      fetchRound();
      fetchProgress();
      loadSettings();
    }
  }, [roundId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (roundId) {
        fetchRound();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [roundId]);

  const loadSettings = () => {
    // First try round-specific settings (from localStorage for persistence)
    const roundSettings = localStorage.getItem(`simpleSkinsRoundSettings_${roundId}`);
    if (roundSettings) {
      const settings = JSON.parse(roundSettings);
      setSkinValue(settings.skinValue || 1);
      setCarryoverEnabled(settings.carryoverEnabled ?? true);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      return;
    }
    
    // Fallback to session storage for new rounds
    const savedSettings = sessionStorage.getItem('simpleSkinsSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setSkinValue(settings.skinValue || 1);
      setCarryoverEnabled(settings.carryoverEnabled ?? true);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
    }
  };

  const saveSettings = () => {
    // Save to round-specific localStorage for persistence
    localStorage.setItem(`simpleSkinsRoundSettings_${roundId}`, JSON.stringify({
      skinValue,
      carryoverEnabled,
      mulligansPerPlayer,
    }));
    // Also save to session storage for backward compatibility
    sessionStorage.setItem('simpleSkinsSettings', JSON.stringify({
      skinValue,
      carryoverEnabled,
      mulligansPerPlayer,
    }));
  };

  useEffect(() => {
    if (!loading) {
      saveSettings();
    }
  }, [skinValue, carryoverEnabled, mulligansPerPlayer]);

  const fetchRound = async () => {
    try {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundData) {
        setRound(roundData);
        if (roundData.tee_set) {
          setTeeColor(roundData.tee_set);
        }
      }

      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id, handicap, tee_color")
        .eq("round_id", roundId);

      if (playersData && playersData.length > 0) {
        // Fetch profiles separately
        const userIds = playersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const playersWithProfiles = playersData.map(p => ({
          ...p,
          profiles: profilesMap.get(p.user_id) || null
        }));

        setPlayers(playersWithProfiles as RoundPlayer[]);
      }
    } catch (error) {
      console.error("Error fetching round:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("holes")
      .select("*", { count: "exact", head: true })
      .eq("round_id", roundId);
    setHolesCompleted(count || 0);
  };

  const handleTeeChange = async (newTee: string) => {
    setTeeColor(newTee);
    if (roundId) {
      await supabase
        .from("rounds")
        .update({ tee_set: newTee })
        .eq("id", roundId);
    }
  };

  const handleFinishRound = async () => {
    toast({ title: "Game saved" });
    navigate(`/simple-skins/${roundId}/summary`);
  };

  const handleDeleteRound = async () => {
    if (!roundId) return;
    
    setDeleting(true);
    try {
      await supabase.from("holes").delete().eq("round_id", roundId);
      await supabase.from("round_players").delete().eq("round_id", roundId);
      await supabase.from("round_comments").delete().eq("round_id", roundId);
      const { error } = await supabase.from("rounds").delete().eq("id", roundId);

      if (error) throw error;

      // Clean up localStorage
      localStorage.removeItem(`simpleSkinsRoundSettings_${roundId}`);

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

  if (loading || isSpectatorLoading || !round) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {roundId && <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} />}
      </div>
    );
  }

  // Use individual player tees from DB - these are the actual per-player tees set in Game Settings
  const defaultTee = round.tee_set || 'white';
  const gamePlayers: GamePlayer[] = players.map(p => {
    const profile = p.profiles;
    return {
      name: profile?.display_name || profile?.username || "Player",
      handicap: p.handicap,
      tee: p.tee_color || defaultTee, // Individual player tee from DB, fallback to default
      avatarUrl: profile?.avatar_url,
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

  const gameDetails: GameDetailsData = {
    format: "Skins",
    courseName: round.course_name,
    datePlayed: round.date_played,
    players: gamePlayers,
    teeInfo,
    holesPlayed: round.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: skinValue.toString() === "progressive" 
      ? `Progressive skins${carryoverEnabled ? " with carryover" : ""}`
      : `${skinValue} skin${skinValue !== 1 ? 's' : ''} per hole${carryoverEnabled ? " with carryover" : ""}`,
    roundName: round.round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

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
                  onValueChange={(value) => setSkinValue(parseInt(value))}
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
                    <SelectItem value="progressive">1 skin first 6, 2 skins next 6, 3 skins last 6</SelectItem>
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
                  onCheckedChange={setCarryoverEnabled}
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
          isAdmin={currentUserId === round.user_id}
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
        useHandicaps={false}
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
