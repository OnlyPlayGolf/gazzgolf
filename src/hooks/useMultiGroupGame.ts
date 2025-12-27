import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameGroup, GroupPlayer } from '@/types/gameGroups';

interface UseMultiGroupGameOptions {
  eventId?: string | null;
  gameType: string;
}

interface GameGroupWithPlayers extends GameGroup {
  players: GroupPlayer[];
}

export function useMultiGroupGame({ eventId, gameType }: UseMultiGroupGameOptions) {
  const [groups, setGroups] = useState<GameGroupWithPlayers[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserGroupId, setCurrentUserGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    loadUser();
  }, []);

  // Load groups for an event
  const loadGroups = useCallback(async () => {
    if (!eventId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: groupsData, error } = await supabase
        .from('game_groups')
        .select('*')
        .eq('event_id', eventId)
        .eq('game_type', gameType)
        .order('group_index');

      if (error) throw error;

      // For now, groups don't have a players table, so we'll track players locally
      const groupsWithPlayers: GameGroupWithPlayers[] = (groupsData || []).map(g => ({
        ...g,
        players: [],
      }));

      setGroups(groupsWithPlayers);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId, gameType]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Create a new group
  const createGroup = async (groupName: string, teeTime?: string, startingHole?: number): Promise<GameGroup | null> => {
    if (!eventId) return null;

    try {
      const { data, error } = await supabase
        .from('game_groups')
        .insert({
          event_id: eventId,
          game_type: gameType,
          group_name: groupName,
          group_index: groups.length,
          tee_time: teeTime || null,
          starting_hole: startingHole || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newGroup: GameGroupWithPlayers = { ...data, players: [] };
      setGroups(prev => [...prev, newGroup]);
      return data;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  };

  // Add a player to a group (local state only - the actual game record will store the group_id)
  const addPlayerToGroup = (groupId: string, player: GroupPlayer) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, players: [...g.players, { ...player, groupId }] };
      }
      return g;
    }));
  };

  // Remove a player from a group
  const removePlayerFromGroup = (groupId: string, playerId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, players: g.players.filter(p => p.odId !== playerId) };
      }
      return g;
    }));
  };

  // Check if current user can edit scores for a specific group's game
  const canEditGroup = (groupId: string, gameCreatorId: string): boolean => {
    if (!currentUserId) return false;
    
    // Game creator can edit all groups
    if (currentUserId === gameCreatorId) return true;
    
    // If no groups or single group mode, everyone can edit
    if (groups.length <= 1) return true;
    
    // Otherwise, user can only edit their own group
    return currentUserGroupId === groupId;
  };

  // Check if current user should see a specific group's data
  const canViewGroup = (groupId: string, gameCreatorId: string): boolean => {
    if (!currentUserId) return false;
    
    // Game creator can view all groups
    if (currentUserId === gameCreatorId) return true;
    
    // If no groups or single group mode, everyone can view
    if (groups.length <= 1) return true;
    
    // Otherwise, user can only view their own group
    return currentUserGroupId === groupId;
  };

  // Determine which group the current user belongs to
  const determineUserGroup = (gamesByGroup: Map<string, { userId: string }[]>) => {
    if (!currentUserId || groups.length === 0) return;

    for (const [groupId, games] of gamesByGroup.entries()) {
      if (games.some(g => g.userId === currentUserId)) {
        setCurrentUserGroupId(groupId);
        return;
      }
    }
  };

  return {
    groups,
    setGroups,
    currentUserId,
    currentUserGroupId,
    setCurrentUserGroupId,
    loading,
    createGroup,
    addPlayerToGroup,
    removePlayerFromGroup,
    canEditGroup,
    canViewGroup,
    determineUserGroup,
    loadGroups,
  };
}

// Helper to check if all players in a group have entered scores
export function allGroupPlayersScored(
  groupPlayers: GroupPlayer[],
  getPlayerScore: (playerId: string) => number | undefined
): boolean {
  return groupPlayers.every(player => {
    const score = getPlayerScore(player.odId);
    return score !== undefined && (score > 0 || score === -1);
  });
}

// Helper to filter games by group for display
export function filterGamesByGroup<T extends { group_id?: string | null }>(
  games: T[],
  groupId: string | null,
  isCreator: boolean
): T[] {
  if (isCreator || !groupId) {
    return games;
  }
  return games.filter(g => g.group_id === groupId);
}
