import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Round {
  id: string;
  course_name: string;
  tee_set: string;
  holes_played: number;
  date_played: string;
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
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");

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
        setCurrentPlayerId(playersWithProfiles[0].id);
      }

      // Fetch course holes
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .single();

      if (courseError) throw courseError;

      const { data: holesData, error: holesError } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseData.id)
        .order("hole_number");

      if (holesError) throw holesError;
      
      // Filter holes based on holes_played
      let filteredHoles = holesData;
      if (roundData.holes_played === 9) {
        filteredHoles = holesData.slice(0, 9);
      }
      
      setCourseHoles(filteredHoles);

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
  const playerScores = scores.get(currentPlayerId) || new Map();
  const currentScore = playerScores.get(currentHole?.hole_number) || 0;

  const updateScore = async (newScore: number) => {
    if (!currentHole || newScore < 0 || !currentPlayerId) return;

    const updatedScores = new Map(scores);
    const playerScores = updatedScores.get(currentPlayerId) || new Map();
    playerScores.set(currentHole.hole_number, newScore);
    updatedScores.set(currentPlayerId, playerScores);
    setScores(updatedScores);

    try {
      const { error } = await supabase
        .from("holes")
        .upsert({
          round_id: roundId,
          player_id: currentPlayerId,
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
              onClick={() => navigate("/rounds")}
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
      <div className="max-w-2xl mx-auto p-4">
        <Tabs value={currentPlayerId} onValueChange={setCurrentPlayerId}>
          <TabsList className="w-full">
            {players.map((player) => (
              <TabsTrigger key={player.id} value={player.id} className="flex-1">
                {getPlayerName(player)}
              </TabsTrigger>
            ))}
          </TabsList>

          {players.map((player) => (
            <TabsContent key={player.id} value={player.id}>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-2xl font-bold mb-1">{getPlayerName(player)}</div>
                    <div className="text-muted-foreground">Tee: {player.tee_color || round.tee_set}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-muted-foreground">{getScoreDisplay(player.id)}</div>
                      <div className="text-xs text-muted-foreground">To Par</div>
                    </div>
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground">
                      <div className="text-3xl font-bold">{currentScore || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 rounded-full"
                    onClick={() => updateScore(Math.max(0, currentScore - 1))}
                    disabled={currentScore === 0}
                  >
                    <Minus size={24} />
                  </Button>
                  
                  <div className="text-center min-w-[100px]">
                    <div className="text-4xl font-bold mb-1">{currentScore || "-"}</div>
                    <div className="text-sm text-muted-foreground">Strokes</div>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 rounded-full"
                    onClick={() => updateScore(currentScore + 1)}
                  >
                    <Plus size={24} />
                  </Button>
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Hole Navigation */}
      <div className="fixed bottom-16 left-0 right-0 bg-muted/50 backdrop-blur-sm border-t border-border py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
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
      </div>

      <RoundBottomTabBar roundId={roundId!} />
    </div>
  );
}
