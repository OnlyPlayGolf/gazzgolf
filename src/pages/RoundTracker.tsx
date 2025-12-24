import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerScoreSheet } from "@/components/play/PlayerScoreSheet";
import { RoundCompletionDialog } from "@/components/RoundCompletionDialog";
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
  round_name?: string | null;
  origin?: string | null;
}

// Track original planned holes vs actual holes played
interface RoundState {
  plannedHoles: number;
  currentTotalHoles: number;
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
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RoundPlayer | null>(null);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [roundState, setRoundState] = useState<RoundState>({ plannedHoles: 18, currentTotalHoles: 18 });

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
      
      // Track planned holes from round data
      const plannedHoles = roundData.holes_played || 18;
      setRoundState({ 
        plannedHoles, 
        currentTotalHoles: holesArray.length 
      });
      
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

  const getPlayerScore = (playerId: string): number | null => {
    const playerScores = scores.get(playerId) || new Map();
    const score = playerScores.get(currentHole?.hole_number);
    return score !== undefined ? score : null;
  };

  const hasPlayerEnteredScore = (playerId: string): boolean => {
    const playerScores = scores.get(playerId) || new Map();
    return playerScores.has(currentHole?.hole_number);
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
          onConflict: 'round_id,player_id,hole_number',
          ignoreDuplicates: false
        });

      if (error) {
        console.error("Upsert error:", error);
        throw error;
      }
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

  // Check if we've reached the end of planned holes
  const isAtLastPlannedHole = currentHoleIndex === roundState.plannedHoles - 1;
  const isAtLastCurrentHole = currentHoleIndex === courseHoles.length - 1;
  const isExtraHoles = courseHoles.length > roundState.plannedHoles;

  const handleShowCompletionDialog = () => {
    setShowCompletionDialog(true);
  };

  const handleFinishRound = () => {
    setShowCompletionDialog(false);
    // Navigate to round summary to show results and share option
    navigate(`/rounds/${roundId}/summary`);
  };

  const handleContinuePlaying = async () => {
    setShowCompletionDialog(false);
    
    // Add one more hole to the round
    const nextHoleNumber = courseHoles.length + 1;
    const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
    
    const newHole: CourseHole = {
      hole_number: nextHoleNumber,
      par: defaultPar[(nextHoleNumber - 1) % 9],
      stroke_index: nextHoleNumber,
    };
    
    setCourseHoles([...courseHoles, newHole]);
    setRoundState(prev => ({ ...prev, currentTotalHoles: prev.currentTotalHoles + 1 }));
    
    // Move to the new hole
    setCurrentHoleIndex(courseHoles.length);
    
    // Update the round's holes_played count in the database
    try {
      await supabase
        .from("rounds")
        .update({ holes_played: nextHoleNumber })
        .eq("id", roundId);
    } catch (error) {
      console.error("Error updating holes_played:", error);
    }
    
    toast({
      title: "Extra hole added",
      description: `Hole ${nextHoleNumber} added to your round`,
    });
  };

  const handleGoBack = () => {
    setShowCompletionDialog(false);
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
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading round...</div>
        {roundId && <RoundBottomTabBar roundId={roundId} />}
      </div>
    );
  }

  if (!round || !currentHole) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Round not found</div>
        {roundId && <RoundBottomTabBar roundId={roundId} />}
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
              <h1 className="text-xl font-bold">{round.round_name || `Round ${round.date_played}`}</h1>
              <p className="text-sm text-muted-foreground">{round.course_name}</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Hole Navigation Bar */}
        <div className="bg-[hsl(120,20%,85%)] py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("prev")}
              disabled={currentHoleIndex === 0}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronLeft size={24} />
            </Button>

            <div className="text-center">
              <div className="text-sm text-[hsl(120,20%,40%)]">PAR {currentHole.par}</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold text-[hsl(120,20%,25%)]">Hole {currentHole.hole_number}</span>
                {currentHole.hole_number > roundState.plannedHoles && (
                  <Badge variant="secondary" className="text-xs bg-[hsl(120,20%,80%)] text-[hsl(120,20%,30%)]">
                    Extra
                  </Badge>
                )}
              </div>
              <div className="text-sm text-[hsl(120,20%,40%)]">HCP {currentHole.stroke_index}</div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateHole("next")}
              disabled={currentHoleIndex === courseHoles.length - 1}
              className="text-[hsl(120,20%,30%)] hover:bg-[hsl(120,20%,80%)]"
            >
              <ChevronRight size={24} />
            </Button>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {players.map((player) => {
          const playerScore = getPlayerScore(player.id);
          const hasScore = hasPlayerEnteredScore(player.id);
          return (
            <Card 
              key={player.id} 
              className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setSelectedPlayer(player);
                setShowScoreSheet(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold mb-1">{getPlayerName(player)}</div>
                  <div className="text-sm text-muted-foreground">
                    Tee: {player.tee_color || round.tee_set}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{hasScore ? playerScore : 0}</div>
                    <div className="text-xs text-muted-foreground">Strokes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{getScoreDisplay(player.id)}</div>
                    <div className="text-xs text-muted-foreground">To Par</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        
        {/* Show completion button when at the last planned hole or beyond */}
        {isAtLastCurrentHole && (
          <Button
            onClick={handleShowCompletionDialog}
            className="w-full bg-[hsl(120,20%,35%)] hover:bg-[hsl(120,20%,30%)] text-white"
            size="lg"
          >
            <Check size={20} className="mr-2" />
            {isExtraHoles ? "Finish Extra Holes" : "Complete Round"}
          </Button>
        )}
      </div>

      {/* Round Completion Dialog */}
      <RoundCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        holesPlayed={courseHoles.length}
        plannedHoles={roundState.plannedHoles}
        onFinishRound={handleFinishRound}
        onContinuePlaying={handleContinuePlaying}
        onGoBack={handleGoBack}
      />

      {/* Score Input Sheet */}
      {selectedPlayer && currentHole && (
        <PlayerScoreSheet
          open={showScoreSheet}
          onOpenChange={setShowScoreSheet}
          playerName={getPlayerName(selectedPlayer)}
          par={currentHole.par}
          holeNumber={currentHole.hole_number}
          currentScore={getPlayerScore(selectedPlayer.id)}
          onScoreSelect={(score) => {
            if (score !== null) {
              updateScore(selectedPlayer.id, score);
            }
          }}
          onEnterAndNext={() => {
            const currentPlayerIndex = players.findIndex(p => p.id === selectedPlayer.id);
            if (currentPlayerIndex < players.length - 1) {
              // Move to next player
              setSelectedPlayer(players[currentPlayerIndex + 1]);
            } else {
              // Last player on this hole
              setShowScoreSheet(false);
              
              // Check if we're at the last hole (planned or extended)
              if (currentHoleIndex >= courseHoles.length - 1) {
                // Show completion dialog when all players finished the last hole
                setShowCompletionDialog(true);
              } else {
                // Move to next hole
                setCurrentHoleIndex(currentHoleIndex + 1);
              }
            }
          }}
        />
      )}

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
