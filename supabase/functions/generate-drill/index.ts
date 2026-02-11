import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3.22.4"

/* ------------------------------------------------------------------ */
/*  CORS                                                               */
/* ------------------------------------------------------------------ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/* ------------------------------------------------------------------ */
/*  HCP Bands                                                          */
/* ------------------------------------------------------------------ */

const HCP_BANDS = [
  "plus_5_to_0",
  "0_to_5",
  "6_to_12",
  "13_to_20",
  "21_to_30",
  "31_plus",
  "no_hcp",
] as const

type HcpBand = (typeof HCP_BANDS)[number]

function getHcpBand(value: number | null | undefined): HcpBand {
  if (value == null || typeof value !== "number") return "no_hcp"
  if (value < 0) return "plus_5_to_0"
  if (value <= 5) return "0_to_5"
  if (value <= 12) return "6_to_12"
  if (value <= 20) return "13_to_20"
  if (value <= 30) return "21_to_30"
  return "31_plus"
}

interface ParsedHcp {
  input: string | null
  value: number | null
  band: HcpBand
}

function parseHcp(hcpInput: string | null | undefined): ParsedHcp {
  const raw = typeof hcpInput === "string" ? hcpInput.trim() : ""
  if (raw === "") return { input: null, value: null, band: "no_hcp" }
  if (raw.startsWith("+")) {
    const rest = raw.slice(1).trim()
    const num = parseFloat(rest)
    if (rest === "" || !Number.isFinite(num) || num < 0)
      throw new Error("Invalid HCP")
    const value = -num
    return { input: raw, value, band: getHcpBand(value) }
  }
  const num = parseFloat(raw)
  if (!Number.isFinite(num) || num < 0) throw new Error("Invalid HCP")
  return { input: raw, value: num, band: getHcpBand(num) }
}

/* ------------------------------------------------------------------ */
/*  Drill Schema (Zod)                                                 */
/* ------------------------------------------------------------------ */

const hcpBandSchema = z.enum(HCP_BANDS)

const outcomeSchema = z.object({
  label: z.string(),
  points: z.number(),
})

const baseSchema = z.object({
  title: z.string(),
  goal: z.string(),
  icon: z.string().optional(),
  time_minutes: z.number().min(5).max(60),
  shot_area: z.string(),
  setup_steps: z.array(z.string()).min(2),
  rules: z.array(z.string()).min(2),
  lower_is_better: z.boolean(),
  hcp: z.object({
    input: z.string().nullable(),
    value: z.number().nullable(),
    band: hcpBandSchema,
  }),
})

const pointsDrillSchema = baseSchema.extend({
  drill_type: z.literal("points"),
  outcomes: z.array(outcomeSchema).min(2),
  target_points: z.number(),
  distances: z.array(z.number()).min(1),
  end_condition: z.string(),
})

const scoreEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("score_entry"),
  score_label: z.string(),
  score_unit: z.string().optional(),
  prompt: z.string(),
})

const drillSchema = z.discriminatedUnion("drill_type", [
  pointsDrillSchema,
  scoreEntryDrillSchema,
])

type Drill = z.infer<typeof drillSchema>

/* ------------------------------------------------------------------ */
/*  Few-shot Examples                                                  */
/* ------------------------------------------------------------------ */

