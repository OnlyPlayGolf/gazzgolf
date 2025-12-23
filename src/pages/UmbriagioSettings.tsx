import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UmbriagioBottomTabBar } from "@/components/UmbriagioBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame } from "@/types/umbriago";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function UmbriagioSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();
      if (data) {
        setGame(data as unknown as UmbriagioGame);
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("umbriago_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const winner = game.team_a_total_points > game.team_b_total_points ? "A" : 
                     game.team_b_total_points > game.team_a_total_points ? "B" : null;
      
      await supabase
        .from("umbriago_games")
        .update({ is_finished: true, winning_team: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/umbriago/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    if (!gameId) return;
    
    setDeleting(true);
    try {
      await supabase.from("umbriago_holes").delete().eq("game_id", gameId);
      const { error } = await supabase.from("umbriago_games").delete().eq("id", gameId);
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

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const players: GamePlayer[] = [
    { name: game.team_a_player_1, team: "Team A" },
    { name: game.team_a_player_2, team: "Team A" },
    { name: game.team_b_player_1, team: "Team B" },
    { name: game.team_b_player_2, team: "Team B" },
  ];

  const gameDetails: GameDetailsData = {
    format: "Umbriago",
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo: game.tee_set || "Not specified",
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: `${game.stake_per_point} per point • ${game.payout_mode}`,
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
          onSaveAndExit={() => navigate(`/umbriago/${gameId}/summary`)}
          onDelete={() => setShowDeleteDialog(true)}
        />
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
        gameName="Umbriago Game"
        deleting={deleting}
      />

      {gameId && <UmbriagioBottomTabBar gameId={gameId} />}
    </div>
  );
}
