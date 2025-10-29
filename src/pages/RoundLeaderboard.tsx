import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ThumbsUp, MessageCircle, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
}

interface PlayerScore {
  player_id: string;
  player_name: string;
  handicap: number;
  holes: {
    hole_number: number;
    score: number | null;
    par: number;
    stroke_index: number;
  }[];
  total_score: number;
  total_par: number;
  score_to_par: number;
  thru: number;
}

export default function RoundLeaderboard() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<PlayerScore[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Fetch course information
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("name", roundData.course_name)
        .single();

      if (courseError) {
        console.error("Course not found:", courseError);
        setLoading(false);
        return;
      }

      // Fetch course holes
      const { data: courseHolesData, error: courseHolesError } = await supabase
        .from("course_holes")
        .select("*")
        .eq("course_id", courseData.id)
        .order("hole_number");

      if (courseHolesError) throw courseHolesError;

      // Fetch players and their scores
      const { data: playersData, error: playersError } = await supabase
        .from("round_players")
        .select(`
          id,
          user_id,
          handicap,
          profiles (
            display_name,
            username
          )
        `)
        .eq("round_id", roundId);

      if (playersError) throw playersError;

      // Fetch all scores for this round
      const { data: holesData, error: holesError } = await supabase
        .from("holes")
        .select("*")
        .eq("round_id", roundId)
        .order("hole_number");

      if (holesError) throw holesError;

      // Build player scores with course hole data
      const playerScores: PlayerScore[] = playersData.map((player: any) => {
        const playerHoles = courseHolesData.map((courseHole: any) => {
          const scoreData = holesData.find(
            (h: any) => h.hole_number === courseHole.hole_number && h.player_id === player.user_id
          );
          
          return {
            hole_number: courseHole.hole_number,
            score: scoreData?.score || null,
            par: courseHole.par,
            stroke_index: courseHole.stroke_index,
          };
        });

        const totalScore = playerHoles.reduce((sum, h) => sum + (h.score || 0), 0);
        const totalPar = playerHoles.reduce((sum, h) => sum + h.par, 0);
        const holesPlayed = playerHoles.filter((h) => h.score !== null).length;

        return {
          player_id: player.user_id,
          player_name: player.profiles?.display_name || player.profiles?.username || "Unknown",
          handicap: player.handicap || 0,
          holes: playerHoles,
          total_score: totalScore,
          total_par: totalPar,
          score_to_par: totalScore - totalPar,
          thru: holesPlayed,
        };
      });

      // Sort by score
      playerScores.sort((a, b) => {
        if (a.thru === 0 && b.thru === 0) return 0;
        if (a.thru === 0) return 1;
        if (b.thru === 0) return -1;
        return a.score_to_par - b.score_to_par;
      });

      setPlayers(playerScores);
    } catch (error) {
      console.error("Error fetching round data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreDisplay = (scoreToPar: number, thru: number) => {
    if (thru === 0) return "-";
    if (scoreToPar === 0) return "E";
    if (scoreToPar > 0) return `+${scoreToPar}`;
    return scoreToPar.toString();
  };

  const getOutScore = (holes: any[]) => {
    return holes
      .filter(h => h.hole_number <= 9 && h.score !== null)
      .reduce((sum, h) => sum + h.score, 0);
  };

  const getInScore = (holes: any[]) => {
    return holes
      .filter(h => h.hole_number > 9 && h.score !== null)
      .reduce((sum, h) => sum + h.score, 0);
  };

  const getOutPar = (holes: any[]) => {
    return holes
      .filter(h => h.hole_number <= 9)
      .reduce((sum, h) => sum + h.par, 0);
  };

  const getInPar = (holes: any[]) => {
    return holes
      .filter(h => h.hole_number > 9)
      .reduce((sum, h) => sum + h.par, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading leaderboard...</div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Round not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[#0a6e4a]">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="font-bold text-lg">
            Game {new Date(round.date_played).toLocaleDateString('sv-SE')} ({players.length})
          </h1>
          <p className="text-sm text-muted-foreground">{round.course_name}</p>
        </div>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Stroke Play Banner */}
      <div className="bg-[#0a9b66] text-white text-center py-4 text-xl font-semibold">
        Stroke Play NET
      </div>

      {/* Leaderboard Header */}
      <div className="bg-[#2a2a2a] text-white px-4 py-2 flex items-center text-sm font-semibold">
        <div className="w-12">#</div>
        <div className="flex-1">NAME</div>
        <div className="w-20 text-center">SCORE</div>
        <div className="w-20 text-center">TO PAR</div>
        <div className="w-20 text-center">THRU</div>
      </div>

      {/* Players */}
      <div className="p-2 space-y-2">
        {players.map((player, index) => (
          <div key={player.player_id}>
            <Card
              className="p-4 cursor-pointer"
              onClick={() => setExpandedPlayer(
                expandedPlayer === player.player_id ? null : player.player_id
              )}
            >
              <div className="flex items-center text-sm">
                <div className="w-12 text-center text-muted-foreground">
                  {player.thru > 0 ? index + 1 : "-"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{player.player_name}</div>
                  <div className="text-xs text-muted-foreground">
                    HCP {player.handicap > 0 ? "+" : ""}{player.handicap}
                  </div>
                </div>
                <div className="w-20 text-center font-semibold">
                  {player.thru > 0 ? player.total_score : "0"}
                </div>
                <div className="w-20 text-center text-2xl font-bold">
                  {getScoreDisplay(player.score_to_par, player.thru)}
                </div>
                <div className="w-20 text-center text-muted-foreground">
                  {player.thru > 0 ? player.thru : "-"}
                </div>
              </div>

              {/* Expanded Scorecard */}
              {expandedPlayer === player.player_id && (
                <div className="mt-4 space-y-4">
                  {/* Front 9 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#0a9b66] text-white">
                          <th className="p-2 text-left font-semibold">Hole</th>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => (
                            <th key={h} className="p-2 text-center font-semibold">{h}</th>
                          ))}
                          <th className="p-2 text-center font-semibold">Out</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        <tr>
                          <td className="p-2 font-medium">Handicap</td>
                          {player.holes.slice(0, 9).map((h, i) => (
                            <td key={i} className="p-2 text-center">{h.stroke_index}</td>
                          ))}
                          <td className="p-2 text-center font-semibold">
                            {player.holes.slice(0, 9).reduce((sum, h) => sum + h.stroke_index, 0)}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 font-medium">Par</td>
                          {player.holes.slice(0, 9).map((h, i) => (
                            <td key={i} className="p-2 text-center">{h.par}</td>
                          ))}
                          <td className="p-2 text-center font-semibold">{getOutPar(player.holes)}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold">Score</td>
                          {player.holes.slice(0, 9).map((h, i) => (
                            <td key={i} className="p-2 text-center font-semibold">
                              {h.score || ""}
                            </td>
                          ))}
                          <td className="p-2 text-center font-bold">{getOutScore(player.holes) || 0}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 font-medium">Net</td>
                          {player.holes.slice(0, 9).map((h, i) => (
                            <td key={i} className="p-2 text-center">
                              {h.score ? h.score - h.par : ""}
                            </td>
                          ))}
                          <td className="p-2 text-center font-semibold">
                            {getOutScore(player.holes) - getOutPar(player.holes) || 0}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Back 9 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#0a9b66] text-white">
                          <th className="p-2 text-left font-semibold">Hole</th>
                          {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(h => (
                            <th key={h} className="p-2 text-center font-semibold">{h}</th>
                          ))}
                          <th className="p-2 text-center font-semibold">In</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        <tr>
                          <td className="p-2 font-medium">Handicap</td>
                          {player.holes.slice(9, 18).map((h, i) => (
                            <td key={i} className="p-2 text-center">{h.stroke_index}</td>
                          ))}
                          <td className="p-2 text-center font-semibold">
                            {player.holes.slice(9, 18).reduce((sum, h) => sum + h.stroke_index, 0)}
                          </td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 font-medium">Par</td>
                          {player.holes.slice(9, 18).map((h, i) => (
                            <td key={i} className="p-2 text-center">{h.par}</td>
                          ))}
                          <td className="p-2 text-center font-semibold">{getInPar(player.holes)}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold">Score</td>
                          {player.holes.slice(9, 18).map((h, i) => (
                            <td key={i} className="p-2 text-center font-semibold">
                              {h.score || ""}
                            </td>
                          ))}
                          <td className="p-2 text-center font-bold">{getInScore(player.holes) || 0}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="p-2 font-medium">Net</td>
                          {player.holes.slice(9, 18).map((h, i) => (
                            <td key={i} className="p-2 text-center">
                              {h.score ? h.score - h.par : ""}
                            </td>
                          ))}
                          <td className="p-2 text-center font-semibold">
                            {getInScore(player.holes) - getInPar(player.holes) || 0}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="flex justify-between text-sm py-2 border-t">
                    <div>
                      <span className="font-semibold">Par</span> {player.total_par}
                    </div>
                    <div>
                      <span className="font-semibold">Score</span> {player.total_score}/{player.thru}
                    </div>
                    <div>
                      <span className="font-semibold">Position</span>{" "}
                      {player.thru > 0 ? index + 1 : "-"}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 justify-around pt-2 border-t">
                    <Button variant="ghost" className="flex flex-col items-center gap-1">
                      <ThumbsUp className="h-5 w-5 text-[#0a9b66]" />
                      <span className="text-xs">Like</span>
                    </Button>
                    <Button variant="ghost" className="flex flex-col items-center gap-1">
                      <MessageCircle className="h-5 w-5 text-[#0a9b66]" />
                      <span className="text-xs">Comment to Game Feed</span>
                    </Button>
                    <Button variant="ghost" className="flex flex-col items-center gap-1">
                      <BarChart3 className="h-5 w-5 text-[#0a9b66]" />
                      <span className="text-xs">Statistics</span>
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex justify-around py-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1"
            onClick={() => navigate(`/rounds/${roundId}/track`)}
          >
            <span className="text-2xl">✏️</span>
            <span className="text-xs">Enter score</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 text-[#0a9b66]"
          >
            <span className="text-2xl">📊</span>
            <span className="text-xs font-semibold">Leaderboards</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1"
          >
            <span className="text-2xl">📰</span>
            <span className="text-xs">Game feed</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1"
            onClick={() => navigate("/messages")}
          >
            <span className="text-2xl">💬</span>
            <span className="text-xs">Messages</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1"
            onClick={() => navigate("/menu")}
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
