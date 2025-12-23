import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";

interface RoundPlayer {
  id: string;
  user_id: string;
  tee_color: string | null;
  profiles: {
    display_name: string | null;
    username: string | null;
  } | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
}

interface SkinResult {
  holeNumber: number;
  winnerId: string | null;
  skinsWon: number;
  isCarryover: boolean;
}

export default function SimpleSkinsLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [skinResults, setSkinResults] = useState<SkinResult[]>([]);

  useEffect(() => {
    fetchData();
  }, [roundId]);

  useEffect(() => {
    if (players.length > 0 && courseHoles.length > 0) {
      calculateSkinResults();
    }
  }, [scores, courseHoles, players]);

  const fetchData = async () => {
    try {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (!roundData) return;

      const { data: playersData } = await supabase
        .from("round_players")
        .select("id, user_id, tee_color")
        .eq("round_id", roundId);

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

      const { data: courseData } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .maybeSingle();

      let holesArray: CourseHole[] = [];
      if (courseData) {
        const { data: holesData } = await supabase
          .from("course_holes")
          .select("hole_number, par")
          .eq("course_id", courseData.id)
          .order("hole_number");
        
        if (holesData) {
          holesArray = holesData.slice(0, roundData.holes_played);
        }
      }
      
      if (holesArray.length === 0) {
        const defaultPar = [4, 4, 3, 5, 4, 4, 3, 4, 5];
        holesArray = Array.from({ length: roundData.holes_played }, (_, i) => ({
          hole_number: i + 1,
          par: i < 9 ? defaultPar[i] : defaultPar[i % 9],
        }));
      }
      setCourseHoles(holesArray);

      const { data: existingHoles } = await supabase
        .from("holes")
        .select("hole_number, score, player_id")
        .eq("round_id", roundId);

      if (existingHoles) {
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
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSkinResults = () => {
    const results: SkinResult[] = [];
    let carryover = 0;
    
    for (const hole of courseHoles) {
      const holeScores: { playerId: string; score: number }[] = [];
      
      for (const player of players) {
        const playerScoreMap = scores.get(player.id);
        const score = playerScoreMap?.get(hole.hole_number);
        if (score && score > 0) {
          holeScores.push({
            playerId: player.id,
            score
          });
        }
      }
      
      if (holeScores.length < players.length || players.length === 0) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          skinsWon: 0,
          isCarryover: false
        });
        continue;
      }
      
      const lowestScore = Math.min(...holeScores.map(s => s.score));
      const playersWithLowest = holeScores.filter(s => s.score === lowestScore);
      
      if (playersWithLowest.length === 1) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: playersWithLowest[0].playerId,
          skinsWon: 1 + carryover,
          isCarryover: false
        });
        carryover = 0;
      } else {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          skinsWon: 0,
          isCarryover: true
        });
        carryover += 1;
      }
    }
    
    setSkinResults(results);
  };

  const getPlayerName = (player: RoundPlayer) => {
    return player.profiles?.display_name || player.profiles?.username || "Player";
  };

  const getPlayerSkinCount = (playerId: string): number => {
    return skinResults
      .filter(r => r.winnerId === playerId)
      .reduce((sum, r) => sum + r.skinsWon, 0);
  };

  const getPlayerTotalScore = (playerId: string): number => {
    const playerScores = scores.get(playerId);
    if (!playerScores) return 0;
    let total = 0;
    playerScores.forEach(score => { total += score; });
    return total;
  };

  if (loading) return <div className="p-4">Loading...</div>;

  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b.id) - getPlayerSkinCount(a.id)
  );

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              Current Standings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedPlayers.map((player, index) => {
              const skinCount = getPlayerSkinCount(player.id);
              const totalScore = getPlayerTotalScore(player.id);
              
              return (
                <div 
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 && skinCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${index === 0 && skinCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{getPlayerName(player)}</p>
                      <p className="text-sm text-muted-foreground">Total: {totalScore || '–'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-600">
                      <Trophy size={16} />
                      <span className="text-xl font-bold">{skinCount}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">skin{skinCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {roundId && <SimpleSkinsBottomTabBar roundId={roundId} />}
    </div>
  );
}
