import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, DollarSign, History, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UmbriagioGame, UmbriagioHole, RollEvent } from "@/types/umbriago";
import { calculatePayout } from "@/utils/umbriagioScoring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UmbriagioShareDialog } from "@/components/UmbriagioShareDialog";

export default function UmbriagioSummary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [game, setGame] = useState<UmbriagioGame | null>(null);
  const [holes, setHoles] = useState<UmbriagioHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHoleDetails, setShowHoleDetails] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("umbriago_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      
      const typedGame: UmbriagioGame = {
        ...gameData,
        payout_mode: gameData.payout_mode as 'difference' | 'total',
        roll_history: (gameData.roll_history as unknown as RollEvent[]) || [],
        winning_team: gameData.winning_team as 'A' | 'B' | 'TIE' | null,
      };
      
      setGame(typedGame);

      const { data: holesData, error: holesError } = await supabase
        .from("umbriago_holes")
        .select("*")
        .eq("game_id", gameId)
        .order("hole_number");

      if (holesError) throw holesError;
      
      const typedHoles: UmbriagioHole[] = (holesData || []).map(h => ({
        ...h,
        team_low_winner: h.team_low_winner as 'A' | 'B' | null,
        individual_low_winner: h.individual_low_winner as 'A' | 'B' | null,
        closest_to_pin_winner: h.closest_to_pin_winner as 'A' | 'B' | null,
        birdie_eagle_winner: h.birdie_eagle_winner as 'A' | 'B' | null,
        multiplier: h.multiplier as 1 | 2 | 4,
        double_called_by: h.double_called_by as 'A' | 'B' | null,
      }));
      
      setHoles(typedHoles);

      // Calculate final results if not already done
      if (!typedGame.is_finished && typedHoles.length === typedGame.holes_played) {
        await finishGame(typedGame, typedHoles);
      }
    } catch (error: any) {
      toast({ title: "Error loading game", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const finishGame = async (gameData: UmbriagioGame, holesData: UmbriagioHole[]) => {
    // Use stake_per_point directly
    const finalStake = gameData.stake_per_point;

    const { winner, payout } = calculatePayout(
      gameData.team_a_total_points,
      gameData.team_b_total_points,
      finalStake,
      gameData.payout_mode
    );

    try {
      const { error } = await supabase
        .from("umbriago_games")
        .update({
          is_finished: true,
          winning_team: winner,
          final_payout: payout,
        })
        .eq("id", gameData.id);

      if (error) throw error;

      setGame({
        ...gameData,
        is_finished: true,
        winning_team: winner,
        final_payout: payout,
      });
    } catch (error: any) {
      console.error("Error finishing game:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Game not found</p>
      </div>
    );
  }

  const getFinalStake = () => {
    return game.stake_per_point;
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rounds')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Umbriago Summary</h1>
            <p className="text-sm text-muted-foreground">{game.course_name}</p>
          </div>
        </div>

        {/* Winner Banner */}
        {game.is_finished && (
          <Card className={`${
            game.winning_team === 'A' ? 'bg-blue-500/20 border-blue-500' :
            game.winning_team === 'B' ? 'bg-red-500/20 border-red-500' :
            'bg-muted'
          }`}>
            <CardContent className="p-6 text-center">
              <Trophy className="mx-auto mb-2 text-yellow-500" size={40} />
              <h2 className="text-2xl font-bold">
                {game.winning_team === 'TIE' ? 'Tie Game!' : `Team ${game.winning_team} Wins!`}
              </h2>
              {game.winning_team !== 'TIE' && (
                <p className="text-lg mt-2">
                  {game.winning_team === 'A' 
                    ? `${game.team_a_player_1} & ${game.team_a_player_2}`
                    : `${game.team_b_player_1} & ${game.team_b_player_2}`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Final Score */}
        <Card>
          <CardHeader>
            <CardTitle>Final Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <div className="text-sm text-muted-foreground mb-1">Team A</div>
                <div className="text-sm text-muted-foreground">
                  {game.team_a_player_1} & {game.team_a_player_2}
                </div>
                <div className="text-4xl font-bold text-blue-500 mt-2">{game.team_a_total_points}</div>
              </div>
              <div className="text-2xl font-bold text-muted-foreground">vs</div>
              <div className="text-center flex-1">
                <div className="text-sm text-muted-foreground mb-1">Team B</div>
                <div className="text-sm text-muted-foreground">
                  {game.team_b_player_1} & {game.team_b_player_2}
                </div>
                <div className="text-4xl font-bold text-red-500 mt-2">{game.team_b_total_points}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout */}
        {game.is_finished && game.final_payout !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={20} className="text-primary" />
                Payout
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stake per point:</span>
                <span className="font-semibold">{getFinalStake()} SEK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payout mode:</span>
                <span className="font-semibold capitalize">{game.payout_mode}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">
                    {game.winning_team === 'TIE' ? 'No payout' : `Team ${game.winning_team === 'A' ? 'B' : 'A'} pays:`}
                  </span>
                  <span className="font-bold text-primary">{game.final_payout} SEK</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Roll History */}
        {game.roll_history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History size={20} className="text-primary" />
                Roll History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {game.roll_history.map((roll, idx) => (
                  <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded-lg">
                    <span>Team {roll.team} - Hole {roll.hole}</span>
                    <span>
                      Points: {roll.points_before} → {roll.points_after}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hole-by-Hole Details */}
        <Collapsible open={showHoleDetails} onOpenChange={setShowHoleDetails}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <CardTitle className="flex items-center justify-between">
                  <span>Hole-by-Hole Summary</span>
                  {showHoleDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {holes.map((hole) => (
                  <div key={hole.hole_number} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Hole {hole.hole_number}</span>
                      <div className="flex items-center gap-2">
                        {hole.is_umbriago && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full">
                            UMBRIAGO
                          </span>
                        )}
                        {hole.multiplier > 1 && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            ×{hole.multiplier}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Par {hole.par}</div>
                      <div className="text-right">
                        <span className="text-blue-500 font-semibold">{hole.team_a_hole_points}</span>
                        {' - '}
                        <span className="text-red-500 font-semibold">{hole.team_b_hole_points}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <div>Team Low: {hole.team_low_winner || 'Tie'}</div>
                      <div>Individual: {hole.individual_low_winner || 'Tie'}</div>
                      <div>Closest: {hole.closest_to_pin_winner || 'Tie'}</div>
                      <div>Birdie: {hole.birdie_eagle_winner || 'Tie'}</div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Running: 
                      <span className="text-blue-500 ml-1">{hole.team_a_running_total}</span>
                      {' - '}
                      <span className="text-red-500">{hole.team_b_running_total}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Continue Playing */}
        {!game.is_finished && holes.length < game.holes_played && (
          <Button onClick={() => navigate(`/umbriago/${game.id}/play`)} className="w-full" size="lg">
            Continue Playing
          </Button>
        )}

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowShareDialog(true)} 
            className="flex-1"
            size="lg"
          >
            <Share2 className="mr-2" size={18} />
            Share
          </Button>
          <Button onClick={() => navigate('/rounds')} className="flex-1" size="lg">
            Done
          </Button>
        </div>
      </div>

      <UmbriagioShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        courseName={game.course_name}
        teamAPoints={game.team_a_total_points}
        teamBPoints={game.team_b_total_points}
        winningTeam={game.winning_team}
        teamAPlayers={`${game.team_a_player_1} & ${game.team_a_player_2}`}
        teamBPlayers={`${game.team_b_player_1} & ${game.team_b_player_2}`}
        onContinue={() => navigate('/rounds')}
      />
    </div>
  );
}
