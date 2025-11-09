import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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


interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
  origin?: string | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
  [key: string]: any;
}

interface HoleScore {
  hole_number: number;
  score: number;
  par: number;
  stroke_index: number;
}

interface RoundPlayer {
  id: string;
  user_id: string;
  tee_color: string | null;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
}

export default function RoundTracker() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [round, setRound] = useState<Round | null>(null);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    if (roundId) {
      fetchRoundData();
    }
  }, [roundId]);

  const fetchRoundData = async () => {
    try {
      // Fetch round details
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch players in the round
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color")
        .eq("round_id", roundId);

      if (playersError) throw playersError;
      
      // Fetch profile data for each player
      if (playersData && playersData.length > 0) {
        const userIds = playersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const playersWithProfiles = playersData.map(player => ({
          ...player,
          profiles: profilesMap.get(player.user_id) || null
        }));
        
        setPlayers(playersWithProfiles);
      }

      // Fetch course holes if course exists in database
      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .maybeSingle();

      let holesArray: CourseHole[] = [];
      
      if (courseData) {
        const { data: holesData, error: holesError } = await supabase
          .from("course_holes")
          .select("*")
          .eq("course_id", courseData.id)
          .order("hole_number");

        if (!holesError && holesData) {
          // Filter holes based on holes_played
          let filteredHoles = holesData;
          if (roundData.holes_played === 9) {
            filteredHoles = holesData.slice(0, 9);
          }
          
          holesArray = filteredHoles;
        }
      }
      
      // If no course data found, create default holes
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5]; // Default 9-hole pars
        const numHoles = roundData.holes_played || 18;
        
        holesArray = Array.from({ length: numHoles }, (_, i) => ({
          hole_number: i + 1,
          par: i < 9 ? defaultPar[i] : defaultPar[i % 9],
          stroke_index: i + 1,
        }));
      }
      
      setCourseHoles(holesArray);

      // Fetch existing hole scores for all players
      const { data: existingHoles, error: existingError } = await supabase
        .from("holes")
        .select("hole_number, score, player_id")
        .eq("round_id", roundId);

      if (!existingError && existingHoles) {
        const scoresMap = new Map<string, Map<number, number>>();
        existingHoles.forEach((hole) => {
          if (hole.player_id) {
            if (!scoresMap.has(hole.player_id)) {
              scoresMap.set(hole.player_id, new Map());
            }
            scoresMap.get(hole.player_id)!.set(hole.hole_number, hole.score);
          }
        });
        setScores(scoresMap);
      }
    } catch (error: any) {
      console.error("Error fetching round data:", error);
      toast({
        title: "Error loading round",
        description: error.message,
        variant: "destructive",
      });
      navigate("/rounds");
    } finally {
      setLoading(false);
    }
  };

  const currentHole = courseHoles[currentHoleIndex];

  const getPlayerScore = (playerId: string) => {
    const playerScores = scores.get(playerId) || new Map();
    return playerScores.get(currentHole?.hole_number) || currentHole?.par || 0;
  };

  const updateScore = async (playerId: string, newScore: number) => {
    if (!currentHole || newScore < 0) return;

    const updatedScores = new Map(scores);
    const playerScores = updatedScores.get(playerId) || new Map();
    playerScores.set(currentHole.hole_number, newScore);
    updatedScores.set(playerId, playerScores);
    setScores(updatedScores);

    try {
      const { error } = await supabase
        .from("holes")
        .upsert({
          round_id: roundId,
          player_id: playerId,
          hole_number: currentHole.hole_number,
          par: currentHole.par,
          score: newScore,
        }, {
          onConflict: 'round_id,player_id,hole_number'
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error saving score:", error);
      toast({
        title: "Error saving score",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const navigateHole = (direction: "prev" | "next") => {
    if (direction === "prev" && currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    } else if (direction === "next" && currentHoleIndex < courseHoles.length - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };

  const calculateScoreToPar = (playerId: string) => {
    let totalScore = 0;
    let totalPar = 0;
    const playerScores = scores.get(playerId) || new Map();
    
    courseHoles.forEach((hole) => {
      const score = playerScores.get(hole.hole_number) || 0;
      if (score > 0) {
        totalScore += score;
        totalPar += hole.par;
      }
    });

    return totalScore - totalPar;
  };

  const getScoreDisplay = (playerId: string) => {
    const diff = calculateScoreToPar(playerId);
    if (diff === 0) return "E";
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const getPlayerName = (player: RoundPlayer) => {
    return player.profiles?.display_name || player.profiles?.username || "Player";
  };

  const handleFinishRound = () => {
    // Navigate based on round origin
    if (round?.origin === 'play') {
      navigate('/played-rounds');
    } else {
      navigate('/rounds');
    }
  };

  const handleDeleteRound = async () => {
    try {
      // Delete all holes for this round
      const { error: holesError } = await supabase
        .from("holes")
        .delete()
        .eq("round_id", roundId);

      if (holesError) throw holesError;

      // Delete all round players
      const { error: playersError } = await supabase
        .from("round_players")
        .delete()
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Delete the round
      const { error: roundError } = await supabase
        .from("rounds")
        .delete()
        .eq("id", roundId);

      if (roundError) throw roundError;

      toast({
        title: "Round deleted",
        description: "The round has been deleted successfully.",
      });

      navigate("/");
    } catch (error: any) {
      console.error("Error deleting round:", error);
      toast({
        title: "Error deleting round",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading round...</div>
      </div>
    );
  }

  if (!round || !currentHole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Round not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitDialog(true)}
              className="rounded-full"
            >
              <ChevronLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Round {round.date_played}</h1>
              <p className="text-sm text-muted-foreground">{round.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Game Info Bar */}
        <div className="bg-primary text-primary-foreground py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">STROKE PLAY</div>
              <div className="text-sm opacity-90">NET</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{courseHoles.length}</div>
              <div className="text-xs opacity-90">Par {courseHoles.reduce((sum, h) => sum + h.par, 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{currentHole.hole_number}</div>
              <div className="text-xs opacity-90">Par {currentHole.par}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {players.map((player) => {
          const playerScore = getPlayerScore(player.id);
          return (
            <Card key={player.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xl font-bold mb-1">{getPlayerName(player)}</div>
                  <div className="text-sm text-muted-foreground">
                    Tee: {player.tee_color || round.tee_set}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{getScoreDisplay(player.id)}</div>
                  <div className="text-xs text-muted-foreground">To Par</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => updateScore(player.id, Math.max(1, playerScore - 1))}
                >
                  <Minus size={20} />
                </Button>
                
                <div className="text-center min-w-[80px]">
                  <div className="text-3xl font-bold mb-1">{playerScore}</div>
                  <div className="text-sm text-muted-foreground">Strokes</div>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={() => updateScore(player.id, playerScore + 1)}
                >
                  <Plus size={20} />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Hole Navigation */}
      <div className="fixed bottom-16 left-0 right-0 bg-muted/50 backdrop-blur-sm border-t border-border py-4">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-muted-foreground">PAR {currentHole.par}</div>
              <div className="text-2xl font-bold">Hole {currentHole.hole_number}</div>
              <div className="text-sm text-muted-foreground">HCP {currentHole.stroke_index}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHoleIndex === courseHoles.length - 1}
            >
              <ChevronRight size={24} />
            </Button>
          </div>
          
          {currentHoleIndex === courseHoles.length - 1 && (
            <Button
              onClick={handleFinishRound}
              className="w-full"
              size="lg"
            >
              <Check size={20} className="mr-2" />
              Finish Round
            </Button>
          )}
        </div>
      </div>

      <RoundBottomTabBar roundId={roundId!} />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Round</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this round?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                navigate("/");
              }}
              className="w-full"
            >
              Save and Exit
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setShowExitDialog(false);
                handleDeleteRound();
              }}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Round
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