const coachDrillExamples = [
  {
    drill_type: "points",
    title: "Aggressive Putting 4-6m",
    goal: "Become a more aggressive putter within 6 meters with good speed control.",
    icon: "target",
    time_minutes: 15,
    shot_area: "putting",
    setup_steps: [
      "Place a hole on a flat section of the practice green.",
      "Mark three distances: 4m, 5m, and 6m from the hole.",
      "Use a different spot for every putt.",
    ],
    rules: [
      "Distances cycle: 4m → 5m → 6m → repeat.",
      "Choose a different spot for every putt.",
      "Reach 15 points to finish. Score = total putts taken (fewer is better).",
      "Short putts and missed return putts incur heavy penalties.",
    ],
    outcomes: [
      { label: "Holed", points: 3 },
      { label: "Good Pace", points: 1 },
      { label: "Long + Made", points: 0 },
      { label: "Short", points: -3 },
      { label: "Long + Miss", points: -3 },
      { label: "4-Putt+", points: -5 },
    ],
    target_points: 15,
    distances: [4, 5, 6],
    end_condition: "Drill ends when you reach 15 points.",
    lower_is_better: true,
    hcp: { input: "15", value: 15, band: "13_to_20" },
  },
  {
    drill_type: "score_entry",
    title: "Easy Chip Drill",
    goal: "Build consistency on simple chip shots from a fairway lie.",
    icon: "figure.golf",
    time_minutes: 10,
    shot_area: "chipping",
    setup_steps: [
      "Find a flat fairway lie about 10 meters from a hole.",
      "Use one wedge for all chips.",
    ],
    rules: [
      "Chip from 10m from a fairway lie.",
      "Count consecutive chips stopping within one wedge length of the hole.",
      "One miss resets the streak.",
    ],
    score_label: "Consecutive Chips",
    score_unit: "chips",
    prompt:
      "How many chips in a row stopped within one wedge length of the hole?",
    lower_is_better: false,
    hcp: { input: "15", value: 15, band: "13_to_20" },
  },
  {
    drill_type: "score_entry",
    title: "Fairway Finder: 10-Ball Dispersion Test",
    goal: "Test driving accuracy under pressure with a 10-shot sample.",
    icon: "scope",
    time_minutes: 15,
    shot_area: "driver",
    setup_steps: [
      "Set up on the range with a target fairway corridor about 25m wide.",
      "Place an alignment stick at your target line.",
      "Mark fairway boundaries with two objects 12.5m either side of center.",
    ],
    rules: [
      "Hit 10 drives aiming at the target corridor.",
      "Count only drives that land or finish within the 25m fairway corridor.",
      "You must score at least 7/10 to pass the drill.",
      "If you score under 5, narrow the corridor to 20m next session.",
    ],
    score_label: "Fairways Hit",
    score_unit: "out of 10",
    prompt:
      "How many of your 10 drives finished within the fairway corridor?",
    lower_is_better: false,
    hcp: { input: "4", value: 4, band: "0_to_5" },
  },
  {
    drill_type: "points",
    title: "Bunker Escape Artist",
    goal: "Build confidence getting out of greenside bunkers on the first attempt.",
    icon: "flame",
    time_minutes: 10,
    shot_area: "bunker",
    setup_steps: [
      "Find a greenside bunker with a flat lie.",
      "Place a towel on the green about 5m from the bunker edge as your target.",
      "Drop balls in the bunker with a reasonable lie for each shot.",
    ],
    rules: [
      "Hit bunker shots aiming for the towel on the green.",
      "Reach 10 points to complete the drill.",
      "Streak bonus: 2 'Out and close' results in a row earns +2 bonus points.",
      "If you leave 3 balls in the bunker during the drill, restart from 0 points.",
    ],
    outcomes: [
      { label: "Out and within 2m of towel", points: 3 },
      { label: "Out and on green", points: 1 },
      { label: "Out but missed green", points: 0 },
      { label: "Still in bunker", points: -2 },
    ],
    target_points: 10,
    distances: [5],
    end_condition: "Drill ends when you reach 10 points.",
    lower_is_better: true,
    hcp: { input: "26", value: 26, band: "21_to_30" },
  },
]

// Validate examples at load time
for (const ex of coachDrillExamples) {
  const r = drillSchema.safeParse(ex)
  if (!r.success) throw new Error(`Invalid coach example: ${r.error.message}`)
}

/* ------------------------------------------------------------------ */
/*  Retry hint builder                                                 */
/* ------------------------------------------------------------------ */

