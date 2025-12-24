import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, RotateCcw } from "lucide-react";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeeSelector, STANDARD_TEE_OPTIONS } from "@/components/TeeSelector";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  };
}

export default function RoundSettings() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [round, setRound] = useState<RoundData | null>(null);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [showBackToSetupDialog, setShowBackToSetupDialog] = useState(false);
  const [hasScores, setHasScores] = useState(false);

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
    const savedSettings = sessionStorage.getItem('strokePlaySettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setHandicapEnabled(settings.handicapEnabled || false);
      setGimmesEnabled(settings.gimmesEnabled || false);
    }
  };

  const saveSettings = () => {
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
        .select(`
          id,
          user_id,
          handicap,
          tee_color,
          profiles:user_id (
            display_name,
            username
          )
        `)
        .eq("round_id", roundId);

      if (playersData) {
        setPlayers(playersData as unknown as RoundPlayer[]);
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
    setHasScores((count || 0) > 0);
  };

  const handleBackToSetup = () => {
    if (hasScores) {
      setShowBackToSetupDialog(true);
    } else {
      navigateToSetup();
    }
  };

  const navigateToSetup = async () => {
    if (!round || !roundId) return;

    // Prepare data for setup page
    const setupData = {
      roundId: roundId,
      courseName: round.course_name,
      teeSet: round.tee_set || teeColor,
      holesPlayed: round.holes_played,
      roundName: round.round_name,
      datePlayed: round.date_played,
    };

    // Store current round data in sessionStorage for editing
    sessionStorage.setItem('editingRound', JSON.stringify(setupData));

    // Store players for the setup page
    const playersForSetup = players.map(p => ({
      odId: p.user_id,
      displayName: p.profiles?.display_name || p.profiles?.username || "Player",
      handicap: p.handicap,
      teeColor: p.tee_color || teeColor,
      isTemporary: false,
    }));
    sessionStorage.setItem('roundPlayers', JSON.stringify(playersForSetup.slice(1))); // Skip first (current user)
    
    // Store course info
    sessionStorage.setItem('selectedCourse', JSON.stringify({
      id: '',
      name: round.course_name,
      location: null,
    }));

    // Store holes selection
    const holesSelection = round.holes_played === 9 ? "front9" : "18";
    sessionStorage.setItem('selectedHoles', holesSelection);

    // Store tee color
    sessionStorage.setItem('userTeeColor', round.tee_set || teeColor);

    // Store stroke play settings
    sessionStorage.setItem('strokePlaySettings', JSON.stringify({
      mulligansPerPlayer,
      handicapEnabled,
      gimmesEnabled,
    }));

    navigate('/stroke-play-setup');
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
    if (round?.origin === "simple_skins") {
      return <SimpleSkinsBottomTabBar roundId={roundId} />;
    }
    return <RoundBottomTabBar roundId={roundId} />;
  };

  if (loading || !round) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {roundId && <RoundBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  const gamePlayers: GamePlayer[] = players.map(p => {
    const profile = p.profiles;
    return {
      name: profile?.display_name || profile?.username || "Player",
      handicap: p.handicap,
      tee: p.tee_color,
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
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* Game Settings */}
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
              <TeeSelector
                value={teeColor}
                onValueChange={handleTeeChange}
                teeCount={5}
                courseTeeNames={null}
              />
            </div>

            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={handicapEnabled}
                onCheckedChange={setHandicapEnabled}
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
                  <SelectItem value="0">0 (No mulligans)</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">9 (1 per hole on 9)</SelectItem>
                  <SelectItem value="18">18 (1 per hole on 18)</SelectItem>
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
              />
            </div>
          </CardContent>
        </Card>

        {/* Back to Round Setup Button */}
        {round?.origin !== "simple_skins" && (
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={handleBackToSetup}
          >
            <RotateCcw size={18} />
            Back to Round Setup
          </Button>
        )}

        <RoundActionsSection
          onFinish={handleFinishRound}
          onSaveAndExit={() => navigate(`/rounds/${roundId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
          finishLabel="Finish Round"
        />
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

      {/* Back to Setup Confirmation Dialog */}
      <AlertDialog open={showBackToSetupDialog} onOpenChange={setShowBackToSetupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Changing setup may affect existing scores</AlertDialogTitle>
            <AlertDialogDescription>
              You have already entered scores for this round. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={navigateToSetup}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {renderBottomTabBar()}
    </div>
  );
}
