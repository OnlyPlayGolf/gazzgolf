import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CopenhagenBottomTabBar } from "@/components/CopenhagenBottomTabBar";
import { CopenhagenGame, Press } from "@/types/copenhagen";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function CopenhagenSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
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
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          presses: (gameData.presses as unknown as Press[]) || [],
        });
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
        .update({ is_finished: true, winner_player: winner })
        .eq("id", game.id);

      toast({ title: "Game finished!" });
      navigate(`/copenhagen/${game.id}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("copenhagen_holes").delete().eq("game_id", gameId);
      await supabase.from("copenhagen_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
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
    { 
      name: game.player_3, 
      handicap: game.use_handicaps ? game.player_3_handicap : undefined,
      tee: game.player_3_tee 
    },
  ];

  const tees = [game.player_1_tee, game.player_2_tee, game.player_3_tee].filter(Boolean);
  const uniqueTees = [...new Set(tees)];
  const teeInfo = uniqueTees.length === 0 ? (game.tee_set || "Not specified") :
                  uniqueTees.length === 1 ? uniqueTees[0]! : "Mixed tees";

  const stake = (game as any).stake_per_point ?? 1;
  const gameDetails: GameDetailsData = {
    format: "Copenhagen",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: game.use_handicaps 
      ? `${stake} per point • Net scoring` 
      : `${stake} per point • Gross scoring`,
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        <RoundActionsSection
          onFinish={handleFinishGame}
          onSaveAndExit={() => navigate(`/copenhagen/${gameId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
        />
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
        gameName="Copenhagen Game"
      />

      {gameId && <CopenhagenBottomTabBar gameId={gameId} />}
    </div>
  );
}