const DRILL_TYPES = ["points", "score_entry"] as const
type DrillType = (typeof DRILL_TYPES)[number]

const REQUIRED_FIELDS: Record<DrillType, string[]> = {
  points: ["outcomes", "target_points", "distances", "end_condition"],
  score_entry: ["score_label", "prompt"],
}

function isDrillType(s: unknown): s is DrillType {
  return typeof s === "string" && DRILL_TYPES.includes(s as DrillType)
}

function buildRetryHint(attempted: unknown): string {
  const obj =
    attempted != null && typeof attempted === "object"
      ? (attempted as Record<string, unknown>)
      : null
  const dt = obj && "drill_type" in obj ? obj.drill_type : undefined

  if (isDrillType(dt)) {
    const required = REQUIRED_FIELDS[dt]
    const missing = required.filter(
      (k) =>
        !obj ||
        !(k in obj) ||
        obj[k] === undefined ||
        (Array.isArray(obj[k]) && (obj[k] as unknown[]).length === 0)
    )
    const clause =
      missing.length > 0
        ? `Missing fields for "${dt}": ${missing.join(", ")}. `
        : `"${dt}" validation failed. Required: ${required.join(", ")}. `
    return `Schema validation failed. ${clause}Output only valid JSON.`
  }
  return `Schema validation failed. drill_type must be "points" or "score_entry". Include all required fields. Output only valid JSON.`
}

/* ------------------------------------------------------------------ */
/*  Prompt building                                                    */
/* ------------------------------------------------------------------ */

const SHOT_AREAS = [
  "putting",
  "chipping",
  "pitching",
  "bunker",
  "wedges",
  "driver",
  "mixed",
] as const

function isShotArea(s: unknown): boolean {
  return typeof s === "string" && (SHOT_AREAS as readonly string[]).includes(s)
}

function buildSystemPrompt(): string {
  const examplesJson = JSON.stringify(coachDrillExamples, null, 2)

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

Output only valid JSON.`
}

function getHcpContext(band: HcpBand): string {
  switch (band) {
    case "plus_5_to_0":
      return "Elite player. Tour-level distances, tight targets, harsh penalties. 5-6 distinct outcomes."
    case "0_to_5":
      return "Strong player. Challenging distances, moderate targets. 5-6 outcomes with nuance."
    case "6_to_12":
      return "Solid mid-handicapper. Standard distances, balanced risk/reward. 4-5 outcomes."
    case "13_to_20":
      return "Improving player. Moderate distances, achievable targets, encouraging scoring. 4-5 outcomes."
    case "21_to_30":
      return "Developing player. Shorter distances, wider targets, gentler penalties. 3-4 outcomes."
    case "31_plus":
      return "Beginner. Very short distances, forgiving targets, focus on fun and repetition. 3-4 simple outcomes."
    case "no_hcp":
      return "Unknown level. Use moderate difficulty suitable for an average recreational golfer."
  }
}

function getDrillTypeNudge(shotArea: string | null): string | null {
  if (!shotArea || shotArea === "mixed")
    return "Consider using score_entry drill type for this one."
  if (shotArea === "bunker" || shotArea === "driver")
    return "A score_entry format (e.g. success count out of N attempts) works well for this shot area."
  return null
}

interface GenerateBody {
  goal?: string
  hcpInput?: string | null
  timeMinutes?: number
  shotArea?: string | null
}

function buildUserPrompt(body: GenerateBody, parsed: ParsedHcp): string {
  const parts: string[] = []
  parts.push(
    `Design a practice drill for this goal: ${body.goal || "general short game improvement"}`
  )
  parts.push(
    `Player: HCP band ${parsed.band}${parsed.input != null ? ` (handicap ${parsed.value})` : ""}. ${getHcpContext(parsed.band)}`
  )
  if (typeof body.timeMinutes === "number")
    parts.push(`Time budget: ${body.timeMinutes} minutes.`)
  if (body.shotArea) parts.push(`Shot area: ${body.shotArea}.`)
  const nudge = getDrillTypeNudge(body.shotArea ?? null)
  if (nudge) parts.push(nudge)
  parts.push(`Variation seed: ${Math.random().toString(36).slice(2, 6)}`)
  return parts.join("\n")
}

/* ------------------------------------------------------------------ */
/*  OpenAI call                                                        */
/* ------------------------------------------------------------------ */

async function callAI(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("OpenAI error:", res.status, text)
    throw new Error(`OpenAI returned ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content || typeof content !== "string")
    throw new Error("Empty or invalid AI response")
  return content
}

