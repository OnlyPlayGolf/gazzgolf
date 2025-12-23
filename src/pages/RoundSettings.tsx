import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

  useEffect(() => {
    if (roundId) {
      fetchRound();
      fetchProgress();
    }
  }, [roundId]);

  const fetchRound = async () => {
    try {
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

      {roundId && <RoundBottomTabBar roundId={roundId} />}
    </div>
  );
}
