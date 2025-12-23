import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Trophy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RoundShareDialog } from "@/components/RoundShareDialog";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";

interface Round {
  id: string;
  course_name: string;
  date_played: string;
  tee_set: string;
  holes_played: number;
  round_name?: string | null;
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

interface CourseHole {
  hole_number: number;
  par: number;
}

interface SkinResult {
  holeNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  skinsWon: number;
  isCarryover: boolean;
}

export default function SimpleSkinsSummary() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<RoundPlayer[]>([]);
  const [scores, setScores] = useState<Map<string, Map<number, number>>>(new Map());
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
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
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

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
    } catch (error: any) {
      toast({
        title: "Error loading summary",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSkinResults = () => {
    const results: SkinResult[] = [];
    let carryover = 0;
    
    for (const hole of courseHoles) {
      const holeScores: { playerId: string; playerName: string; score: number }[] = [];
      
      for (const player of players) {
        const playerScoreMap = scores.get(player.id);
        const score = playerScoreMap?.get(hole.hole_number);
        if (score && score > 0) {
          holeScores.push({
            playerId: player.id,
            playerName: getPlayerName(player),
            score
          });
        }
      }
      
      if (holeScores.length < players.length || players.length === 0) {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          winnerName: null,
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
          winnerName: playersWithLowest[0].playerName,
          skinsWon: 1 + carryover,
          isCarryover: false
        });
        carryover = 0;
      } else {
        results.push({
          holeNumber: hole.hole_number,
          winnerId: null,
          winnerName: null,
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
  if (!round) return <div className="p-4">Round not found</div>;

  // Sort players by skin count (descending)
  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b.id) - getPlayerSkinCount(a.id)
  );

  const winner = sortedPlayers[0];
  const winnerSkins = getPlayerSkinCount(winner?.id || '');

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/rounds")}>
          <ArrowLeft className="mr-2" size={20} />
          Back to Rounds
        </Button>

        {/* Header Card */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-amber-600" />
                  <CardTitle>{round.course_name}</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={14} />
                  <span>{format(new Date(round.date_played), "MMMM d, yyyy")}</span>
                  <span>•</span>
                  <span>{round.holes_played} holes</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground">Winner</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {winner ? getPlayerName(winner) : 'N/A'}
                </p>
                <p className="text-sm text-amber-600">{winnerSkins} skin{winnerSkins !== 1 ? 's' : ''} won</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Final Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedPlayers.map((player, index) => {
              const skinCount = getPlayerSkinCount(player.id);
              const totalScore = getPlayerTotalScore(player.id);
              
              return (
                <div 
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${index === 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{getPlayerName(player)}</p>
                      <p className="text-sm text-muted-foreground">Total: {totalScore}</p>
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

        {/* Hole by Hole Results */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hole by Hole</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {skinResults.map(result => (
                <div 
                  key={result.holeNumber}
                  className={`flex items-center justify-between p-2 rounded ${
                    result.winnerId ? 'bg-green-50 dark:bg-green-900/20' : 
                    result.isCarryover ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-muted/30'
                  }`}
                >
                  <span className="font-medium">Hole {result.holeNumber}</span>
                  <span className={`text-sm ${result.winnerId ? 'text-green-600' : 'text-amber-600'}`}>
                    {result.winnerId ? `${result.winnerName} (${result.skinsWon} skin${result.skinsWon > 1 ? 's' : ''})` : 
                     result.isCarryover ? 'Carryover' : '–'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button 
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="mr-2" size={18} />
            Share
          </Button>
          
          <Button 
            onClick={() => navigate("/rounds")} 
            className="flex-1 bg-amber-600 hover:bg-amber-700" 
            size="lg"
          >
            Done
          </Button>
        </div>
      </div>

      <SimpleSkinsBottomTabBar roundId={roundId!} />

      <RoundShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        roundName={round.round_name || 'Simple Skins'}
        courseName={round.course_name}
        score={winnerSkins}
        scoreVsPar={0}
        holesPlayed={round.holes_played}
        roundId={roundId}
        onContinue={() => navigate("/rounds")}
      />
    </div>
  );
}
