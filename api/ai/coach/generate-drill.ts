import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drillSchema, type Drill } from "./drillSchema.ts";
import { coachDrillExamples } from "./coachExamples.ts";
import { parseHcp, type ParsedHcp } from "./hcpBands.ts";

const DRILL_TYPES = ["points", "succeed_fail", "match_play", "team_succeed_fail"] as const;
type DrillType = (typeof DRILL_TYPES)[number];

const REQUIRED_FIELDS_BY_DRILL_TYPE: Record<DrillType, string[]> = {
  points: ["target_points", "scoring", "end_condition"],
  succeed_fail: ["attempts", "success_criteria", "pass_threshold", "fail_rule"],
  match_play: ["match_format", "holes_or_rounds", "win_condition", "scoring"],
  team_succeed_fail: ["team_attempts", "team_success_criteria", "team_pass_threshold", "team_fail_rule"],
};

function isDrillType(s: unknown): s is DrillType {
  return typeof s === "string" && DRILL_TYPES.includes(s as DrillType);
}

function buildRetryHint(attempted: unknown): string {
  const obj = attempted != null && typeof attempted === "object" ? (attempted as Record<string, unknown>) : null;
  const dt = obj && "drill_type" in obj ? obj.drill_type : undefined;
  if (isDrillType(dt)) {
    const required = REQUIRED_FIELDS_BY_DRILL_TYPE[dt];
    const missing = required.filter(
      (k) =>
        !obj ||
        !(k in obj) ||
        obj[k] === undefined ||
        (Array.isArray(obj[k]) && (obj[k] as unknown[]).length === 0)
    );
    const missingClause =
      missing.length > 0
        ? `Missing required fields for drill_type "${dt}": ${missing.join(", ")}. `
        : `drill_type "${dt}" validation failed. Required: ${required.join(", ")}. `;
    return `Schema validation failed. ${missingClause}Include exactly these fields, no hybrid formats. Output only valid JSON.`;
  }
  return `Schema validation failed. Use exactly one drill_type (points, succeed_fail, match_play, team_succeed_fail) and include all required fields for that type. No hybrid formats. Output only valid JSON.`;
}

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
  const u = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!u) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set.");
  return u;
}

const SHOT_AREAS = ["putting", "chipping", "pitching", "bunker", "wedges", "driver", "mixed"] as const;
const LOCATIONS = ["practice_green", "range", "course", "indoor"] as const;
type ShotArea = (typeof SHOT_AREAS)[number];
type Location = (typeof LOCATIONS)[number];

function isShotArea(s: unknown): s is ShotArea {
  return typeof s === "string" && (SHOT_AREAS as readonly string[]).includes(s);
}
function isLocation(s: unknown): s is Location {
  return typeof s === "string" && (LOCATIONS as readonly string[]).includes(s);
}

/** Infer shotArea from goal text (simple keyword rules). */
function inferShotAreaFromGoal(goal: string): ShotArea | null {
  const g = goal.toLowerCase();
  if (/\b(putt|lag|green)\b/.test(g)) return "putting";
  if (/\b(chip|chip-and-run)\b/.test(g)) return "chipping";
  if (/\b(pitch|lob)\b/.test(g)) return "pitching";
  if (/\b(bunker|sand)\b/.test(g)) return "bunker";
  if (/\b(wedge|wedges)\b/.test(g)) return "wedges";
  if (/\b(driver|driving|tee)\b/.test(g)) return "driver";
  if (/\b(short game|variety|mix|mixed)\b/.test(g)) return "mixed";
  return null;
}

/** Infer location from goal text. */
function inferLocationFromGoal(goal: string): Location | null {
  const g = goal.toLowerCase();
  if (/\b(practice green|putting green)\b/.test(g)) return "practice_green";
  if (/\b(range|driving range)\b/.test(g)) return "range";
  if (/\b(course|on-course)\b/.test(g)) return "course";
  if (/\b(indoor|simulator)\b/.test(g)) return "indoor";
  return null;
}

