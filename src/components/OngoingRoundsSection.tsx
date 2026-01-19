import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, MapPin, X, ChevronRight } from "lucide-react";
import { buildGameUrl } from "@/hooks/useRoundNavigation";
import { GameMode } from "@/types/roundShell";
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
import { toast } from "sonner";

type GameType = 'round' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'wolf' | 'umbriago' | 'match_play';

interface OngoingGame {
  id: string;
  gameType: GameType;
  roundName: string | null;
  courseName: string;
  playerCount: number;
  createdAt: string;
  isOwner: boolean;
}

const GAME_FORMAT_LABELS: Record<GameType, string> = {
  round: 'Stroke Play',
  copenhagen: 'Copenhagen',
  skins: 'Skins',
  best_ball: 'Best Ball',
  scramble: 'Scramble',
  wolf: 'Wolf',
  umbriago: 'Umbriago',
  match_play: 'Match Play',
};

interface OngoingRoundsSectionProps {
  userId: string;
}

export const OngoingRoundsSection = ({ userId }: OngoingRoundsSectionProps) => {
  const navigate = useNavigate();
  const [ongoingGames, setOngoingGames] = useState<OngoingGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<OngoingGame | null>(null);

  useEffect(() => {
    loadOngoingGames();
  }, [userId]);

  const loadOngoingGames = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const games: OngoingGame[] = [];

      // Fetch round_players to find rounds user participates in
      const { data: roundPlayers } = await supabase
        .from('round_players')
        .select('round_id')
        .eq('user_id', userId);

      const participatingRoundIds = (roundPlayers || []).map(rp => rp.round_id);

      // Fetch all game types in parallel
      const [
        { data: rounds },
        { data: copenhagen },
        { data: skins },
        { data: bestBall },
        { data: scramble },
        { data: wolf },
        { data: umbriago },
        { data: matchPlay }
      ] = await Promise.all([
        supabase.from('rounds').select('id, user_id, course_name, round_name, created_at').gte('created_at', twelveHoursAgo),
        supabase.from('copenhagen_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2, player_3').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('skins_games').select('id, user_id, course_name, round_name, created_at, is_finished, players').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('best_ball_games').select('id, user_id, course_name, round_name, created_at, is_finished, team_a_players, team_b_players').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('scramble_games').select('id, user_id, course_name, round_name, created_at, is_finished, teams').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('wolf_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2, player_3, player_4, player_5, player_6').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('umbriago_games').select('id, user_id, course_name, round_name, created_at, is_finished, team_a_player_1, team_a_player_2, team_b_player_1, team_b_player_2').gte('created_at', twelveHoursAgo).eq('is_finished', false),
        supabase.from('match_play_games').select('id, user_id, course_name, round_name, created_at, is_finished, player_1, player_2').gte('created_at', twelveHoursAgo).eq('is_finished', false),
      ]);

      // Process rounds - user owns or participates
      for (const round of rounds || []) {
        const isOwner = round.user_id === userId;
        const isParticipant = participatingRoundIds.includes(round.id);
        if (isOwner || isParticipant) {
          // Get player count
          const { count } = await supabase
            .from('round_players')
            .select('id', { count: 'exact', head: true })
            .eq('round_id', round.id);
          
          games.push({
            id: round.id,
            gameType: 'round',
            roundName: round.round_name,
            courseName: round.course_name,
            playerCount: count || 1,
            createdAt: round.created_at || '',
            isOwner,
          });
        }
      }

      // Process Copenhagen - user owns or is a player
      for (const game of copenhagen || []) {
        const isOwner = game.user_id === userId;
        const isPlayer = [game.player_1, game.player_2, game.player_3].some(p => p && p.includes(userId));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'copenhagen',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 3,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Skins
      for (const game of skins || []) {
        const isOwner = game.user_id === userId;
        const players = (game.players as any[]) || [];
        const isPlayer = players.some(p => p?.userId === userId || p?.id === userId);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'skins',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: players.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Best Ball
      for (const game of bestBall || []) {
        const isOwner = game.user_id === userId;
        const teamA = (game.team_a_players as any[]) || [];
        const teamB = (game.team_b_players as any[]) || [];
        const allPlayers = [...teamA, ...teamB];
        const isPlayer = allPlayers.some(p => p?.userId === userId || p?.id === userId);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'best_ball',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: allPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Scramble
      for (const game of scramble || []) {
        const isOwner = game.user_id === userId;
        const teams = (game.teams as any[]) || [];
        const allPlayers = teams.flatMap(t => t?.players || []);
        const isPlayer = allPlayers.some(p => p?.userId === userId || p?.id === userId);
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'scramble',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: allPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Wolf
      for (const game of wolf || []) {
        const isOwner = game.user_id === userId;
        const wolfPlayers = [game.player_1, game.player_2, game.player_3, game.player_4, game.player_5, game.player_6].filter(Boolean);
        const isPlayer = wolfPlayers.some(p => p && p.includes(userId));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'wolf',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: wolfPlayers.length,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Umbriago
      for (const game of umbriago || []) {
        const isOwner = game.user_id === userId;
        const umbriagoPlayers = [game.team_a_player_1, game.team_a_player_2, game.team_b_player_1, game.team_b_player_2].filter(Boolean);
        const isPlayer = umbriagoPlayers.some(p => p && p.includes(userId));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'umbriago',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 4,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Process Match Play
      for (const game of matchPlay || []) {
        const isOwner = game.user_id === userId;
        const matchPlayers = [game.player_1, game.player_2].filter(Boolean);
        const isPlayer = matchPlayers.some(p => p && p.includes(userId));
        if (isOwner || isPlayer) {
          games.push({
            id: game.id,
            gameType: 'match_play',
            roundName: game.round_name,
            courseName: game.course_name,
            playerCount: 2,
            createdAt: game.created_at || '',
            isOwner,
          });
        }
      }

      // Sort by most recent
      games.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOngoingGames(games);
    } catch (error) {
      console.error('Error loading ongoing games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGame = (game: OngoingGame) => {
    const mode = game.gameType as GameMode;
    const url = buildGameUrl(mode, game.id, 'play');
    navigate(url);
  };

  const handleDeleteClick = (game: OngoingGame) => {
    setGameToDelete(game);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!gameToDelete) return;

    try {
      const { gameType, id } = gameToDelete;
      
      // Delete holes first, then the game
      const holesTable = gameType === 'round' ? 'holes' : `${gameType === 'match_play' ? 'match_play' : gameType}_holes`;
      const gamesTable = gameType === 'round' ? 'rounds' : `${gameType === 'match_play' ? 'match_play' : gameType}_games`;

      if (gameType === 'round') {
        await supabase.from('holes').delete().eq('round_id', id);
        await supabase.from('round_players').delete().eq('round_id', id);
        await supabase.from('rounds').delete().eq('id', id);
      } else {
        await supabase.from(holesTable as any).delete().eq('game_id', id);
        await supabase.from(gamesTable as any).delete().eq('id', id);
      }

      toast.success('Game deleted successfully');
      setOngoingGames(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Failed to delete game');
    } finally {
      setDeleteDialogOpen(false);
      setGameToDelete(null);
    }
  };

  if (loading || ongoingGames.length === 0) {
    return null;
  }

  return (
    <>
      <div className="px-4 space-y-3">
        {ongoingGames.map((game) => (
          <Card key={`${game.gameType}-${game.id}`} className="bg-card border-border overflow-hidden">
            <CardContent className="p-4 space-y-3">
              {/* Header row with title and delete button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Game name/title */}
                  <h3 className="font-semibold text-foreground truncate">
                    {game.roundName || GAME_FORMAT_LABELS[game.gameType]}
                  </h3>
                  
                  {/* Course name */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin size={14} className="flex-shrink-0" />
                    <span className="truncate">{game.courseName}</span>
                  </div>
                  
                  {/* Player count and format */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} className="flex-shrink-0" />
                      <span>{game.playerCount} player{game.playerCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {GAME_FORMAT_LABELS[game.gameType]}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                {game.isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => handleDeleteClick(game)}
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>

              {/* Open button at bottom */}
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleOpenGame(game)}
              >
                Open
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this game? This action cannot be undone and all scores will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
