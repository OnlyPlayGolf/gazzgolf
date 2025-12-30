import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CopenhagenGame, CopenhagenHole } from "@/types/copenhagen";
import { Trophy, Target, ChevronDown, ChevronUp, ArrowLeft, Share2 } from "lucide-react";
import { GameShareDialog } from "@/components/GameShareDialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function CopenhagenSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<CopenhagenGame | null>(null);
  const [holes, setHoles] = useState<CopenhagenHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);

  // Check if completion dialog was already shown for this game
  useEffect(() => {
    if (gameId) {
      const shownKey = `copenhagen_completed_shown_${gameId}`;
      const wasShown = localStorage.getItem(shownKey);
      if (!wasShown) {
        setShowCompletionDialog(true);
        localStorage.setItem(shownKey, "true");
      }
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData } = await supabase
        .from("copenhagen_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData as CopenhagenGame);
      }

      const { data: holesData } = await supabase
        .from("copenhagen_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesData) {
        setHoles(holesData as CopenhagenHole[]);
      }
    } catch (error) {
      console.error("Error loading game:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const players = [
    { 
      name: game.player_1, 
      points: game.player_1_total_points, 
      color: "text-emerald-600", 
      bg: "bg-emerald-500",
      playerNum: 1
    },
    { 
      name: game.player_2, 
      points: game.player_2_total_points, 
      color: "text-blue-600", 
      bg: "bg-blue-500",
      playerNum: 2
    },
    { 
      name: game.player_3, 
      points: game.player_3_total_points, 
      color: "text-amber-600", 
      bg: "bg-amber-500",
      playerNum: 3
    },
  ].sort((a, b) => b.points - a.points);

  const sweeps = holes.filter(h => h.is_sweep);

  const getPlayerScoreForHole = (hole: CopenhagenHole, playerNum: number) => {
    if (playerNum === 1) return hole.player_1_gross_score;
    if (playerNum === 2) return hole.player_2_gross_score;
    return hole.player_3_gross_score;
  };

  const getPlayerPointsForHole = (hole: CopenhagenHole, playerNum: number) => {
    if (playerNum === 1) return hole.player_1_hole_points;
    if (playerNum === 2) return hole.player_2_hole_points;
    return hole.player_3_hole_points;
  };

  const getPlayerMulliganForHole = (hole: CopenhagenHole, playerNum: number) => {
    if (playerNum === 1) return hole.player_1_mulligan;
    if (playerNum === 2) return hole.player_2_mulligan;
    return hole.player_3_mulligan;
  };

  const getScoreColor = (score: number | null, par: number) => {
    if (!score) return "";
    const diff = score - par;
    if (diff <= -2) return "bg-yellow-400 text-yellow-900";
    if (diff === -1) return "bg-red-500 text-white";
    if (diff === 0) return "bg-emerald-500 text-white";
    if (diff === 1) return "bg-blue-400 text-white";
    if (diff >= 2) return "bg-blue-700 text-white";
    return "";
  };

  const front9 = holes.filter(h => h.hole_number <= 9);
  const back9 = holes.filter(h => h.hole_number > 9);

  return (
    <div className="min-h-screen pb-8 bg-background">
      {/* Completion Dialog - shown once when first viewing finished game */}
      <GameShareDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        gameType="Copenhagen"
        courseName={game.course_name}
        roundName={game.round_name || undefined}
        winner={players[0].name}
        resultText={`${players[0].points} points`}
        additionalInfo={`${game.player_1}, ${game.player_2}, ${game.player_3}`}
        gameId={gameId}
        onContinue={() => setShowCompletionDialog(false)}
      />

      {/* Share Dialog - opened from share button, goes directly to share form */}
      <GameShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        gameType="Copenhagen"
        courseName={game.course_name}
        roundName={game.round_name || undefined}
        winner={players[0].name}
        resultText={`${players[0].points} points`}
        additionalInfo={`${game.player_1}, ${game.player_2}, ${game.player_3}`}
        gameId={gameId}
        onContinue={() => setShowShareDialog(false)}
        showShareFormOnly
      />

      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/rounds-play")}
          >
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-lg font-semibold">Copenhagen</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 size={24} />
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">{game.course_name}</p>
          <p className="text-sm text-muted-foreground">{holes.length} holes played</p>
        </div>

        {/* Winner Card */}
        <Card className="bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-yellow-500/30">
          <CardContent className="pt-6 text-center">
            <Trophy className="mx-auto text-yellow-500 mb-2" size={48} />
            <h2 className="text-2xl font-bold">{players[0].name}</h2>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{players[0].points} pts</p>
          </CardContent>
        </Card>

        {/* Final Standings with expandable scorecards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Final Standings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, i) => (
              <Collapsible 
                key={i} 
                open={expandedPlayer === i}
                onOpenChange={(open) => setExpandedPlayer(open ? i : null)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full ${player.bg} flex items-center justify-center text-white font-bold`}>
                        {i + 1}
                      </span>
                      <span className={`font-medium ${player.color}`}>{player.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xl font-bold">{player.points}</div>
                      {expandedPlayer === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-muted/30 rounded-lg p-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-xs">
                          <th className="text-left py-1 px-1">Hole</th>
                          {holes.map(h => (
                            <th key={h.hole_number} className="text-center px-1 min-w-[28px]">{h.hole_number}</th>
                          ))}
                          <th className="text-center px-2 font-bold">Tot</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-muted-foreground text-xs">
                          <td className="py-1 px-1">Par</td>
                          {holes.map(h => (
                            <td key={h.hole_number} className="text-center px-1">{h.par}</td>
                          ))}
                          <td className="text-center px-2 font-medium">{holes.reduce((t, h) => t + h.par, 0)}</td>
                        </tr>
                        <tr>
                          <td className="py-1 px-1 text-xs">Score</td>
                          {holes.map(h => {
                            const score = getPlayerScoreForHole(h, player.playerNum);
                            const hasMulligan = getPlayerMulliganForHole(h, player.playerNum);
                            return (
                              <td key={h.hole_number} className="text-center px-1">
                                <div className="flex flex-col items-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${getScoreColor(score, h.par)}`}>
                                    {score || '-'}
                                  </span>
                                  {hasMulligan && (
                                    <span className="w-4 h-0.5 bg-foreground mt-0.5" />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="text-center px-2 font-bold">
                            {holes.reduce((t, h) => t + (getPlayerScoreForHole(h, player.playerNum) || 0), 0)}
                          </td>
                        </tr>
                        <tr className="text-muted-foreground">
                          <td className="py-1 px-1 text-xs">Pts</td>
                          {holes.map(h => {
                            const pts = getPlayerPointsForHole(h, player.playerNum);
                            return (
                              <td key={h.hole_number} className="text-center px-1">
                                <span className={`text-xs ${pts === 6 ? 'text-yellow-500 font-bold' : pts === 4 ? 'text-primary font-medium' : ''}`}>
                                  {pts}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center px-2 font-bold text-primary">{player.points}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Leaderboard / Scorecard Section */}
        <Card>
          <Collapsible open={showScorecard} onOpenChange={setShowScorecard}>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Scorecard</CardTitle>
                  {showScorecard ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs border-b">
                      <th className="text-left py-2 px-1 sticky left-0 bg-card">Hole</th>
                      {holes.map(h => (
                        <th key={h.hole_number} className="text-center px-1 min-w-[32px]">
                          {h.hole_number}
                        </th>
                      ))}
                      <th className="text-center px-2 font-bold">Tot</th>
                      <th className="text-center px-2 font-bold">Pts</th>
                    </tr>
                    <tr className="text-muted-foreground text-xs border-b">
                      <td className="py-1 px-1 sticky left-0 bg-card">Par</td>
                      {holes.map(h => (
                        <td key={h.hole_number} className="text-center px-1">{h.par}</td>
                      ))}
                      <td className="text-center px-2 font-medium">{holes.reduce((t, h) => t + h.par, 0)}</td>
                      <td className="text-center px-2">-</td>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, i) => {
                      const totalStrokes = holes.reduce((t, h) => t + (getPlayerScoreForHole(h, player.playerNum) || 0), 0);
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className={`py-2 px-1 sticky left-0 bg-card font-medium ${player.color}`}>
                            {player.name}
                          </td>
                          {holes.map(h => {
                            const score = getPlayerScoreForHole(h, player.playerNum);
                            const hasMulligan = getPlayerMulliganForHole(h, player.playerNum);
                            return (
                              <td key={h.hole_number} className="text-center px-1">
                                <div className="flex flex-col items-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${getScoreColor(score, h.par)}`}>
                                    {score || '-'}
                                  </span>
                                  {hasMulligan && (
                                    <span className="w-4 h-0.5 bg-foreground mt-0.5" />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="text-center px-2 font-bold">{totalStrokes}</td>
                          <td className="text-center px-2 font-bold text-primary">{player.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Game Stats</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="text-center p-3 rounded-lg bg-muted/50 w-full max-w-[200px]">
              <Target className="mx-auto text-amber-500 mb-1" size={24} />
              <div className="text-2xl font-bold">{sweeps.length}</div>
              <div className="text-xs text-muted-foreground">Sweeps</div>
            </div>
          </CardContent>
        </Card>

        {/* Home Button */}
        <Button 
          className="w-full" 
          onClick={() => navigate("/rounds-play")}
        >
          Back to Rounds
        </Button>
      </div>
    </div>
  );
}
