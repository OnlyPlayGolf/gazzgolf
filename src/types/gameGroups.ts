// Types for multi-group game support

export interface GameGroup {
  id: string;
  round_id: string;
  group_name: string;
  group_index: number;
  tee_time?: string | null;
  starting_hole?: number | null;
  created_at: string;
}

export interface GroupPlayer {
  odId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  handicap?: number;
  teeColor?: string;
  isTemporary?: boolean;
  groupId?: string;
}

// Player count requirements per game format
export const GAME_FORMAT_PLAYER_REQUIREMENTS: Record<string, { min: number; max: number; exact?: number }> = {
  stroke_play: { min: 1, max: 100 },
  match_play: { min: 2, max: 2, exact: 2 },
  copenhagen: { min: 3, max: 3, exact: 3 },
  skins: { min: 2, max: 8 },
  best_ball: { min: 3, max: 8 },
  scramble: { min: 2, max: 8 },
  umbriago: { min: 4, max: 4, exact: 4 },
  wolf: { min: 4, max: 6 },
};

// Validate if a group meets player requirements for a format
export const validateGroupPlayerCount = (
  format: string,
  playerCount: number
): { valid: boolean; message?: string } => {
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS[format];
  if (!req) return { valid: true };

  if (req.exact && playerCount !== req.exact) {
    return {
      valid: false,
      message: `${format.replace('_', ' ')} requires exactly ${req.exact} players. This group has ${playerCount}.`,
    };
  }

  if (playerCount < req.min) {
    return {
      valid: false,
      message: `${format.replace('_', ' ')} requires at least ${req.min} players. This group has ${playerCount}.`,
    };
  }

  if (playerCount > req.max) {
    return {
      valid: false,
      message: `${format.replace('_', ' ')} allows at most ${req.max} players. This group has ${playerCount}.`,
    };
  }

  return { valid: true };
};

// Check if user can edit scores for a specific group
export const canEditGroupScores = (
  userId: string,
  roundCreatorId: string,
  playerGroupId: string | null,
  userGroupId: string | null
): boolean => {
  // Round creator can edit all groups
  if (userId === roundCreatorId) return true;
  
  // Players can only edit their own group
  if (!playerGroupId || !userGroupId) return true; // No groups = single group mode
  return playerGroupId === userGroupId;
};
