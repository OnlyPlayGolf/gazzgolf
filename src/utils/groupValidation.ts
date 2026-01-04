// Utility for validating player counts per group for game formats

import { PlayerGroup } from "@/types/playSetup";
import { GAME_FORMAT_PLAYER_REQUIREMENTS } from "@/types/gameGroups";

export interface GroupValidationResult {
  valid: boolean;
  groupId: string;
  groupName: string;
  playerCount: number;
  message: string;
}

export interface AllGroupsValidationResult {
  allValid: boolean;
  totalPlayers: number;
  groupResults: GroupValidationResult[];
  errorMessage: string | null;
}

/**
 * Validates a single group against the player requirements for a game format
 */
export function validateGroupForFormat(
  group: { id: string; name: string; players: { odId: string }[] },
  format: string
): GroupValidationResult {
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS[format];
  const playerCount = group.players.length;
  
  if (!req) {
    return {
      valid: true,
      groupId: group.id,
      groupName: group.name,
      playerCount,
      message: "",
    };
  }

  const formatName = format.replace(/_/g, " ");
  const capitalizedFormat = formatName.charAt(0).toUpperCase() + formatName.slice(1);

  // Check for allowed counts (e.g., match play: 2 or 4)
  if (req.allowedCounts && !req.allowedCounts.includes(playerCount)) {
    const allowedStr = req.allowedCounts.join(" or ");
    return {
      valid: false,
      groupId: group.id,
      groupName: group.name,
      playerCount,
      message: `${group.name} needs exactly ${allowedStr} players (has ${playerCount})`,
    };
  }

  if (req.exact && playerCount !== req.exact) {
    return {
      valid: false,
      groupId: group.id,
      groupName: group.name,
      playerCount,
      message: `${group.name} needs exactly ${req.exact} players (has ${playerCount})`,
    };
  }

  if (playerCount < req.min) {
    return {
      valid: false,
      groupId: group.id,
      groupName: group.name,
      playerCount,
      message: `${group.name} needs at least ${req.min} players (has ${playerCount})`,
    };
  }

  if (playerCount > req.max) {
    return {
      valid: false,
      groupId: group.id,
      groupName: group.name,
      playerCount,
      message: `${group.name} can have at most ${req.max} players (has ${playerCount})`,
    };
  }

  return {
    valid: true,
    groupId: group.id,
    groupName: group.name,
    playerCount,
    message: "",
  };
}

/**
 * Validates all groups against the player requirements for a game format.
 * Returns detailed validation results for each group.
 */
export function validateAllGroupsForFormat(
  groups: PlayerGroup[],
  format: string
): AllGroupsValidationResult {
  const nonEmptyGroups = groups.filter(g => g.players.length > 0);
  const totalPlayers = nonEmptyGroups.reduce((sum, g) => sum + g.players.length, 0);
  
  // For formats that don't use multi-group, validate total players
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS[format];
  
  const groupResults: GroupValidationResult[] = nonEmptyGroups.map(group =>
    validateGroupForFormat(group, format)
  );

  const invalidGroups = groupResults.filter(r => !r.valid);
  const allValid = invalidGroups.length === 0 && nonEmptyGroups.length > 0;

  // Build error message
  let errorMessage: string | null = null;
  
  if (nonEmptyGroups.length === 0) {
    errorMessage = "Add at least one player to start";
  } else if (invalidGroups.length > 0) {
    // Show the first invalid group's message
    errorMessage = invalidGroups[0].message;
  }

  return {
    allValid,
    totalPlayers,
    groupResults,
    errorMessage,
  };
}

/**
 * Gets the player requirement description for a format
 */
export function getFormatPlayerRequirementText(format: string): string {
  const req = GAME_FORMAT_PLAYER_REQUIREMENTS[format];
  if (!req) return "";

  const formatName = format.replace(/_/g, " ");
  const capitalizedFormat = formatName.charAt(0).toUpperCase() + formatName.slice(1);

  if (req.exact) {
    return `${capitalizedFormat} requires exactly ${req.exact} players per group`;
  }

  if (req.min === req.max) {
    return `${capitalizedFormat} requires exactly ${req.min} players per group`;
  }

  return `${capitalizedFormat} requires ${req.min}-${req.max} players per group`;
}

/**
 * Checks if a format supports multiple groups
 */
export function formatSupportsMultipleGroups(format: string): boolean {
  // Formats that can have multiple independent groups
  const multiGroupFormats = ["stroke_play", "scramble", "skins"];
  return multiGroupFormats.includes(format);
}
