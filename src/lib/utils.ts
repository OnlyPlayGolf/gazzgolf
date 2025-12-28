import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Golf Handicap System:
 * - Plus handicaps (shown with "+") indicate better players
 * - Lower numbers are always better: +4.0 > +1.2 > 0.5 > 5.0 > 10.0
 * - Internally stored as: plus handicaps = negative numbers
 *   - "+4.0" -> -4.0 (internal)
 *   - "2.6" -> 2.6 (internal)
 * - This allows simple numeric comparison: lower internal value = better player
 */

/**
 * Parse handicap from string (database or user input) to internal numeric value.
 * "+4.0" (plus handicap, better player) -> -4.0 (internal)
 * "2.6" (regular handicap) -> 2.6 (internal)
 * "-4.0" (already internal format) -> -4.0 (internal)
 */
export function parseHandicap(input: string | null | undefined): number | undefined {
  if (!input) return undefined;
  const normalized = input.toString().replace(',', '.').trim();
  
  // If input starts with "+", it's a plus handicap - store as negative for correct sorting
  if (normalized.startsWith('+')) {
    const value = parseFloat(normalized.substring(1));
    return isNaN(value) ? undefined : -value;
  }
  
  const value = parseFloat(normalized);
  return isNaN(value) ? undefined : value;
}

/**
 * Format handicap from internal numeric value to display string.
 * -4.0 (internal, plus handicap) -> "+4.0"
 * 2.6 (internal, regular handicap) -> "2.6"
 * Never shows a minus sign - plus handicaps shown with "+"
 */
export function formatHandicap(handicap: number | null | undefined): string {
  if (handicap === undefined || handicap === null) return "";
  if (handicap < 0) return `+${Math.abs(handicap)}`;
  return handicap.toString();
}

/**
 * Format handicap with "HCP" prefix for display in score sheets.
 * -4.0 -> "HCP +4.0"
 * 2.6 -> "HCP 2.6"
 * 0 -> "HCP 0"
 */
export function formatHandicapWithPrefix(handicap: number | string | null | undefined): string {
  if (handicap === null || handicap === undefined) return "";
  
  const numHcp = typeof handicap === 'string' ? parseHandicap(handicap) : handicap;
  if (numHcp === undefined || isNaN(numHcp)) return "";
  
  if (numHcp < 0) return `HCP +${Math.abs(numHcp).toFixed(1)}`;
  if (numHcp === 0) return "HCP 0";
  return `HCP ${numHcp.toFixed(1)}`;
}

/**
 * Compare two handicaps for sorting (lower internal value = better player).
 * Returns negative if a is better, positive if b is better, 0 if equal.
 * Null/undefined handicaps are sorted to the end.
 */
export function compareHandicaps(a: number | null | undefined, b: number | null | undefined): number {
  // Handle null/undefined - push to end
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  
  // Simple numeric comparison works because plus handicaps are stored as negative
  return a - b;
}

/**
 * Parse handicap from string for sorting purposes.
 * Returns a numeric value suitable for comparison.
 * Null/undefined returns Infinity to sort to end.
 */
export function parseHandicapForSort(handicap: string | null | undefined): number {
  if (!handicap) return Infinity;
  const parsed = parseHandicap(handicap);
  return parsed !== undefined ? parsed : Infinity;
}
