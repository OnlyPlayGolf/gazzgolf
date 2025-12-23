import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { SkinsGame, SkinsPlayer } from "@/types/skins";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function SkinsSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<SkinsGame | null>(null);
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
        .from("skins_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame({
          ...gameData,
          players: (gameData.players as unknown as SkinsPlayer[]) || [],
          handicap_mode: (gameData.handicap_mode as 'gross' | 'net') || 'net',
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
      .from("skins_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleFinishGame = async () => {
    if (!game) return;

    try {
      await supabase
        .from("skins_games")
        .update({ is_finished: true })
        .eq("id", game.id);

      toast({ title: "Game finished!" });
      navigate(`/skins/${game.id}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("skins_holes").delete().eq("game_id", gameId);
      await supabase.from("skins_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen pb-32 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <SkinsBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const players: GamePlayer[] = game.players.map(p => ({
    name: p.name,
    handicap: game.use_handicaps ? p.handicap : undefined,
    tee: (p as any).tee_color,
    team: p.group_name,
  }));

  const tees = game.players.map(p => (p as any).tee_color).filter(Boolean);
  const uniqueTees = [...new Set(tees)];
  const teeInfo = uniqueTees.length === 0 ? "Not specified" :
                  uniqueTees.length === 1 ? String(uniqueTees[0]) : "Mixed tees";

  const scoringParts = [`$${game.skin_value} per skin`];
  if (game.carryover_enabled) scoringParts.push("Carryover");
  if (game.use_handicaps) scoringParts.push(`${game.handicap_mode} scoring`);

  const gameDetails: GameDetailsData = {
    format: "Skins",
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
    <div className="min-h-screen pb-32 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Settings</h1>

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        <RoundActionsSection
          onFinish={handleFinishGame}
          onSaveAndExit={() => navigate(`/skins/${gameId}/summary`)}
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
        gameName="Skins Game"
      />

      {gameId && <SkinsBottomTabBar gameId={gameId} />}
    </div>
  );
}
