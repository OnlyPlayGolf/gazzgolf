import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";
import { BestBallGame, BestBallPlayer, BestBallGameType } from "@/types/bestBall";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GameDetailsSection,
  GameDetailsData,
  GamePlayer,
  ViewPlayersModal,
  RoundActionsSection,
  DeleteGameDialog,
  LeaveGameDialog,
} from "@/components/settings";
import { getTeeDisplayName } from "@/components/TeeSelector";
import { GameHeader } from "@/components/GameHeader";

export default function BestBallSettings() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('best_ball', gameId);
  const [game, setGame] = useState<BestBallGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [holesCompleted, setHolesCompleted] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
    
    if (gameId) {
      fetchGame();
      fetchProgress();
    }
  }, [gameId]);

  // Refetch data when page comes back into focus (e.g., returning from GameSettingsDetail)
  useEffect(() => {
    const handleFocus = () => {
      if (gameId) {
        fetchGame();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data } = await supabase
        .from("best_ball_games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (data) {
        // Safely parse player arrays with fallback to empty array
        const parsePlayerArray = (arr: unknown): BestBallPlayer[] => {
          if (!arr || !Array.isArray(arr)) return [];
          return arr.map((p: any) => ({
            odId: p?.odId || p?.id || '',
            displayName: p?.displayName || 'Unknown',
            handicap: p?.handicap,
            teeColor: p?.teeColor,
            isTemporary: p?.isTemporary || false,
          }));
        };

        const typedGame: BestBallGame = {
          ...data,
          game_type: (data.game_type as BestBallGameType) || 'match',
          team_a_players: parsePlayerArray(data.team_a_players),
          team_b_players: parsePlayerArray(data.team_b_players),
          winner_team: data.winner_team as 'A' | 'B' | 'TIE' | null,
        };
        setGame(typedGame);
      }
    } catch (error) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    const { count } = await supabase
      .from("best_ball_holes")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);
    setHolesCompleted(count || 0);
  };

  const handleFinishGame = async () => {
    if (!game) return;
    try {
      const winner = game.team_a_total > game.team_b_total ? "A" : 
                     game.team_b_total > game.team_a_total ? "B" : "TIE";
      
      await supabase
        .from("best_ball_games")
        .update({ is_finished: true, winner_team: winner })
        .eq("id", gameId);
      
      toast({ title: "Game finished!" });
      navigate(`/best-ball/${gameId}/summary`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async () => {
    try {
      await supabase.from("best_ball_holes").delete().eq("game_id", gameId);
      await supabase.from("best_ball_games").delete().eq("id", gameId);
      toast({ title: "Game deleted" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error deleting game", description: error.message, variant: "destructive" });
    }
  };

  const handleLeaveGame = async () => {
    setLeaving(true);
    try {
      toast({ title: "Left the game" });
      navigate("/rounds-play");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLeaving(false);
      setShowLeaveDialog(false);
    }
  };

  if (loading || isSpectatorLoading) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center">
        <div className="text-muted-foreground">Game not found</div>
        {gameId && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
      </div>
    );
  }

  // Use individual player tees from the teams - these are per-player tees set in Game Settings
  const allPlayers = [...game.team_a_players, ...game.team_b_players];
  const defaultTee = allPlayers.find(p => p.teeColor)?.teeColor || 'white';
  
  const players: GamePlayer[] = [
    ...game.team_a_players.map(p => ({
      name: p.displayName,
      handicap: game.use_handicaps ? (p as any).playingHandicap ?? (p as any).handicap : undefined,
      tee: p.teeColor || defaultTee, // Individual player tee from DB, fallback to default
      team: game.team_a_name,
    })),
    ...game.team_b_players.map(p => ({
      name: p.displayName,
      handicap: game.use_handicaps ? (p as any).playingHandicap ?? (p as any).handicap : undefined,
      tee: p.teeColor || defaultTee, // Individual player tee from DB, fallback to default
      team: game.team_b_name,
    })),
  ];

  // tee_set is the "Default Tee" - display it in Game Details
  // If all players have same tee, show that; if different, show "Combo"
  const allPlayerTees = players.map(p => p.tee);
  const uniqueTees = [...new Set(allPlayerTees)];
  const teeInfo = (() => {
    if (uniqueTees.length === 1) {
      return getTeeDisplayName(uniqueTees[0]!);
    }
    if (uniqueTees.length > 1) {
      return "Combo";
    }
    return defaultTee ? getTeeDisplayName(defaultTee) : "Not specified";
  })();

  const gameDetails: GameDetailsData = {
    format: `Best Ball ${game.game_type === 'match' ? 'Match Play' : 'Stroke Play'}`,
    courseName: game.course_name,
    datePlayed: game.date_played,
    players,
    teeInfo,
    holesPlayed: game.holes_played,
    currentHole: holesCompleted > 0 ? holesCompleted : undefined,
    scoring: game.use_handicaps ? "Net scoring (handicaps enabled)" : "Gross scoring",
    roundName: (game as any).round_name,
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <GameHeader 
        gameTitle={(game as any).round_name || "Best Ball"} 
        courseName={game.course_name} 
        pageTitle="Settings" 
      />
      <div className="p-4 max-w-2xl mx-auto space-y-4">

        <GameDetailsSection 
          data={gameDetails} 
          onViewPlayers={() => setShowPlayersModal(true)} 
        />

        {/* Game Settings - Hidden for spectators */}
        {!isSpectator && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-primary" />
                  Game Settings
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/game-settings/best-ball/${gameId}?returnPath=/best-ball/${gameId}/settings`)}
                  className="h-8 w-8"
                >
                  <Settings size={16} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Use Handicaps (Net)</Label>
                  <p className="text-xs text-muted-foreground">Apply stroke allocation</p>
                </div>
                <Switch 
                  checked={game.use_handicaps} 
                  onCheckedChange={async (checked) => {
                    await supabase
                      .from("best_ball_games")
                      .update({ use_handicaps: checked })
                      .eq("id", gameId);
                    setGame({ ...game, use_handicaps: checked });
                    toast({ title: checked ? "Handicaps enabled" : "Handicaps disabled" });
                  }} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Mulligans per Player</Label>
                  <p className="text-xs text-muted-foreground">Extra shots allowed</p>
                </div>
                <Select 
                  value={((game as any).mulligans_per_player || 0).toString()} 
                  onValueChange={async (v) => {
                    const mulligans = parseInt(v);
                    await supabase
                      .from("best_ball_games")
                      .update({ mulligans_per_player: mulligans })
                      .eq("id", gameId);
                    setGame({ ...game, mulligans_per_player: mulligans } as any);
                    toast({ title: mulligans === 0 ? "Mulligans disabled" : mulligans === 9 ? "1 mulligan per 9 holes" : `Mulligans set to ${mulligans}` });
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No mulligans</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="9">1 per 9 holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Round Actions - Hidden for spectators */}
        {!isSpectator && (
          <RoundActionsSection
            isAdmin={currentUserId === game.user_id}
            onFinish={handleFinishGame}
            onSaveAndExit={() => navigate('/profile')}
            onDelete={() => setShowDeleteDialog(true)}
            onLeave={() => setShowLeaveDialog(true)}
          />
        )}
      </div>

      <ViewPlayersModal
        open={showPlayersModal}
        onOpenChange={setShowPlayersModal}
        players={players}
        useHandicaps={game.use_handicaps}
      />

      <DeleteGameDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteGame}
        gameName="Best Ball Game"
      />

      <LeaveGameDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onConfirm={handleLeaveGame}
        leaving={leaving}
      />

      {gameId && <BestBallBottomTabBar gameId={gameId} isSpectator={isSpectator} />}
    </div>
  );
}
