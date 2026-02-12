import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drillSchema, type Drill } from "./drillSchema.ts";
import { coachDrillExamples } from "./coachExamples.ts";
import { parseHcp, type ParsedHcp, type HcpBand } from "./hcpBands.ts";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DRILL_TYPES = ["points", "score_entry"] as const;
type DrillType = (typeof DRILL_TYPES)[number];

const REQUIRED_FIELDS: Record<DrillType, string[]> = {
  points: ["outcomes", "target_points", "distances", "end_condition"],
  score_entry: ["score_label", "prompt"],
};

function isDrillType(s: unknown): s is DrillType {
  return typeof s === "string" && DRILL_TYPES.includes(s as DrillType);
}

function buildRetryHint(attempted: unknown): string {
  const obj =
    attempted != null && typeof attempted === "object"
      ? (attempted as Record<string, unknown>)
      : null;
  const dt = obj && "drill_type" in obj ? obj.drill_type : undefined;

  if (isDrillType(dt)) {
    const required = REQUIRED_FIELDS[dt];
    const missing = required.filter(
      (k) =>
        !obj ||
        !(k in obj) ||
        obj[k] === undefined ||
        (Array.isArray(obj[k]) && (obj[k] as unknown[]).length === 0)
    );
    const clause =
      missing.length > 0
        ? `Missing fields for "${dt}": ${missing.join(", ")}. `
        : `"${dt}" validation failed. Required: ${required.join(", ")}. `;
    return `Schema validation failed. ${clause}Output only valid JSON.`;
  }
  return `Schema validation failed. drill_type must be "points" or "score_entry". Include all required fields. Output only valid JSON.`;
}

/* ------------------------------------------------------------------ */
/*  Env / Auth                                                         */
/* ------------------------------------------------------------------ */

const REQUIRED_ENV_VARS = [
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function getMissingEnvVars(): string[] {
  const missing: string[] = [];
  for (const name of REQUIRED_ENV_VARS) {
    const v = process.env[name];
    if (!v || typeof v !== "string" || !v.trim()) missing.push(name);
  }
  return missing;
}

function getSupabaseUrl(): string {
  const u =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!u) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set.");
  return u;
}

function getAccessToken(req: VercelRequest, supabaseUrl: string): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && /^Bearer\s+/i.test(auth)) {
    return auth.slice(7).trim() || null;
  }
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string") return null;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) return null;
  const name = `sb-${projectRef}-auth-token`;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie);
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1].trim()));
    return typeof parsed?.access_token === "string" ? parsed.access_token : null;
  } catch {
    return null;
  }
}

function errStatus(msg: string, status: number): Error & { status: number } {
  const e = new Error(msg) as Error & { status: number };
  e.status = status;
  return e;
}

async function ensureAuth(
  req: VercelRequest
): Promise<{ userId: string; supabase: SupabaseClient }> {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const token = getAccessToken(req, supabaseUrl);
  if (!token) throw errStatus("Missing or invalid authorization.", 401);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw errStatus("Invalid or expired token.", 401);
  return { userId: user.id, supabase };
}

/* ------------------------------------------------------------------ */
/*  Request parsing                                                    */
/* ------------------------------------------------------------------ */

const SHOT_AREAS = [
  "putting",
  "chipping",
  "pitching",
  "bunker",
  "wedges",
  "driver",
  "mixed",
] as const;
type ShotArea = (typeof SHOT_AREAS)[number];

function isShotArea(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => (SHOT_AREAS as readonly string[]).includes(p));
}

const PRACTICE_AREAS = [
  "driving_range",
  "short_game_area",
  "on_course",
  "indoor_simulator",
] as const;

const MEASUREMENT_METHODS = [
  "launch_monitor",
  "visual_manual",
] as const;

const MEASUREMENT_LEGACY: Record<string, string> = {
  simulator_builtin: "launch_monitor",
  no_measurement: "visual_manual",
};