/* ------------------------------------------------------------------ */
/*  Drill generation with retry                                        */
/* ------------------------------------------------------------------ */

async function generateDrill(
  body: GenerateBody,
  parsedHcp: ParsedHcp,
  retryHint?: string
): Promise<Drill> {
  const systemPrompt = buildSystemPrompt()
  let userContent = buildUserPrompt(body, parsedHcp)
  if (retryHint) userContent += `\n\n[RETRY] ${retryHint}`

  const raw = await callAI(systemPrompt, userContent)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("AI response was not valid JSON")
  }

  const result = drillSchema.safeParse(parsed)
  if (result.success) {
    return {
      ...result.data,
      hcp: {
        input: parsedHcp.input,
        value: parsedHcp.value,
        band: parsedHcp.band,
      },
    } as Drill
  }

  if (retryHint) throw new Error("Drill schema validation failed after retry")
  const hint = buildRetryHint(parsed)
  return generateDrill(body, parsedHcp, hint)
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405)
  }

  try {
    // Auth: extract Bearer token and validate
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing Supabase configuration." }, 500)
    }

    const auth = req.headers.get("authorization")
    const token =
      auth && /^Bearer\s+/i.test(auth) ? auth.slice(7).trim() : null
    if (!token) {
      return json({ error: "Missing or invalid authorization." }, 401)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return json({ error: "Invalid or expired token." }, 401)
    }

    // Parse body
    const rawBody = await req.json()
    const body: GenerateBody = {
      goal: typeof rawBody.goal === "string" ? rawBody.goal : "",
      hcpInput:
        rawBody.hcpInput == null
          ? null
          : typeof rawBody.hcpInput === "string"
            ? rawBody.hcpInput
            : null,
      timeMinutes:
        typeof rawBody.timeMinutes === "number"
          ? rawBody.timeMinutes
          : undefined,
      shotArea:
        rawBody.shotArea != null && isShotArea(rawBody.shotArea)
          ? rawBody.shotArea
          : null,
    }

    // Parse HCP
    let parsedHcp: ParsedHcp
    try {
      parsedHcp = parseHcp(body.hcpInput)
    } catch {
      return json({ error: "Invalid HCP" }, 400)
    }

    // Generate drill
    const drill = await generateDrill(body, parsedHcp)

    // Save to database
    const { data: row, error: insertError } = await supabase
      .from("coach_drills")
      .insert({
        coach_id: user.id,
        title: drill.title,
        goal: drill.goal,
        payload: drill,
      })
      .select("id")
      .single()

    if (insertError) {
      console.error(
        "[generate-drill] Supabase insert error:",
        insertError.code,
        insertError.message,
        insertError.details
      )
      return json({
        id: null,
        drill,
        saved: false,
        hint: "Drill generated but not saved.",
      })
    }

    if (!row) {
      console.error("[generate-drill] Supabase insert ok but no row returned")
      return json({
        id: null,
        drill,
        saved: false,
        hint: "Drill generated but not saved.",
      })
    }

    return json({ id: row.id, drill, saved: true })
  } catch (error: unknown) {
    console.error("[generate-drill]", error)
    const msg =
      error instanceof Error ? error.message : "Unknown error occurred"
    return json({ error: msg }, 500)
  }
})
