import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface EventGame {
  id: string;
  group_id: string | null;
  group_name?: string;
  player_1?: string;
  player_2?: string;
  is_finished?: boolean;
  match_status?: number;
}

interface EventGroupSelectorProps {
  currentGameId: string;
  eventId: string | null;
  gameType: 'match_play' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'umbriago' | 'wolf';
  basePath: string;
}

export function EventGroupSelector({ 
  currentGameId, 
  eventId, 
  gameType, 
  basePath,
}: EventGroupSelectorProps) {
  const navigate = useNavigate();
  const [games, setGames] = useState<EventGame[]>([]);
  const [currentGame, setCurrentGame] = useState<EventGame | null>(null);
  const [isEventCreator, setIsEventCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      loadEventGames();
    } else {
      setLoading(false);
    }
  }, [eventId, currentGameId]);

  const loadEventGames = async () => {
    try {
      // For now, we handle match_play specifically - can extend for other game types later
      if (gameType !== 'match_play') {
        setLoading(false);
        return;
      }
      
      const { data: gamesData, error } = await supabase
        .from('match_play_games')
        .select('id, group_id, is_finished, match_status, user_id, player_1, player_2')
        .eq('event_id', eventId!)
        .order('created_at');

      if (error) {
        console.error('Error fetching event games:', error);
        setLoading(false);
        return;
      }

      if (gamesData && gamesData.length > 1) {
        // Fetch group names
        const groupIds = gamesData.map(g => g.group_id).filter(Boolean) as string[];
        let groupsMap = new Map<string, string>();
        
        if (groupIds.length > 0) {
          const { data: groupsData } = await supabase
            .from('game_groups')
            .select('id, group_name')
            .in('id', groupIds);
          
          if (groupsData) {
            groupsMap = new Map(groupsData.map(g => [g.id, g.group_name]));
          }
        }

        // Check if current user is the event creator
        const { data: eventData } = await supabase
          .from('events')
          .select('creator_id')
          .eq('id', eventId!)
          .single();

        const { data: { user } } = await supabase.auth.getUser();
        setIsEventCreator(eventData?.creator_id === user?.id);

        const enrichedGames: EventGame[] = gamesData.map(g => ({
          id: g.id,
          group_id: g.group_id,
          group_name: g.group_id ? groupsMap.get(g.group_id) || 'Group' : 'Game',
          player_1: g.player_1,
          player_2: g.player_2,
          is_finished: g.is_finished,
          match_status: g.match_status,
        }));

        setGames(enrichedGames);
        setCurrentGame(enrichedGames.find(g => g.id === currentGameId) || null);
      }
    } catch (error) {
      console.error('Error loading event games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGameSelect = (game: EventGame) => {
    if (game.id !== currentGameId) {
      navigate(`${basePath}/${game.id}/play`);
    }
  };

  // Don't show if no event or only one game
  if (!eventId || games.length <= 1 || loading) {
    return null;
  }

  // Only show to event creator (admin)
  if (!isEventCreator) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users size={16} />
          <span>{currentGame?.group_name || 'Select Group'}</span>
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        {games.map((game) => (
          <DropdownMenuItem
            key={game.id}
            onClick={() => handleGameSelect(game)}
            className={`flex items-center justify-between ${game.id === currentGameId ? 'bg-muted' : ''}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">{game.group_name}</span>
              <span className="text-xs text-muted-foreground">
                {game.player_1} vs {game.player_2}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {game.is_finished ? (
                <Badge variant="secondary" className="text-xs">Done</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">In Progress</Badge>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Component to show all groups in a list format (for leaderboard)
interface EventGroupsListProps {
  eventId: string | null;
  gameType: 'match_play' | 'copenhagen' | 'skins' | 'best_ball' | 'scramble' | 'umbriago' | 'wolf';
  basePath: string;
  currentGameId: string;
}

export function EventGroupsList({ eventId, gameType, basePath, currentGameId }: EventGroupsListProps) {
  const navigate = useNavigate();
  const [games, setGames] = useState<EventGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      loadEventGames();
    } else {
      setLoading(false);
    }
  }, [eventId]);

  const loadEventGames = async () => {
    try {
      if (gameType !== 'match_play') {
        setLoading(false);
        return;
      }
      
      const { data: gamesData, error } = await supabase
        .from('match_play_games')
        .select('id, group_id, is_finished, match_status, player_1, player_2')
        .eq('event_id', eventId!)
        .order('created_at');

      if (error) {
        console.error('Error fetching event games:', error);
        setLoading(false);
        return;
      }

      if (gamesData && gamesData.length > 1) {
        const groupIds = gamesData.map(g => g.group_id).filter(Boolean) as string[];
        let groupsMap = new Map<string, string>();
        
        if (groupIds.length > 0) {
          const { data: groupsData } = await supabase
            .from('game_groups')
            .select('id, group_name')
            .in('id', groupIds);
          
          if (groupsData) {
            groupsMap = new Map(groupsData.map(g => [g.id, g.group_name]));
          }
        }

        const enrichedGames: EventGame[] = gamesData.map(g => ({
          id: g.id,
          group_id: g.group_id,
          group_name: g.group_id ? groupsMap.get(g.group_id) || 'Group' : 'Game',
          player_1: g.player_1,
          player_2: g.player_2,
          is_finished: g.is_finished,
          match_status: g.match_status,
        }));

        setGames(enrichedGames);
      }
    } catch (error) {
      console.error('Error loading event games:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!eventId || games.length <= 1 || loading) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-4 bg-muted/30">
      {games.map((game) => (
        <Button
          key={game.id}
          variant={game.id === currentGameId ? "default" : "outline"}
          size="sm"
          onClick={() => navigate(`${basePath}/${game.id}/leaderboard`)}
          className="flex-shrink-0"
        >
          {game.group_name}
        </Button>
      ))}
    </div>
  );
}
