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

function isShotArea(s: unknown): s is ShotArea {
  return typeof s === "string" && (SHOT_AREAS as readonly string[]).includes(s);
}

interface GenerateBody {
  goal?: string;
  hcpInput?: string | null;
  timeMinutes?: number;
  shotArea?: string | null;
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
   HOW SCORING WORKS: The player's final score = total shots taken to reach target_points. lower_is_better is almost always true (fewer shots = better). Design outcomes so skilled execution earns points fast and poor execution costs points, extending the drill.

2) "score_entry" — Simple drill where the player enters a single numeric score at the end.
   Required: score_label (string), prompt (string, the question shown to the player), score_unit (string, optional).
   The app shows the prompt and a number input field.
   GREAT FOR: success-out-of-N drills ("how many out of 10 landed within 3m?"), longest-streak drills, counting drills, distance-estimation drills, up-and-down percentage drills.

Prefer "score_entry" when counting successes, measuring consistency, or tracking a single stat. Prefer "points" when shot-by-shot decisions and varying outcomes matter.

ALL DRILLS require: title, goal, icon (SF Symbol name e.g. "target", "figure.golf", "scope", "flame", "bolt.fill"), time_minutes (5-60), shot_area ("putting"/"chipping"/"pitching"/"bunker"/"wedges"/"driver"/"mixed"), setup_steps (string[], min 2), rules (string[], min 2), lower_is_better (boolean), hcp ({input: string|null, value: number|null, band: HcpBand}).

HCP bands: plus_5_to_0, 0_to_5, 6_to_12, 13_to_20, 21_to_30, 31_plus, no_hcp.

HCP TUNING — adapt ALL of these to the player's band:
- Distances: shorter for higher HCP. A 25-HCP putting drill uses 2m/3m/4m; a 5-HCP uses 5m/7m/9m.
- Target zone sizes: wider for higher HCP ("within 2 club lengths" vs "within 1 putter length").
- Target points: lower for higher HCP (e.g. 10 vs 20).
- Penalty severity: lighter for higher HCP (-1 vs -3).
- Outcome granularity: 3-4 outcomes for high HCP, 5-6 for low HCP.

PRESSURE MECHANICS — every drill MUST include at least one. Vary across drills:
- Streak bonus: extra points for consecutive successes.
- Forced reset: miss N in a row and score resets to zero or halves.
- Escalating difficulty: distances increase after every few made shots.
- Par target: "reach X points in under Y shots or restart."
- Negative spiral: each miss costs 1 more point than the last.
- Bonus round: after reaching target, 3 bonus shots at double points.
- Score gate: must reach X points before shot Y or restart.

NAMING RULES:
- Title must be specific and evocative. Bad: "Putting Challenge", "Bunker Drill". Good: "Dead-Weight Lag Putts 6-10m", "Splash Zone: Greenside Bunker Precision", "Three-Club Wedge Ladder".
- Include distance range, mechanic, or shot shape in the title when possible.

SHOT AREA OUTCOME GUIDANCE — use area-specific labels, not generic "Good"/"Bad":
- putting: "Holed", "Lip-out", "Good pace but missed", "Short", "3-putt range"
- chipping: "Inside 1m", "On green within 3m", "On green but far", "Missed green", "Skulled/chunked"
- pitching: "Landed in target zone", "Correct trajectory wrong distance", "Wrong trajectory", "Duffed"
- bunker: "Out and within 2m", "Out and on green", "Still in bunker", "Thinned over green"
- wedges: "Pin high within 3m", "On green correct distance", "On green wrong distance", "Short/long of green"
- driver: "Fairway center", "Fairway edge", "Light rough", "Deep trouble", "OB"

QUALITY RULES:
- No generic tips ("focus on technique", "stay relaxed"). Every step must be actionable.
- Include concrete constraints (distance, width, attempts, target score).
- Distances must be in meters.
- For "points" drills: outcomes must have a mix of positive and negative points. Include at least one 0-point outcome (mediocre result).
- For "score_entry" drills: the prompt must be a clear question answerable with a number. Include total reps or test conditions in the rules.

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
  if (body.shotArea) parts.push(`Shot area: ${body.shotArea}.`);
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
