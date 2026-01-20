import { useState } from "react";
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
import { toast } from "@/lib/notify";

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
  ongoingGames: OngoingGame[];
  onGameDeleted?: () => void | Promise<void>;
}

export const OngoingRoundsSection = ({ ongoingGames, onGameDeleted }: OngoingRoundsSectionProps) => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<OngoingGame | null>(null);

  const handleOpenGame = (game: OngoingGame) => {
    // Different game types use different tab names for their play page
    const getPlayTab = (gameType: GameType): string => {
      switch (gameType) {
        case 'round':
        case 'skins':
          return 'track';
        default:
          return 'play';
      }
    };
    
    const mode = game.gameType as GameMode;
    const tab = getPlayTab(game.gameType);
    const url = buildGameUrl(mode, game.id, tab);
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
      // Notify parent to refresh data
      onGameDeleted?.();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Failed to delete game');
    } finally {
      setDeleteDialogOpen(false);
      setGameToDelete(null);
    }
  };

  if (ongoingGames.length === 0) {
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
            <AlertDialogTitle>Delete Round</AlertDialogTitle>
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