interface GenerateBody {
  goal?: string;
  hcpInput?: string | null;
  timeMinutes?: number;
  shotArea?: string | null;
  location?: string | null;
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

async function ensureAuth(req: VercelRequest): Promise<{ userId: string; supabase: SupabaseClient }> {
  const supabaseUrl = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = getAccessToken(req, supabaseUrl);
  if (!token) throw errStatus("Missing or invalid authorization.", 401);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw errStatus("Invalid or expired token.", 401);
  return { userId: user.id, supabase };
}

function parseBody(req: VercelRequest): GenerateBody {
  const raw = typeof req.body === "string" ? req.body : null;
  try {
    const body = raw ? JSON.parse(raw) : req.body ?? {};
    const hcpInput = body.hcpInput;
    const shotArea = body.shotArea;
    const location = body.location;
    return {
      goal: typeof body.goal === "string" ? body.goal : "",
      hcpInput:
        hcpInput == null
          ? null
          : typeof hcpInput === "string"
            ? hcpInput
            : null,
      timeMinutes: typeof body.timeMinutes === "number" ? body.timeMinutes : undefined,
      shotArea:
        shotArea == null
          ? null
          : typeof shotArea === "string" && isShotArea(shotArea)
            ? shotArea
            : null,
      location:
        location == null
          ? null
          : typeof location === "string" && isLocation(location)
            ? location
            : null,
    };
  } catch {
    throw errStatus("Invalid JSON body.", 400);
  }
}

const KEYWORDS_BY_SHOT_AREA: Record<ShotArea, string[]> = {
  putting: ["putt", "putting", "lag", "green"],
  chipping: ["chip", "chipping"],
  pitching: ["pitch", "pitching", "lob"],
  bunker: ["bunker", "sand"],
  wedges: ["wedge", "wedges"],
  driver: ["driver", "driving", "tee"],
  mixed: ["variety", "mixed", "circuit", "short game"],
};

async function retrieveDrills(
  supabase: SupabaseClient,
  shotArea: ShotArea | null
): Promise<{ title: string; goal: string; drill_type: string; setup: string[]; rules: string[]; scoring: string[] }[]> {
  if (!shotArea) return [];
  const keywords = KEYWORDS_BY_SHOT_AREA[shotArea];
  const { data: rows, error } = await supabase
    .from("coach_drills")
    .select("id, title, goal, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !rows?.length) return [];
  const lower = (s: string) => s.toLowerCase();
  const matched = rows.filter((r) => {
    const t = lower(String(r.title ?? ""));
    const g = lower(String(r.goal ?? ""));
    const text = `${t} ${g}`;
    return keywords.some((kw) => text.includes(kw));
  });
  const out: { title: string; goal: string; drill_type: string; setup: string[]; rules: string[]; scoring: string[] }[] = [];
  for (let i = 0; i < Math.min(5, matched.length); i++) {
    const r = matched[i];
    const p = (r.payload as Record<string, unknown>) ?? {};
    const title = String(p.title ?? r.title ?? "");
    const goal = String(p.goal ?? r.goal ?? "");
    const drill_type = String(p.drill_type ?? "points");
    const setup = Array.isArray(p.setup_steps) ? (p.setup_steps as string[]).slice(0, 5) : [];
    const rules = Array.isArray(p.rules) ? (p.rules as string[]).slice(0, 5) : [];
    const scoring = Array.isArray(p.scoring) ? (p.scoring as string[]).slice(0, 6) : [];
    out.push({ title, goal, drill_type, setup, rules, scoring });
  }
  return out;
}

function formatRetrievedSummaries(
  drills: { title: string; goal: string; drill_type: string; setup: string[]; rules: string[]; scoring: string[] }[]
): string {
  if (!drills.length) return "";
  const blocks = drills.map(
    (d) =>
      `- "${d.title}" (${d.drill_type}): ${d.goal.slice(0, 120)}${d.goal.length > 120 ? "…" : ""}. Setup: ${d.setup.join("; ")}. Rules: ${d.rules.join("; ")}. Scoring: ${d.scoring.join("; ")}.`
  );
  return `RETRIEVED DRILLS (use as inspiration; output must still match schema exactly):\n${blocks.join("\n")}\n`;
}

function buildSystemPrompt(retrievedSummaries = ""): string {
  for (const ex of coachDrillExamples) {
    const r = drillSchema.safeParse(ex);
    if (!r.success) throw new Error(`Invalid coach example: ${r.error.message}`);
  }
  const examplesJson = JSON.stringify(coachDrillExamples, null, 2);
  const retrievedBlock = retrievedSummaries ? `\n${retrievedSummaries}\n` : "";
  return `You are a golf coach creating structured practice drills. Output only valid JSON, no markdown or extra text.

STRICT TEMPLATES: The drill MUST follow the exact template for the requested drill_type. Missing any required field is an error. No hybrid formats—use only the fields defined for that drill_type.

Create play-like drills with clear scoring, pressure, and repeatable setup. Output exactly one of four drill types (discriminator: "drill_type"). Use the same key names and structure as the examples.

QUALITY RULES:
- No generic tips (avoid "focus on technique", "stay relaxed", etc.).
- Every setup/rule/scoring line must be actionable and testable.
- Must include at least one pressure mechanic (reset, penalty, bonus, timer, streak).
- Must include concrete constraints (distance, width, stations, attempts, or timebox).
- Keep output JSON only and match examples' style.

BASE (all drills):
- title: string. goal: string. time_minutes: number (5–60).
- mode: "singles" | "teams".
- setup_steps: string[] (min 3). rules: string[] (min 4). log_fields: string[].
- hcp: { input: string | null, value: number | null, band: HcpBand }. Use the user's HCP band; input = raw string (e.g. "18", "+2"), value = numeric HCP (negative for plus).
- recommended_hcp_bands: HcpBand[] (min 1). difficulty_by_band: exactly one entry per band (all 7). Each value: { changes: string[], target: string }.

HCP bands: plus_5_to_0, 0_to_5, 6_to_12, 13_to_20, 21_to_30, 31_plus, no_hcp.

Always tune the main drill parameters to the user's hcp_band. Always fill difficulty_by_band for all 7 bands. If band is no_hcp, keep the drill beginner-friendly and reduce penalties.

CONDITIONAL (required per drill_type—all must be present):

1) drill_type "points": target_points (number), scoring (string[], min 3 +/- rules), end_condition (string).

2) drill_type "succeed_fail": attempts (number), success_criteria (string), pass_threshold (number), fail_rule (string). scoring optional; if present, min 1.

3) drill_type "match_play": match_format (string), holes_or_rounds (number), win_condition (string), scoring (string[], min 3 match-play rules).

4) drill_type "team_succeed_fail": team_attempts (number), team_success_criteria (string), team_pass_threshold (number), team_fail_rule (string). Use mode "teams".
${retrievedBlock}
EXAMPLES (match structure and quality exactly)

${examplesJson}

Output only valid JSON. No markdown, no code fences, no extra text.`;
}

function resolveShotContext(body: GenerateBody): { shotArea: ShotArea | null; location: Location | null } {
  const goal = body.goal ?? "";
  return {
    shotArea: body.shotArea ?? inferShotAreaFromGoal(goal),
    location: body.location ?? inferLocationFromGoal(goal),
  };
}

function buildUserPrompt(
  body: GenerateBody,
  parsed: ParsedHcp,
  shotContext: { shotArea: ShotArea | null; location: Location | null }
): string {
  const parts: string[] = ["Create a golf drill."];
  if (body.goal) parts.push(`Goal: ${body.goal}`);
  parts.push(
    `Player HCP band: ${parsed.band}${parsed.input != null ? ` (HCP input "${parsed.input}", value ${parsed.value})` : " (no HCP provided)"}.`
  );
  if (typeof body.timeMinutes === "number") parts.push(`Duration: about ${body.timeMinutes} minutes.`);
  if (shotContext.shotArea) parts.push(`Shot area: ${shotContext.shotArea}.`);
  if (shotContext.location) parts.push(`Location: ${shotContext.location}.`);
  return parts.join("\n");
}

async function generateDrill(
  body: GenerateBody,
  parsedHcp: ParsedHcp,
  supabase: SupabaseClient,
  retryHint?: string
): Promise<Drill> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw errStatus("OPENAI_API_KEY is not set.", 500);
  const openai = new OpenAI({ apiKey: key });
  const shotContext = resolveShotContext(body);
  const retrieved = await retrieveDrills(supabase, shotContext.shotArea);
  const retrievedBlock = formatRetrievedSummaries(retrieved);
  let userContent = buildUserPrompt(body, parsedHcp, shotContext);
  if (retryHint) userContent += `\n\n[RETRY] ${retryHint}`;
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(retrievedBlock) },
      { role: "user", content: userContent },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw errStatus("Empty or invalid LLM response.", 500);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw errStatus("LLM response was not valid JSON.", 500);
  }
  const result = drillSchema.safeParse(parsed);
  if (result.success) {
    const drill = {
      ...result.data,
      hcp: {
        input: parsedHcp.input,
        value: parsedHcp.value,
        band: parsedHcp.band,
      },
    } as Drill;
    return drill;
  }
  if (retryHint) throw errStatus("Drill schema validation failed after retry.", 500);
  const hint = buildRetryHint(parsed);
  return generateDrill(body, parsedHcp, supabase, hint);
}

function json(res: VercelResponse, status: number, data: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    json(res, 500, {
      error: "Missing required environment variables.",
      missing,
    });
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
    const drill = await generateDrill(body, parsedHcp, supabase);
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
      console.error("[generate-drill] Supabase insert error:", error?.code, error?.message, error?.details);
      json(res, 200, {
        id: null,
        drill,
        saved: false,
        hint: "Drill generated but not saved. Run: npx supabase db push. Check server logs for details.",
      });
      return;
    }
    if (!row) {
      console.error("[generate-drill] Supabase insert ok but no row returned");
      json(res, 200, {
        id: null,
        drill,
        saved: false,
        hint: "Drill generated but not saved. Run: npx supabase db push.",
      });
      return;
    }
    json(res, 200, { id: row.id, drill, saved: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    console.error("[generate-drill]", err?.stack ?? err);
    const status = err.status ?? 500;
    const msg = status >= 400 && status < 500 ? (err.message ?? "Bad request.") : "Request failed.";
    json(res, status, { error: msg });
  }
}
