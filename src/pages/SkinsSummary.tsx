import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Trophy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { GameHeader } from "@/components/GameHeader";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { SkinsShareDialogWithScorecard } from "@/components/SkinsShareDialogWithScorecard";

interface SkinsGame {
  id: string;
  course_name: string;
  date_played: string;
  holes_played: number;
  round_name: string | null;
  user_id: string;
  is_finished: boolean;
  skin_value: number;
  carryover_enabled: boolean;
  use_handicaps: boolean;
  players: any;
  course_id: string | null;
}

interface SkinsHole {
  id: string;
  game_id: string;
  hole_number: number;
  par: number;
  player_scores: Record<string, number>;
  winner_player: string | null;
  skins_available: number;
  is_carryover: boolean;
}

interface SkinsPlayer {
  id?: string;
  odId?: string;
  name: string;
  displayName?: string;
  handicap?: number | null;
  tee?: string | null;
  avatarUrl?: string | null;
}

interface CourseHole {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface SkinResult {
  holeNumber: number;
  winnerId: string | null;
  winnerName: string | null;
  skinsWon: number;
  isCarryover: boolean;
}

export default function SkinsSummary() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isEditWindowExpired } = useIsSpectator('skins', roundId);
  const [game, setGame] = useState<SkinsGame | null>(null);
  const [players, setPlayers] = useState<SkinsPlayer[]>([]);
  const [holes, setHoles] = useState<SkinsHole[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [skinResults, setSkinResults] = useState<SkinResult[]>([]);

  useEffect(() => {
    fetchData();
  }, [roundId]);

  useEffect(() => {
    if (players.length > 0 && holes.length > 0) {
      calculateSkinResults();
    }
  }, [holes, players]);

  const fetchData = async () => {
    try {
      // Fetch from skins_games table
      const { data: gameData, error: gameError } = await supabase
        .from("skins_games")
        .select("*")
        .eq("id", roundId)
        .maybeSingle();

      if (gameError) throw gameError;
      if (!gameData) {
        setLoading(false);
        return;
      }

      setGame(gameData);

      // Parse players from JSON
      const rawPlayers = gameData.players;
      const parsedPlayers: SkinsPlayer[] = Array.isArray(rawPlayers) 
        ? rawPlayers.map((p: any) => ({
            id: p.id,
            odId: p.odId,
            name: p.name || 'Player',
            displayName: p.displayName,
            handicap: p.handicap,
            tee: p.tee,
            avatarUrl: p.avatarUrl,
          }))
        : [];
      setPlayers(parsedPlayers);

      // Fetch holes from skins_holes table
      const { data: holesData } = await supabase
        .from("skins_holes")
        .select("*")
        .eq("game_id", roundId)
        .order("hole_number");

      if (holesData) {
        const typedHoles: SkinsHole[] = holesData.map(h => ({
          ...h,
          player_scores: (h.player_scores as Record<string, number>) || {},
        }));
        setHoles(typedHoles);
      }

      // Fetch course holes if course_id exists
      if (gameData.course_id) {
        const { data: courseHolesData } = await supabase
          .from("course_holes")
          .select("hole_number, par, stroke_index")
          .eq("course_id", gameData.course_id)
          .order("hole_number");
        
        if (courseHolesData) {
          setCourseHoles(courseHolesData);
        }
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
    
    for (const hole of holes) {
      const winnerPlayerId = hole.winner_player;
      let winnerName: string | null = null;
      
      if (winnerPlayerId) {
        const winner = players.find(p => 
          p.id === winnerPlayerId || 
          p.odId === winnerPlayerId || 
          p.name === winnerPlayerId
        );
        winnerName = winner?.displayName || winner?.name || winnerPlayerId;
      }
      
      results.push({
        holeNumber: hole.hole_number,
        winnerId: winnerPlayerId,
        winnerName: winnerName,
        skinsWon: hole.winner_player ? hole.skins_available : 0,
        isCarryover: hole.is_carryover,
      });
    }
    
    setSkinResults(results);
  };

  const getPlayerName = (player: SkinsPlayer) => {
    return player.displayName || player.name || "Player";
  };

  const getPlayerId = (player: SkinsPlayer) => {
    return player.odId || player.id || player.name;
  };

  const getPlayerSkinCount = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    return skinResults
      .filter(r => r.winnerId === playerId)
      .reduce((sum, r) => sum + r.skinsWon, 0);
  };

  const getPlayerTotalScore = (player: SkinsPlayer): number => {
    const playerId = getPlayerId(player);
    let total = 0;
    for (const hole of holes) {
      const score = hole.player_scores[playerId];
      if (score && score > 0) {
        total += score;
      }
    }
    return total;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {roundId && <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {roundId && <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />}
      </div>
    );
  }

  // Sort players by skin count (descending)
  const sortedPlayers = [...players].sort((a, b) => 
    getPlayerSkinCount(b) - getPlayerSkinCount(a)
  );

  const winner = sortedPlayers[0];
  const winnerSkins = winner ? getPlayerSkinCount(winner) : 0;

  return (
    <div className="pb-24 min-h-screen bg-background">
      <GameHeader
        gameTitle={game.round_name || "Skins"}
        courseName={game.course_name}
        pageTitle="Summary"
      />

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Header Card */}
        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-amber-600" />
                  <CardTitle className="truncate">{game.course_name}</CardTitle>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={14} />
                  <span>{format(new Date(game.date_played), "MMMM d, yyyy")}</span>
                  <span>•</span>
                  <span>{game.holes_played} holes</span>
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
              const skinCount = getPlayerSkinCount(player);
              const totalScore = getPlayerTotalScore(player);
              
              return (
                <div 
                  key={getPlayerId(player)}
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
              {skinResults.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No holes played yet</p>
              )}
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
            onClick={() => navigate("/")} 
            className="flex-1 bg-amber-600 hover:bg-amber-700" 
            size="lg"
          >
            Done
          </Button>
        </div>
      </div>

      <SkinsBottomTabBar roundId={roundId!} isSpectator={isSpectator} isEditWindowExpired={isEditWindowExpired} />

      <SkinsShareDialogWithScorecard
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        game={game}
        holes={holes}
        players={players}
        courseHoles={courseHoles}
        onContinue={() => navigate("/")}
      />
    </div>
  );
}
