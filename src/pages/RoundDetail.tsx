import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronUp, Users, MapPin, Calendar, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TopNavBar } from "@/components/TopNavBar";

interface RoundData {
  id: string;
  course_name: string;
  round_name: string | null;
  date_played: string;
  holes_played: number;
  tee_set: string | null;
  origin: string | null;
}

interface PlayerData {
  id: string;
  user_id: string;
  handicap: number | null;
  tee_color: string | null;
  display_name: string | null;
  username: string | null;
}

interface HoleScore {
  hole_number: number;
  score: number;
  par: number;
}

interface PlayerWithScores extends PlayerData {
  scores: HoleScore[];
  totalScore: number;
  totalPar: number;
  scoreToPar: number;
}

export default function RoundDetail() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState<RoundData | null>(null);
  const [players, setPlayers] = useState<PlayerWithScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

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

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select("id, user_id, handicap, tee_color")
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Fetch profile info for each player
      const playerIds = playersData?.map(p => p.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", playerIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Fetch all holes for this round
      const { data: holesData } = await supabase
        .from("holes")
        .select("player_id, hole_number, score, par")
        .eq("round_id", roundId)
        .order("hole_number");

      // Build player data with scores
      const playersWithScores: PlayerWithScores[] = (playersData || []).map(player => {
        const profile = profilesMap.get(player.user_id);
        const playerHoles = holesData?.filter(h => h.player_id === player.id) || [];
        const totalScore = playerHoles.reduce((sum, h) => sum + (h.score || 0), 0);
        const totalPar = playerHoles.reduce((sum, h) => sum + (h.par || 0), 0);

        return {
          ...player,
          display_name: profile?.display_name || null,
          username: profile?.username || null,
          scores: playerHoles.map(h => ({
            hole_number: h.hole_number,
            score: h.score,
            par: h.par
          })),
          totalScore,
          totalPar,
          scoreToPar: totalScore - totalPar
        };
      });

      // Sort by score to par
      playersWithScores.sort((a, b) => a.scoreToPar - b.scoreToPar);
      setPlayers(playersWithScores);

    } catch (error) {
      console.error("Error fetching round data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatScoreToPar = (score: number) => {
    if (score === 0) return "E";
    return score > 0 ? `+${score}` : `${score}`;
  };

  const getPlayerName = (player: PlayerWithScores) => {
    return player.display_name || player.username || "Player";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreClass = (score: number, par: number) => {
    const diff = score - par;
    if (diff <= -2) return "bg-amber-400 text-amber-900"; // Eagle or better
    if (diff === -1) return "bg-red-500 text-white"; // Birdie
    if (diff === 0) return "bg-secondary text-secondary-foreground"; // Par
    if (diff === 1) return "bg-blue-500 text-white"; // Bogey
    return "bg-blue-700 text-white"; // Double bogey+
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex items-center justify-center pt-32">
          <div className="text-muted-foreground">Loading round...</div>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavBar />
        <div className="flex items-center justify-center pt-32">
          <div className="text-muted-foreground">Round not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      
      {/* Header */}
      <div className="bg-card border-b border-border pt-16">
        <div className="p-4 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 -ml-2"
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </Button>
          
          <h1 className="text-2xl font-bold mb-1">
            {round.round_name || "Round"}
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {round.course_name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(round.date_played)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} />
              {players.length} player{players.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto p-4">
        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="settings">Game Settings</TabsTrigger>
            <TabsTrigger value="info">Game Info</TabsTrigger>
          </TabsList>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-2">
            {players.length > 0 ? (
              players.map((player, index) => (
                <Collapsible
                  key={player.id}
                  open={expandedPlayerId === player.id}
                  onOpenChange={(open) => setExpandedPlayerId(open ? player.id : null)}
                >
                  <Card className="overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-left">
                        <CardContent className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-amber-500 text-white' : 
                              index === 1 ? 'bg-gray-400 text-white' : 
                              index === 2 ? 'bg-amber-700 text-white' : 
                              'bg-muted text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold">{getPlayerName(player)}</div>
                              <div className="text-xs text-muted-foreground">
                                {player.scores.length} holes • {player.tee_color || round.tee_set || 'White'} tees
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {formatScoreToPar(player.scoreToPar)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {player.totalScore} strokes
                              </div>
                            </div>
                            {expandedPlayerId === player.id ? (
                              <ChevronUp size={20} className="text-muted-foreground" />
                            ) : (
                              <ChevronDown size={20} className="text-muted-foreground" />
                            )}
                          </div>
                        </CardContent>
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t border-border bg-muted/30 p-4">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">SCORECARD</div>
                        
                        {/* Front 9 */}
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground mb-1">Front 9</div>
                          <div className="grid grid-cols-10 gap-1 text-center text-xs">
                            {[1,2,3,4,5,6,7,8,9].map(hole => {
                              const holeData = player.scores.find(s => s.hole_number === hole);
                              return (
                                <div key={hole} className="flex flex-col">
                                  <div className="text-muted-foreground">{hole}</div>
                                  <div className={`rounded py-1 ${holeData ? getScoreClass(holeData.score, holeData.par) : 'bg-muted'}`}>
                                    {holeData?.score || '-'}
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex flex-col">
                              <div className="text-muted-foreground font-semibold">OUT</div>
                              <div className="bg-secondary rounded py-1 font-semibold">
                                {player.scores.filter(s => s.hole_number <= 9).reduce((sum, s) => sum + s.score, 0) || '-'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back 9 */}
                        {round.holes_played > 9 && (
                          <div className="mb-3">
                            <div className="text-xs text-muted-foreground mb-1">Back 9</div>
                            <div className="grid grid-cols-10 gap-1 text-center text-xs">
                              {[10,11,12,13,14,15,16,17,18].map(hole => {
                                const holeData = player.scores.find(s => s.hole_number === hole);
                                return (
                                  <div key={hole} className="flex flex-col">
                                    <div className="text-muted-foreground">{hole}</div>
                                    <div className={`rounded py-1 ${holeData ? getScoreClass(holeData.score, holeData.par) : 'bg-muted'}`}>
                                      {holeData?.score || '-'}
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="flex flex-col">
                                <div className="text-muted-foreground font-semibold">IN</div>
                                <div className="bg-secondary rounded py-1 font-semibold">
                                  {player.scores.filter(s => s.hole_number > 9).reduce((sum, s) => sum + s.score, 0) || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Total */}
                        <div className="flex justify-end gap-4 pt-2 border-t border-border">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Total:</span>{' '}
                            <span className="font-bold">{player.totalScore}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">To Par:</span>{' '}
                            <span className="font-bold">{formatScoreToPar(player.scoreToPar)}</span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No players found for this round
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Game Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Game Format</div>
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-primary" />
                    <span className="font-medium">Stroke Play</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Course</div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-primary" />
                    <span className="font-medium">{round.course_name}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Holes Played</div>
                  <span className="font-medium">{round.holes_played} holes</span>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Tees</div>
                  <span className="font-medium capitalize">{round.tee_set || 'White'} tees</span>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Players ({players.length})</div>
                  <div className="space-y-2">
                    {players.map(player => (
                      <div key={player.id} className="flex items-center justify-between text-sm">
                        <span>{getPlayerName(player)}</span>
                        <span className="text-muted-foreground">
                          {player.handicap !== null ? `HCP ${player.handicap}` : 'No HCP'}
                          {player.tee_color && ` • ${player.tee_color}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Scoring</div>
                  <span className="font-medium">Gross scoring</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Game Info Tab */}
          <TabsContent value="info">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">Stroke Play</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stroke play is the most common format in golf. Each player counts every stroke taken during the round, and the player with the lowest total score wins.
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-2">How It Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Each stroke counts toward your total score</li>
                    <li>• Complete all holes in the round</li>
                    <li>• The player with the lowest total score wins</li>
                    <li>• Score is often measured relative to par (course standard)</li>
                  </ul>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-2">Scoring Terms</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-400"></div>
                      <span>Eagle (-2)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500"></div>
                      <span>Birdie (-1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-secondary"></div>
                      <span>Par (E)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500"></div>
                      <span>Bogey (+1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-700"></div>
                      <span>Double Bogey+ (+2)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
