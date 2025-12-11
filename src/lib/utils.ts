import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse handicap from string (database or user input).
 * "+10" (plus handicap) -> -10 (internal storage)
 * "10" (regular handicap) -> 10
 * "-10" (already internal format) -> -10
 */
export function parseHandicap(input: string | null | undefined): number | undefined {
  if (!input) return undefined;
  const normalized = input.toString().replace(',', '.').trim();
  // If input starts with "+", it's a plus handicap - store as negative
  if (normalized.startsWith('+')) {
    const value = parseFloat(normalized.substring(1));
    return isNaN(value) ? undefined : -value;
  }
  const value = parseFloat(normalized);
  return isNaN(value) ? undefined : value;
}

/**
 * Format handicap for display.
 * -10 (internal storage for plus handicap) -> "+10"
 * 10 (regular handicap) -> "10"
 */
export function formatHandicap(handicap: number | undefined): string {
  if (handicap === undefined) return "";
  if (handicap < 0) return `+${Math.abs(handicap)}`;
  return handicap.toString();
}