function isPracticeArea(s: unknown): boolean {
  return typeof s === "string" && (PRACTICE_AREAS as readonly string[]).includes(s);
}

function isMeasurementMethod(s: unknown): boolean {
  if (typeof s !== "string") return false;
  return (MEASUREMENT_METHODS as readonly string[]).includes(s) || s in MEASUREMENT_LEGACY;
}

function normalizeMeasurementMethod(s: string): string {
  return MEASUREMENT_LEGACY[s] ?? s;
}

interface GenerateBody {
  goal?: string;
  hcpInput?: string | null;
  timeMinutes?: number;
  shotArea?: string | null;
  practiceArea?: string | null;
  measurementMethod?: string | null;
  flagDistances?: number[] | null;
}

function parseBody(req: VercelRequest): GenerateBody {
  const raw = typeof req.body === "string" ? req.body : null;
  try {
    const body = raw ? JSON.parse(raw) : req.body ?? {};
    return {
      goal: typeof body.goal === "string" ? body.goal : "",
      hcpInput:
        body.hcpInput == null
          ? null
          : typeof body.hcpInput === "string"
            ? body.hcpInput
            : null,
      timeMinutes:
        typeof body.timeMinutes === "number" ? body.timeMinutes : undefined,
      shotArea:
        body.shotArea != null && isShotArea(body.shotArea)
          ? body.shotArea
          : null,
      practiceArea:
        body.practiceArea != null && isPracticeArea(body.practiceArea)
          ? body.practiceArea
          : null,
      measurementMethod:
        body.measurementMethod != null && isMeasurementMethod(body.measurementMethod)
          ? normalizeMeasurementMethod(body.measurementMethod)
          : null,
      flagDistances:
        Array.isArray(body.flagDistances)
          ? body.flagDistances.filter((d: unknown) => typeof d === "number" && d > 0)
          : null,
    };
  } catch {
    throw errStatus("Invalid JSON body.", 400);
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt building                                                    */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(): string {
  // Validate examples at startup
  for (const ex of coachDrillExamples) {
    const r = drillSchema.safeParse(ex);
    if (!r.success) throw new Error(`Invalid coach example: ${r.error.message}`);
  }

  const examplesJson = JSON.stringify(coachDrillExamples, null, 2);

  return `You are a golf coach creating structured practice drills. Output only valid JSON, no markdown or extra text.

Create exactly ONE drill tuned to the player's HCP band. Adjust distances, targets, and penalties directly — do NOT include a difficulty_by_band object.

TWO DRILL TYPES (discriminator: "drill_type"):

1) "points" — Interactive drill with outcome buttons and distance cycling.
   Required: outcomes (array of {label: string, points: number}, min 2), target_points (number), distances (number[] in meters, min 1), end_condition (string).
   The app renders outcome buttons the player taps after each shot. Distances cycle automatically.
   HOW SCORING WORKS: The player's final score = total shots taken to reach target_points. lower_is_better MUST be true for all points drills (fewer shots = better). Design outcomes so skilled execution earns points fast and poor execution costs points, extending the drill. target_points must always be a positive number.

2) "score_entry" — Simple drill where the player enters a single numeric score at the end.
   Required: score_label (string), prompt (string, the question shown to the player), score_unit (string, optional).
   The app shows the prompt and a number input field.
   GREAT FOR: success-out-of-N drills ("how many out of 10 landed within 3m?"), longest-streak drills, counting drills, distance-estimation drills, up-and-down percentage drills.

Prefer "score_entry" when counting successes, measuring consistency, or tracking a single stat. Prefer "points" when shot-by-shot decisions and varying outcomes matter.

ALL DRILLS require: title, goal, icon (SF Symbol name e.g. "target", "figure.golf", "scope", "flame", "bolt.fill"), time_minutes (5-60), shot_area ("putting"/"chipping"/"pitching"/"bunker"/"wedges"/"driver"/"mixed"), setup_steps (string[], min 2), rules (string[], min 2), lower_is_better (boolean), hcp ({input: string|null, value: number|null, band: HcpBand}).

HCP bands: plus_5_to_0, 0_to_5, 6_to_12, 13_to_20, 21_to_30, 31_plus, no_hcp.

HCP TUNING — adapt ALL of these to the player's band:
- Distances: shorter for higher HCP.
  PUTTING distance guide by HCP:
    31+: 0.5m to 2m (learn to hole short putts consistently)
    21-30: 1m to 3m (build confidence inside 10 feet)
    13-20: 1.5m to 5m (develop mid-range reliability)
    6-12: 2m to 8m (full putting range, introduce speed control)
    0-5: 3m to 12m (tour-level distances, heavy lag component)
    plus: 4m to 16m (elite lag putting + holing from distance)
  OTHER SHOTS: scale proportionally. Higher HCP = shorter.
- Target zone sizes: wider for higher HCP ("within 2 club lengths" vs "within 1 putter length").
- Target points: lower for higher HCP (e.g. 10 vs 20).
- Penalty severity: lighter for higher HCP (-1 vs -3).
- Outcome granularity: 3-4 outcomes for high HCP, 5-6 for low HCP.

PRESSURE MECHANICS — described in the rules array for the player to follow. The app does NOT enforce these automatically.
- For points drills: the app only tracks total points and shot count. Streak bonuses, resets, gates etc. are honor-system rules the player follows. Keep them simple — most players won't track complex state mid-drill. One pressure mechanic per drill is enough.
- For score_entry drills: the player manages the entire drill, so complex mechanics (survival, gates, streaks, resets) work naturally.
- Options: streak bonus, forced reset, par target, negative spiral, score gate, elimination on consecutive misses.

NAMING RULES:
- Title must be specific and evocative. Bad: "Putting Challenge", "Bunker Drill". Good: "Dead-Weight Lag Putts 6-10m", "Splash Zone: Greenside Bunker Precision", "Three-Club Wedge Ladder".
- Include distance range, mechanic, or shot shape in the title when possible.
- NEVER use these exact titles (they are built-in drills): "Short Putt Test", "PGA Tour 18", "Aggressive Putting 4-6m", "Up & Down Putts 6-10m", "Lag Putting Drill 8-20m", "Easy Chip Drill", "Short Game Circuit", "18 Up & Downs", "Approach 40–80m", "Wedge Ladder 60–120m", "Approach 130–180m", "9 Windows Shot Shape", "Driver Control", "Shot Shape Master".

VARIETY — this is CRITICAL. The most common mistake is generating the same drill structure every time.

APP ENGINE CONSTRAINT: For "points" drills, the app has ONE end condition: totalPoints >= target_points. It cannot end on a fixed shot count, when score drops to 0, or on first miss. Complex end conditions MUST use "score_entry" where the player self-manages the drill.

DRILL STRUCTURES FOR "score_entry" (player self-manages, enters a number at the end):
- Survival: fixed distance, start with X points, make/miss adjusts score, ends when eliminated or after N putts. Enter final score.
- Gate drill: putt through a narrow gate (2 tees), hit N putts, enter count that passed through.
- Clock drill: 4+ positions around the hole, progressive distance per position, first miss ends it. Enter consecutive makes.
- Station completion: unique distances, one attempt each, count total strokes (like real golf). Enter total putts.
- Streak challenge: fixed distance, count consecutive makes, miss resets. Enter longest streak.
- Make X before miss Y: e.g. "make 5 before missing 3." Enter total putts needed.
- Uphill/downhill pairs: tally strokes per putt (Holed=0, Inside 1m=1, Outside 1m=2), enter total.
- Success counting: hit N shots, count how many meet a criteria. Enter count.

DRILL STRUCTURES FOR "points" (app shows outcome buttons, cycles distances, ends at target_points):
- Proximity-graded: cycle through distances, 3-5 outcome buttons graded by distance from hole, reach target_points. This is the MOST COMMON pattern — use sparingly.
- Binary make/miss: single distance, 2 outcomes (Holed +N / Missed -N), reach target_points. Simple and high-pressure.
- Weighted difficulty: distances cycle easy→hard, outcome points reflect difficulty, reach target_points.

IMPORTANT: For points drills, the saved score is ALWAYS total shots taken (fewer = better). Therefore lower_is_better MUST be true for ALL points drills. Use score_entry if higher scores are better.

GENERAL VARIETY:
- Use score_entry often — it enables the most diverse drill structures.
- For putting especially, prefer score_entry for variety (survival, gate, clock, streak, station completion all require it).
- Mix pressure mechanics between drills. Don't always default to streak bonus.
- For points drills, consider simple 2-3 outcome buttons (e.g. just "Holed" / "Missed") instead of always using 5-6 proximity tiers.

PUTTING DRILL MECHANICS — vary these across drills to avoid repetition:
- Speed control: uphill vs downhill, lag to a zone, die at the hole vs firm stroke
- Break reading: left-to-right, right-to-left, double-break, choose different slopes each station
- Holing out: binary make/miss from a fixed distance, pressure to hole under consequences
- Distance control: stop within a zone (1 putter-length, 0.5m), two-putt avoidance from long range
- Short putt consistency: 1-2m repeated, clock positions, different breaks same distance
- Start line: gate drills, aim point drills, rail putts along a straight edge
Do NOT always default to "cycle distances + grade by proximity." Many putting drills are about a SINGLE skill (speed OR line OR holing out) rather than general proximity.

SHOT AREA OUTCOME GUIDANCE — use specific, measurable labels. Every label must describe what the ball did, not a generic term:
- putting: "Holed", "Lip-out", "0.5m past", "0.5m short", "1m+ past", "2m+ away"
- chipping: "Inside 1m", "Within 3m", "On green, 3m+", "Missed green", "Thin – ran through", "Fat – came up short"
- pitching: "Within 2m", "Within 5m", "On green, 5m+", "Missed green short", "Thin – low & long", "Fat – short & high"
- bunker: "Within 2m", "On green", "Missed green", "Still in bunker", "Thin – flew over green"
- wedges: "Within 3m", "Within 5m", "On green, 5m+", "Short of green", "Long of green", "Thin – low runner", "Fat – came up short"
- driver: "Fairway center", "Fairway edge", "Light rough", "Deep rough/trees", "OB/lost"

BANNED LABELS (never use): "Mishit", "Misshit", "Duffed", "Skulled", "Chunked", "Good", "Bad", "Poor", "OK", "Good pace", "3-putt range". Instead describe the shot outcome: "Thin – low & long", "Fat – came up short", "Toe – pushed right".

DISTANCE LABELS — NEVER use distance RANGES in outcome labels. Always use a single specific distance.
BAD: "1-2m", "0.6m–1m", "2–3m" (ranges are vague — the player can't tell which button to press).
GOOD: "Within 1m", "1.5m past", "Within 3m", "0.5m short" (one specific distance per label).
If you need to cover a range, use thresholds: "Within 1m" then "Within 2m" then "2m+ away" — NOT "1-2m".

EQUIPMENT RULES:
- NEVER use alignment sticks in putting drills. Use tees, coins, or markers to mark starting positions and distances on the green. Alignment sticks are fine for range/full-swing drills only.

QUALITY RULES:
- No generic tips ("focus on technique", "stay relaxed"). Every step must be actionable.
- Include concrete constraints (distance, width, attempts, target score).
- Distances must be in meters.
- For "points" drills with 3+ outcomes: include a mix of positive, zero, and negative point values. For 2-outcome drills (binary make/miss), use one positive and one negative value — no 0-point needed.
- For "points" drills: lower_is_better MUST be true (saved score = total shots taken). target_points must be a positive number.
- For "score_entry" drills: the prompt must be a clear question answerable with a number. Include total reps or test conditions in the rules.

ENVIRONMENT & EQUIPMENT ADAPTATION — if a practice area or measurement method is specified in the user prompt, adapt the drill accordingly:
- driving_range: Use distance markers and bay width for setup. Distances can be specific (e.g. 87m). Multiple targets available.
- short_game_area: Use flag positions for targets. If specific flag distances are provided, use ONLY those distances in the drill — do not invent distances the player doesn't have flags for.
- on_course: Include hole selection guidance in setup. Use real-course elements (bunkers, slopes, pin positions).
- indoor_simulator: Reference simulator readout in setup. Use simulator-specific metrics (carry distance, spin, launch angle).

Measurement method adaptation:
- launch_monitor: Player has shot tracking (launch monitor, simulator, or similar device). Use precise carry/total distances in outcomes (e.g. "Carry within 2m of target"). Include dispersion metrics.
- visual_manual: Player measures visually (pacing, landing near flags, by eye). Use visual proximity outcomes (e.g. "Within 1 club length of flag", "Past the flag"). Use round distances. Focus on process and observable outcomes.

If no environment is specified, design for a standard driving range with visual measurement (the most common setup).

EXAMPLES (match structure exactly):

${examplesJson}

Output only valid JSON.`;
}

function getHcpContext(band: HcpBand): string {
  switch (band) {
    case "plus_5_to_0":
      return "Elite player. Tour-level distances, tight targets, harsh penalties. 5-6 distinct outcomes.";
    case "0_to_5":
      return "Strong player. Challenging distances, moderate targets. 5-6 outcomes with nuance.";
    case "6_to_12":
      return "Solid mid-handicapper. Standard distances, balanced risk/reward. 4-5 outcomes.";
    case "13_to_20":
      return "Improving player. Moderate distances, achievable targets, encouraging scoring. 4-5 outcomes.";
    case "21_to_30":
      return "Developing player. Shorter distances, wider targets, gentler penalties. 3-4 outcomes.";
    case "31_plus":
      return "Beginner. Very short distances, forgiving targets, focus on fun and repetition. 3-4 simple outcomes.";
    case "no_hcp":
      return "Unknown level. Use moderate difficulty suitable for an average recreational golfer.";
  }
}

function getDrillTypeNudge(shotArea: string | null): string | null {
  if (!shotArea || shotArea === "mixed")
    return "Consider using score_entry drill type for this one.";
  if (shotArea === "bunker" || shotArea === "driver")
    return "A score_entry format (e.g. success count out of N attempts) works well for this shot area.";
  if (shotArea === "putting")
    return "Both drill types work well for putting. Points drills are great for simple make/miss pressure from a fixed distance. Score_entry enables survival, gate, clock, and streak structures. Pick whichever fits the drill concept best.";
  return null;
}

function buildUserPrompt(body: GenerateBody, parsed: ParsedHcp): string {
  const parts: string[] = [];
  parts.push(`Design a practice drill for this goal: ${body.goal || "general short game improvement"}`);
  parts.push(
    `Player: HCP band ${parsed.band}${parsed.input != null ? ` (handicap ${parsed.value})` : ""}. ${getHcpContext(parsed.band)}`
  );
  if (typeof body.timeMinutes === "number")
    parts.push(`Time budget: ${body.timeMinutes} minutes.`);
  if (body.shotArea) {
    if (body.shotArea.includes(",")) {
      const areas = body.shotArea.split(",").map((a) => a.trim());
      parts.push(`Shot areas: ${areas.join(", ")}. Design a drill that incorporates these areas.`);
    } else {
      parts.push(`Shot area: ${body.shotArea}.`);
    }
  }

  // Environment & equipment context
  if (body.practiceArea) {
    const areaDescriptions: Record<string, string> = {
      driving_range: "Driving range with open bays and distance markers on the ground.",
      short_game_area: "Short game practice area with flag targets.",
      on_course: "On-course practice (real holes, real conditions).",
      indoor_simulator: "Indoor simulator environment.",
    };
    parts.push(`Practice area: ${areaDescriptions[body.practiceArea] || body.practiceArea}`);

    if (body.practiceArea === "short_game_area" && body.flagDistances && body.flagDistances.length > 0) {
      const sorted = [...body.flagDistances].sort((a, b) => a - b);
      parts.push(`Available flag distances: ${sorted.join("m, ")}m. Use ONLY these distances for the drill.`);
    }
  }

  if (body.measurementMethod) {
    const measureDescriptions: Record<string, string> = {
      launch_monitor: "Player has shot tracking (launch monitor, simulator, or similar device) — use exact carry distances and dispersion metrics in outcomes.",
      visual_manual: "Player measures visually (pacing, landing near flags) — use visual proximity outcomes (e.g. 'within 3m of flag'). Use round distances. Focus on process and observable outcomes.",
    };
    parts.push(measureDescriptions[body.measurementMethod] || "");
  }

  const nudge = getDrillTypeNudge(body.shotArea ?? null);
  if (nudge) parts.push(nudge);
  parts.push(`Variation seed: ${Math.random().toString(36).slice(2, 6)}`);
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Generation                                                         */
/* ------------------------------------------------------------------ */

async function generateDrill(
  body: GenerateBody,
  parsedHcp: ParsedHcp,
  retryHint?: string
): Promise<Drill> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw errStatus("OPENAI_API_KEY is not set.", 500);

  const openai = new OpenAI({ apiKey: key });

  let userContent = buildUserPrompt(body, parsedHcp);
  if (retryHint) userContent += `\n\n[RETRY] ${retryHint}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userContent },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string")
    throw errStatus("Empty or invalid LLM response.", 500);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw errStatus("LLM response was not valid JSON.", 500);
  }

  const result = drillSchema.safeParse(parsed);
  if (result.success) {
    // Override hcp with the parsed values so the LLM can't hallucinate them
    return {
      ...result.data,
      hcp: {
        input: parsedHcp.input,
        value: parsedHcp.value,
        band: parsedHcp.band,
      },
    } as Drill;
  }

  if (retryHint) throw errStatus("Drill schema validation failed after retry.", 500);
  const hint = buildRetryHint(parsed);
  return generateDrill(body, parsedHcp, hint);
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

function json(res: VercelResponse, status: number, data: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    json(res, 500, { error: "Missing required environment variables.", missing });
    return;
  }

  try {
    const { userId, supabase } = await ensureAuth(req);
    const body = parseBody(req);

    let parsedHcp: ParsedHcp;
    try {
      parsedHcp = parseHcp(body.hcpInput);
    } catch {
      json(res, 400, { error: "Invalid HCP" });
      return;
    }

    const drill = await generateDrill(body, parsedHcp);

    const { data: row, error } = await supabase
      .from("coach_drills")
      .insert({
        coach_id: userId,
        title: drill.title,
        goal: drill.goal,
        payload: drill,
      })
      .select("id")
      .single();

    if (error) {
      console.error(
        "[generate-drill] Supabase insert error:",
        error?.code,
        error?.message,
        error?.details
      );
      json(res, 200, {
        id: null,
        drill,
        saved: false,
        hint: "Drill generated but not saved.",
      });
      return;
    }

    if (!row) {
      console.error("[generate-drill] Supabase insert ok but no row returned");
      json(res, 200, { id: null, drill, saved: false, hint: "Drill generated but not saved." });
      return;
    }

    json(res, 200, { id: row.id, drill, saved: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[generate-drill]", err?.stack ?? err);
    const status = err.status ?? 500;
    const msg =
      status >= 400 && status < 500
        ? (err.message ?? "Bad request.")
        : "Request failed.";
    json(res, status, { error: msg });
  }
}
