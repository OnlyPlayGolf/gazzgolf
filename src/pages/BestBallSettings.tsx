import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { BestBallGame, BestBallPlayer, BestBallGameType } from "@/types/bestBall";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
} from "@/components/settings";

export default function BestBallSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<BestBallGame | null>(null);
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
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (data) {
        const typedGame: BestBallGame = {
          ...data,
          game_type: (data.game_type as BestBallGameType) || 'match',
          team_a_players: data.team_a_players as unknown as BestBallPlayer[],
          team_b_players: data.team_b_players as unknown as BestBallPlayer[],
          winner_team: data.winner_team as 'A' | 'B' | 'TIE' | null,
        };
        setGame(typedGame);
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("best_ball_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const winner = game.team_a_total > game.team_b_total ? "A" : 
                     game.team_b_total > game.team_a_total ? "B" : "TIE";
      
      await supabase
        .from("best_ball_games")
        .update({ is_finished: true, winner_team: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/best-ball/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("best_ball_holes").delete().eq("game_id", gameId);
      await supabase.from("best_ball_games").delete().eq("id", gameId);
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
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} />}
      </div>
    );
  }

  const players: GamePlayer[] = [
    ...game.team_a_players.map(p => ({
      name: p.displayName,
      handicap: game.use_handicaps ? (p as any).playingHandicap ?? (p as any).handicap : undefined,
      tee: (p as any).teeColor,
      team: game.team_a_name,
    })),
    ...game.team_b_players.map(p => ({
      name: p.displayName,
      handicap: game.use_handicaps ? (p as any).playingHandicap ?? (p as any).handicap : undefined,
      tee: (p as any).teeColor,
      team: game.team_b_name,
    })),
  ];

  const allTees = [...game.team_a_players, ...game.team_b_players]
    .map(p => (p as any).teeColor)
    .filter(Boolean);
  const uniqueTees = [...new Set(allTees)];
  const teeInfo = uniqueTees.length === 0 ? "Not specified" :
                  uniqueTees.length === 1 ? uniqueTees[0]! : "Mixed tees";

  const gameDetails: GameDetailsData = {
    format: `Best Ball ${game.game_type === 'match' ? 'Match Play' : 'Stroke Play'}`,
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: game.use_handicaps ? "Net scoring (handicaps enabled)" : "Gross scoring",
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
          onSaveAndExit={() => navigate(`/best-ball/${gameId}/summary`)}
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
        gameName="Best Ball Game"
      />

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
