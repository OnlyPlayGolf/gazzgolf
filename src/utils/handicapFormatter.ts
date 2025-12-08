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

/**
 * Parses and validates handicap input from user:
 * - "+" prefix is preserved and stored as negative number internally
 * - Normal numbers (no prefix) are stored as positive
 * - "-" prefix is NOT allowed and will be stripped
 * - Commas are converted to dots
 * Returns the numeric value to store, or undefined if invalid
 */
export const parseHandicapInput = (input: string): number | undefined => {
  if (!input || input.trim() === "") return undefined;
  
  // Replace comma with dot for decimal
  let normalized = input.replace(",", ".");
  
  // Check if it's a plus handicap (starts with +)
  const isPlusHandicap = normalized.startsWith("+");
  
  // Remove any + or - prefix for parsing
  normalized = normalized.replace(/^[+-]/, "");
  
  // Parse the number
  const num = parseFloat(normalized);
  if (isNaN(num)) return undefined;
  
  // Plus handicaps are stored as negative numbers internally
  return isPlusHandicap ? -num : num;
};

/**
 * Formats handicap value for input field display:
 * - Negative (plus handicap) shows with "+" prefix
 * - Positive (normal handicap) shows just the number
 */
export const formatHandicapForInput = (handicap: number | undefined): string => {
  if (handicap === undefined || handicap === null) return "";
  
  if (handicap < 0) {
    return `+${Math.abs(handicap)}`;
  }
  
  return `${handicap}`;
};
