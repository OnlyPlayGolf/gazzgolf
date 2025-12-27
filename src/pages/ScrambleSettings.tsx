import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrambleBottomTabBar } from "@/components/ScrambleBottomTabBar";
import { ScrambleGame, ScrambleTeam } from "@/types/scramble";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function ScrambleSettings() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<ScrambleGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [minDrives, setMinDrives] = useState<string>('none');
  const [useHandicaps, setUseHandicaps] = useState(false);
  const [scoringType, setScoringType] = useState<'gross' | 'net'>('gross');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);

  useEffect(() => {
    if (gameId) {
      fetchGame();
      fetchProgress();
    }
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
        setUseHandicaps(data.use_handicaps);
        setScoringType(data.scoring_type as 'gross' | 'net');
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
    const useHandicapsValue = updates.useHandicaps ?? useHandicaps;
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
      navigate(`/scramble/${gameId}/summary`);
    } catch (error) {
      toast.error("Failed to finish game");
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

  if (loading || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <p>Loading...</p>
        {gameId && <ScrambleBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const players: GamePlayer[] = game.teams.flatMap((team) =>
    team.players.map(p => ({
      name: p.name,
      handicap: useHandicaps ? p.handicap : undefined,
      tee: (p as any).tee_color,
      team: team.name,
    }))
  );

  const allTees = game.teams.flatMap(t => t.players.map(p => (p as any).tee_color)).filter(Boolean);
  const uniqueTees = [...new Set(allTees)];
  const teeInfo = uniqueTees.length === 0 ? (game.tee_set || "Not specified") :
                  uniqueTees.length === 1 ? String(uniqueTees[0]) : "Mixed tees";

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
              <div>
                <Label>Minimum drives per player</Label>
                <p className="text-xs text-muted-foreground">Require each player's drive to be used</p>
              </div>
              <Select value={minDrives} onValueChange={handleMinDrivesChange}>
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

            <div className="flex items-center justify-between">
              <div>
                <Label>Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">Apply handicap strokes</p>
              </div>
              <Switch checked={useHandicaps} onCheckedChange={handleUseHandicapsChange} />
            </div>

            {useHandicaps && (
              <div className="flex items-center justify-between">
                <Label>Scoring Type</Label>
                <Select value={scoringType} onValueChange={handleScoringTypeChange}>
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

        <RoundActionsSection
          onFinish={handleFinishGame}
          onSaveAndExit={() => navigate(`/scramble/${gameId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
        />
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={players}
        useHandicaps={useHandicaps}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Scramble Game"
      />

      <ScrambleBottomTabBar gameId={gameId!} />
    </div>
  );
}
