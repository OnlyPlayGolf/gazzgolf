import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BestBallGame, BestBallHole, BestBallPlayer, BestBallPlayerScore, BestBallGameType } from "@/types/bestBall";
import { BestBallCompletionDialog } from "@/components/BestBallCompletionDialog";
import { BestBallStrokePlayCompletionDialog } from "@/components/BestBallStrokePlayCompletionDialog";

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

export default function BestBallSummary() {
  const { gameId } = useParams();
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [holes, setHoles] = useState<BestBallHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  const fetchData = async () => {
    try {
      const { data: gameData } = await supabase
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        // Safely parse player arrays with fallback to empty array
        const parsePlayerArray = (data: unknown): BestBallPlayer[] => {
          if (!data || !Array.isArray(data)) return [];
          return data.map((p: any) => ({
            odId: p?.odId || p?.id || '',
            displayName: p?.displayName || 'Unknown',
            handicap: p?.handicap,
            teeColor: p?.teeColor,
            isTemporary: p?.isTemporary || false,
          }));
        };

        const typedGame: BestBallGame = {
          ...gameData,
          game_type: (gameData.game_type as BestBallGameType) || 'match',
          team_a_players: parsePlayerArray(gameData.team_a_players),
          team_b_players: parsePlayerArray(gameData.team_b_players),
          winner_team: gameData.winner_team as 'A' | 'B' | 'TIE' | null,
        };
        setGame(typedGame);

        // Fetch course holes if course_id exists
        if (gameData.course_id) {
          const { data: courseHolesData } = await supabase
            .from("course_holes")
            .select("hole_number, par, stroke_index")
            .eq("course_id", gameData.course_id)
            .order("hole_number");

          if (courseHolesData) {
            const filteredHoles = gameData.holes_played === 9 
              ? courseHolesData.slice(0, 9) 
              : courseHolesData;
            setCourseHoles(filteredHoles);
          }
        }
      }

      const { data: holesData } = await supabase
        .from("best_ball_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: BestBallHole[] = holesData.map(h => ({
          ...h,
          team_a_scores: h.team_a_scores as unknown as BestBallPlayerScore[],
          team_b_scores: h.team_b_scores as unknown as BestBallPlayerScore[],
        }));
        setHoles(typedHoles);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!game || !gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
      </div>
    );
  }

  const isMatchPlay = game.game_type === 'match';

  // For match play, use the match play completion dialog
  if (isMatchPlay) {
    return (
      <div className="min-h-screen bg-background">
        <BestBallCompletionDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          game={game}
          holes={holes}
          courseHoles={courseHoles}
          gameId={gameId}
        />
      </div>
    );
  }

  // For stroke play, use the new stroke play completion dialog with scorecard
  return (
    <div className="min-h-screen bg-background">
      <BestBallStrokePlayCompletionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        game={game}
        holes={holes}
        courseHoles={courseHoles}
        gameId={gameId}
      />
    </div>
  );
}
