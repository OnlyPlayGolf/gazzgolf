import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, ArrowLeft } from "lucide-react";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeeSelector, STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

interface RoundData {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  tee_set: string | null;
  round_name: string | null;
  origin: string | null;
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

export default function RoundSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator } = useIsSpectator('round', roundId);
  const [round, setRound] = useState<RoundData | null>(null);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);

  // Game settings state
  const [teeColor, setTeeColor] = useState("white");
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

  useEffect(() => {
    if (roundId) {
      fetchRound();
      fetchProgress();
      loadSettings();
    }
  }, [roundId]);

  const loadSettings = () => {
    // First try round-specific settings (from localStorage for persistence)
    const roundSettings = localStorage.getItem(`roundSettings_${roundId}`);
    if (roundSettings) {
      const settings = JSON.parse(roundSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setHandicapEnabled(settings.handicapEnabled || false);
      setGimmesEnabled(settings.gimmesEnabled || false);
      return;
    }
    
    // Fallback to session storage for new rounds
    const savedSettings = sessionStorage.getItem('strokePlaySettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setHandicapEnabled(settings.handicapEnabled || false);
      setGimmesEnabled(settings.gimmesEnabled || false);
    }
  };

  const saveSettings = () => {
    // Save to round-specific localStorage for persistence
    localStorage.setItem(`roundSettings_${roundId}`, JSON.stringify({
      mulligansPerPlayer,
      handicapEnabled,
      gimmesEnabled,
    }));
    // Also save to session storage for backward compatibility
    sessionStorage.setItem('strokePlaySettings', JSON.stringify({
      mulligansPerPlayer,
      handicapEnabled,
      gimmesEnabled,
    }));
  };

  useEffect(() => {
    if (!loading) {
      saveSettings();
    }
  }, [mulligansPerPlayer, handicapEnabled, gimmesEnabled]);

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
        // Check if any player has handicap
        const hasHandicaps = playersData.some(p => p.handicap !== null);
        setHandicapEnabled(hasHandicaps);
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
    toast({ title: "Round saved" });
    navigate(`/rounds/${roundId}/summary`);
  };

  const handleDeleteRound = async () => {
    if (!roundId) return;
    
    setDeleting(true);
    try {
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

  const renderBottomTabBar = () => {
    if (!roundId) return null;
    if (round?.origin === "skins") {
      return <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} />;
    }
    return <RoundBottomTabBar roundId={roundId} isSpectator={isSpectator} />;
  };

  if (loading || !round) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {roundId && <RoundBottomTabBar roundId={roundId} isSpectator={isSpectator} />}
      </div>
    );
  }

  const gamePlayers: GamePlayer[] = players.map(p => {
    const profile = p.profiles;
    return {
      name: profile?.display_name || profile?.username || "Player",
      handicap: p.handicap,
      tee: p.tee_color,
      avatarUrl: profile?.avatar_url,
    };
  });

  const tees = players.map(p => p.tee_color).filter(Boolean);
  const uniqueTees = [...new Set(tees)];
  const teeInfo = uniqueTees.length === 0 ? (round.tee_set || "Not specified") :
                  uniqueTees.length === 1 ? uniqueTees[0]! : "Mixed tees";

  const hasHandicaps = players.some(p => p.handicap !== null);

  const gameDetails: GameDetailsData = {
    format: "Stroke Play",
    courseName: round.course_name,
    datePlayed: round.date_played,
    players: gamePlayers,
    teeInfo,
    holesPlayed: round.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: hasHandicaps ? "Net scoring (handicaps enabled)" : "Gross scoring",
    roundName: round.round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {isSpectator && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4">
          <div className="relative flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} />
            </Button>
            <h2 className="text-lg font-bold">Settings</h2>
          </div>
        </div>
      )}
      <div className={`p-4 max-w-2xl mx-auto space-y-4 ${isSpectator ? 'pt-20' : 'pt-6'}`}>
        {!isSpectator && <h1 className="text-2xl font-bold">Settings</h1>}

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* Game Settings - Read-only for spectators */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings size={20} className="text-primary" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Tee */}
            <div className="space-y-2">
              <Label>Default Tee Box</Label>
              {isSpectator ? (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <span className="capitalize">{teeColor}</span>
                </div>
              ) : (
                <TeeSelector
                  value={teeColor}
                  onValueChange={handleTeeChange}
                  teeCount={5}
                  courseTeeNames={null}
                />
              )}
            </div>

            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              {isSpectator ? (
                <span className="text-sm text-muted-foreground">{handicapEnabled ? "Yes" : "No"}</span>
              ) : (
                <Switch
                  id="handicap"
                  checked={handicapEnabled}
                  onCheckedChange={setHandicapEnabled}
                />
              )}
            </div>

            {/* Mulligans */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Mulligans per Player</Label>
                <p className="text-xs text-muted-foreground">
                  Extra shots allowed per player
                </p>
              </div>
              {isSpectator ? (
                <span className="text-sm text-muted-foreground">
                  {mulligansPerPlayer === 0 ? "None" : mulligansPerPlayer === 9 ? "1 per 9 holes" : mulligansPerPlayer}
                </span>
              ) : (
                <Select 
                  value={mulligansPerPlayer.toString()} 
                  onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
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
              )}
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded
                </p>
              </div>
              {isSpectator ? (
                <span className="text-sm text-muted-foreground">{gimmesEnabled ? "Yes" : "No"}</span>
              ) : (
                <Switch
                  id="gimmes"
                  checked={gimmesEnabled}
                  onCheckedChange={setGimmesEnabled}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            onFinish={handleFinishRound}
            onSaveAndExit={() => navigate(`/rounds/${roundId}/summary`)}
            onDelete={() => setShowDeleteDialog(true)}
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

      {renderBottomTabBar()}
    </div>
  );
}
