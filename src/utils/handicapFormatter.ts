/**
 * Formats a handicap value for display according to golf conventions:
 * - Plus handicaps (better than scratch, stored as negative): show "+" sign (e.g., +2.4)
 * - Normal handicaps (stored as positive): no sign (e.g., 8.1)
 * - Zero handicap: no sign (e.g., 0)
 * - Never display minus sign
 */
export const formatHandicap = (handicap: number | undefined): string => {
  if (handicap === undefined || handicap === null) return "";
  
  // If handicap is negative (plus handicap in golf terms), display with "+"
  // A player with -2.3 handicap is a "plus 2.3" player
  if (handicap < 0) {
    return `+${Math.abs(handicap)}`;
  }
  
  // For zero or positive handicaps (normal), just show the number
  return `${handicap}`;
};

/**
 * Formats handicap with "HCP:" prefix for display in player cards
 */
export const formatHandicapWithLabel = (handicap: number | undefined): string => {
  const formatted = formatHandicap(handicap);
  if (!formatted) return "";
  return `HCP: ${formatted}`;
};
