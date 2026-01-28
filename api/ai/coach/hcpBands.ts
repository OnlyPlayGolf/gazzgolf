/**
 * Handicap bands for Coach AI.
 * Maps numeric HCP value (or missing) to a band used for tuning difficulty and difficulty_by_band.
 */

export const HCP_BANDS = [
  "plus_5_to_0",
  "0_to_5",
  "6_to_12",
  "13_to_20",
  "21_to_30",
  "31_plus",
  "no_hcp",
] as const;

export type HcpBand = (typeof HCP_BANDS)[number];

/**
 * Maps numeric HCP value to hcp_band. Use with parsed value (not raw input).
 * - value == null => no_hcp
 * - value < 0 => plus_5_to_0
 * - 0–5 => 0_to_5
 * - 6–12 => 6_to_12
 * - 13–20 => 13_to_20
 * - 21–30 => 21_to_30
 * - >= 31 => 31_plus
 */
export function getHcpBand(value: number | null | undefined): HcpBand {
  if (value == null || typeof value !== "number") return "no_hcp";
  if (value < 0) return "plus_5_to_0";
  if (value <= 5) return "0_to_5";
  if (value <= 12) return "6_to_12";
  if (value <= 20) return "13_to_20";
  if (value <= 30) return "21_to_30";
  return "31_plus";
}

export interface ParsedHcp {
  input: string | null;
  value: number | null;
  band: HcpBand;
}

/**
 * Parses raw HCP input from the UI.
 * - null / empty => { input: null, value: null, band: "no_hcp" }
 * - "+X" => value = -parseFloat(X), input = original string
 * - "X" => value = parseFloat(X)
 * - invalid => throws (caller should return 400 "Invalid HCP")
 */
export function parseHcp(hcpInput: string | null | undefined): ParsedHcp {
  const raw = typeof hcpInput === "string" ? hcpInput.trim() : "";
  if (raw === "") {
    return { input: null, value: null, band: "no_hcp" };
  }
  if (raw.startsWith("+")) {
    const rest = raw.slice(1).trim();
    const num = parseFloat(rest);
    if (rest === "" || !Number.isFinite(num) || num < 0) {
      throw new Error("Invalid HCP");
    }
    const value = -num;
    return { input: raw, value, band: getHcpBand(value) };
  }
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error("Invalid HCP");
  }
  return { input: raw, value: num, band: getHcpBand(num) };
}
