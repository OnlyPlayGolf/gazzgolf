import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MatchPlayBottomTabBar } from "@/components/MatchPlayBottomTabBar";
import { MatchPlayGame } from "@/types/matchPlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function MatchPlaySettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator } = useIsSpectator('match_play', gameId);
  const [game, setGame] = useState<MatchPlayGame | null>(null);
  const [loading, setLoading] = useState(true);
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
        .from("match_play_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (data) {
        setGame(data as MatchPlayGame);
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

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  const players: GamePlayer[] = [
    { 
      name: game.player_1, 
      handicap: game.use_handicaps ? game.player_1_handicap : undefined,
      tee: game.player_1_tee 
    },
    { 
      name: game.player_2, 
      handicap: game.use_handicaps ? game.player_2_handicap : undefined,
      tee: game.player_2_tee 
    },
  ];

  const teeInfo = (() => {
    if (game.player_1_tee && game.player_2_tee) {
      if (game.player_1_tee === game.player_2_tee) {
        return game.player_1_tee;
      }
      return "Mixed tees";
    }
    return game.tee_set || "Not specified";
  })();

  const gameDetails: GameDetailsData = {
    format: "Match Play",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: game.use_handicaps ? "Net scoring (handicaps enabled)" : "Gross scoring",
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

  const handleUpdateHandicaps = async (enabled: boolean) => {
    try {
      await supabase
        .from("match_play_games")
        .update({ use_handicaps: enabled })
        .eq("id", gameId);
      
      setGame(prev => prev ? { ...prev, use_handicaps: enabled } : null);
      toast({ title: "Settings updated" });
    } catch (error: any) {
      toast({ title: "Error updating settings", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* Game Settings Card - Hidden for spectators */}
        {!isSpectator && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Game Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="handicaps">Use Handicaps</Label>
                  <p className="text-xs text-muted-foreground">
                    Apply handicap strokes per hole
                  </p>
                </div>
                <Switch
                  id="handicaps"
                  checked={game.use_handicaps}
                  onCheckedChange={handleUpdateHandicaps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mulligans">Mulligans per Player</Label>
                <Select 
                  value={(game.mulligans_per_player || 0).toString()} 
                  onValueChange={handleUpdateMulligans}
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
        )}

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            isAdmin={true}
            onFinish={handleFinishGame}
            onSaveAndExit={() => navigate(`/match-play/${gameId}/summary`)}
            onDelete={() => setShowDeleteDialog(true)}
          />
        )}
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={players}
        useHandicaps={game.use_handicaps}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Match Play Game"
      />

      {gameId && <MatchPlayBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
