// format-drill
//
// Build-a-Drill flow: AI is a FORMATTER ONLY. The user describes their drill
// in plain English (often with specific distances, counts, rules) and picks
// the scoring method. The AI's ONLY jobs are:
//   1. Structure the description into numbered setup_steps + rules.
//   2. Configure the score-entry UI for the user's chosen scoring_method.
//   3. Ask ONE clarifying question if something critical is ambiguous.
//
// It MUST NOT add stations, distances, points, variations, or rules the user
// did not describe. If the user only mentioned one distance, the drill has
// one distance — never invented variations.
//
// Returns either:
//   { clarifying_question: string }   — when something critical is missing
//   { drill: CoachDrill }             — when formatting succeeded
// Never inserts. Save happens client-side via the existing CoachDrillManager.
//
// Rate limit: shared pool with generate-drill / generate-level via
// coach_drill_generations (10/day regular, 50/day coaches), kind='format_drill'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
/* ------------------------------------------------------------------ */ /*  HCP bands (mirror generate-drill)                                  */ /* ------------------------------------------------------------------ */ const HCP_BANDS = [
  "plus_5_to_0",
  "0_to_5",
  "6_to_12",
  "13_to_20",
  "21_to_30",
  "31_plus",
  "no_hcp"
];
function getHcpBand(value) {
  if (value == null || typeof value !== "number") return "no_hcp";
  if (value < 0) return "plus_5_to_0";
  if (value <= 5) return "0_to_5";
  if (value <= 12) return "6_to_12";
  if (value <= 20) return "13_to_20";
  if (value <= 30) return "21_to_30";
  return "31_plus";
}
/// The Build-a-Drill form lets the user pick a single HCP point or a small
/// band. We pass the *midpoint* of low/high to the band classifier so the
/// metadata reflects the user's intent (which HCP this drill is tuned for),
/// even though the AI isn't allowed to use HCP to invent challenge content.
function bandFromRange(low, high) {
  if (low == null && high == null) return "no_hcp";
  if (low != null && high != null) return getHcpBand((low + high) / 2);
  return getHcpBand(low ?? high ?? null);
}
/* ------------------------------------------------------------------ */ /*  Request body                                                       */ /* ------------------------------------------------------------------ */ const shotAreaSchema = z.enum([
  "putting",
  "chipping",
  "pitching",
  "bunker",
  "wedges",
  "driver",
  "mixed"
]);
/// What the user picked in the Build-a-Drill form. Each maps deterministically
/// to a drill_type so the AI doesn't get to choose the score-entry UI shape.
/// The single exception is "ai_decide" — for users who don't know what they
/// want and trust the model to pick the most natural fit.
const scoringMethodSchema = z.enum([
  "points",
  "makes_count",
  "in_a_row",
  "distance_to_pin",
  "total_strokes",
  "ai_decide"
]);
const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(2000),
  shot_area: shotAreaSchema,
  scoring_method: scoringMethodSchema,
  length_minutes: z.number().int().min(5).max(60).nullish(),
  hcp_low: z.number().nullish(),
  hcp_high: z.number().nullish(),
  clarification_answer: z.string().trim().max(1000).nullish()
});
/* ------------------------------------------------------------------ */ /*  AI output schema                                                   */ /*                                                                     */ /*  Either ask a clarifying question OR return a drill. The drill is a */ /*  reduced subset of generate-drill's CoachDrill schema — only the    */ /*  three drill_types reachable via the Build-a-Drill scoring methods. */ /* ------------------------------------------------------------------ */ const hcpBandSchema = z.enum(HCP_BANDS);
const outcomeSchema = z.object({
  label: z.string().max(35),
  points: z.number()
});
const baseSchema = z.object({
  title: z.string().max(60),
  goal: z.string().max(150),
  icon: z.string().optional(),
  time_minutes: z.number().min(5).max(60),
  shot_area: z.string(),
  setup_steps: z.array(z.string()).min(1),
  rules: z.array(z.string()).min(1),
  lower_is_better: z.boolean(),
  hcp: z.object({
    input: z.string().nullable(),
    value: z.number().nullable(),
    band: hcpBandSchema
  })
});
const pointsDrillSchema = baseSchema.extend({
  drill_type: z.literal("points"),
  outcomes: z.array(outcomeSchema).min(2).refine((outcomes)=>outcomes.some((o)=>o.points > 0), {
    message: "At least one outcome must have positive points"
  }),
  target_points: z.number().min(1),
  distances: z.array(z.number()).min(1),
  end_condition: z.string()
});
const scoreEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("score_entry"),
  score_label: z.string(),
  score_unit: z.string().optional(),
  prompt: z.string()
});
// Build-a-Drill's only station use is distance_to_pin, which is a continuous
// measurement, not a discrete rating. The app enters it with a decimal pad per
// station (measurement mode), so we emit unit + step rather than a min/max
// chip range.
const stationEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("station_entry"),
  stations: z.array(z.number()).min(1),
  station_score_mode: z.literal("measurement"),
  station_score_unit: z.string().max(10),
  station_score_step: z.number().positive().max(5),
  station_score_label: z.string().max(40)
});
const drillSchema = z.discriminatedUnion("drill_type", [
  pointsDrillSchema,
  scoreEntryDrillSchema,
  stationEntryDrillSchema
]);
const aiOutputSchema = z.union([
  z.object({
    clarifying_question: z.string().trim().min(5).max(280)
  }),
  z.object({
    drill: drillSchema
  })
]);
/* ------------------------------------------------------------------ */ /*  Prompt                                                             */ /* ------------------------------------------------------------------ */ function buildSystemPrompt() {
  return `You FORMAT a golf practice drill into structured JSON. The user has already designed the drill — your job is wording polish and UI configuration, NOT design. Output valid JSON only. No markdown, no commentary.

ROLE: FORMATTER, NOT DESIGNER
- The user's description is authoritative. Preserve every distance, count, time limit, position, club, and rule EXACTLY.
- Do NOT invent stations, distances, point values, outcomes, rules, variations, or anything else the user did not describe.
- Do NOT add "warm-up" steps, "track your progress" steps, or generic golf advice.
- Do NOT add technique tips ("focus on", "stay relaxed", "trust your stroke").
- If the user only mentioned one distance, the drill has one distance. If the user mentioned one type of outcome, the drill has one outcome (plus a natural negative if relevant — e.g. "make" implies "miss").
- The handicap info is metadata about who this drill is tuned for. It is NOT a license to adjust difficulty or invent content.

CLARIFICATION POLICY
- If the description is missing information you literally cannot proceed without, return ONLY: { "clarifying_question": "..." }
- Ask ONE question. Make it specific and answerable in one sentence.
- DO NOT ask vague design questions ("what scoring would you like?"). DO ask concrete missing-fact questions ("From what distance should the putts be hit?", "How many shots total per round?").
- DO NOT ask a clarifying question just because the description is short. If you can format what the user wrote, format it.
- If a clarification_answer is provided in the user message, you have already asked your one question. Do NOT ask another one — format the drill using both the original description and the answer.

LANGUAGE
- Detect the language of the user's drill name + description (their natural-language input).
- If the user wrote in a non-English language (e.g. Swedish, Spanish, German, Norwegian, French), produce ALL human-readable text VALUES in that SAME language: title, goal, setup_steps, rules, prompt, score_label, score_unit, station_score_label, station_score_unit, outcome.label. Do NOT translate the user's content into English.
- These stay in canonical English / enum form REGARDLESS of input language: drill_type, shot_area, icon (SF Symbol name), hcp.band, and all numeric fields. JSON keys and the JSON structure itself ALWAYS stay in English.
- IMPORTANT: the system rules and the EXAMPLES below are written in English for INSTRUCTION ONLY. They do NOT mean the output must be English. Always match the user's input language.
- Only default to English if the input itself is English or the language is genuinely impossible to tell.
- If you return a clarifying_question instead of a drill, write that question in the user's input language too.
- Example: user name "1m Putt Streak", description "Putta från 1 meter. Räkna hur många du gör i rad. Serien slutar vid första miss." → Swedish input → title, goal, setup_steps, rules, prompt in Swedish; shot_area stays "putting", drill_type stays "score_entry".

HARD BANS (these tokens / patterns must never appear in output)
- Em dashes — anywhere. Use periods, commas, colons, or "• " bullets. Hyphens fine inside compound words.
- Technique tips: "focus on", "concentrate on", "aim for", "stay relaxed", "trust your stroke", "be consistent", "build confidence", any variation.
- Setup framing the user didn't request: "head to the practice green", "find a quiet spot". The user already knows where they are.
- Filler explainers: "This challenge will help you...", "In this drill you'll...". Just describe the action.

DRILL TYPE (DICTATED BY scoring_method, NOT YOUR CHOICE)
The user's chosen scoring_method maps to a specific drill_type. You MUST use the mapped type:

  scoring_method = "points"          → drill_type = "points"
  scoring_method = "makes_count"     → drill_type = "score_entry", score_unit = "makes",     lower_is_better = false
  scoring_method = "in_a_row"        → drill_type = "score_entry", score_unit = "in a row",  lower_is_better = false
  scoring_method = "distance_to_pin" → drill_type = "station_entry"
  scoring_method = "total_strokes"   → drill_type = "score_entry", score_unit = "strokes",   lower_is_better = true
  scoring_method = "ai_decide"       → pick the most natural fit from {points, score_entry, station_entry} based on the description

FIELDS — ALWAYS REQUIRED
- "title": Short clear title. Use the user's chosen name if reasonable, or polish it (2 to 6 words).
- "goal": One sentence describing what the drill builds. Under 150 chars. No filler.
- "icon": A single SF Symbol name appropriate for the shot type (e.g. "scope", "target", "flag.fill", "figure.golf", "arrow.up.right", "bolt.fill"). Pick from the existing app catalog; do NOT invent.
- "time_minutes": Use the length_minutes value the user provided. If absent, estimate a sensible value between 5 and 30.
- "shot_area": Echo the user's shot_area EXACTLY.
- "setup_steps": Array of short numbered actions to get ready. Take from the user's description. Each item is one short sentence. NO extra steps invented.
- "rules": Array of short statements describing how to play. Take from the user's description. Each item is one short sentence. NO extra rules invented.
- "lower_is_better": As mapped above.
- "hcp": { input, value, band } — copy the values you receive from the user.

FIELDS — DRILL-TYPE-SPECIFIC

points (drill_type = "points"):
  - "outcomes": [{ label, points }] — derive from the user's description. If the user said "1 point per make, -1 per miss", use those. If the user said "give me a 'make' button worth +1 and a 'miss' button worth 0", use those. Do NOT invent extra outcomes the user didn't mention. Minimum 2 outcomes (a make/positive and a miss/zero is the natural pair).
  - "target_points": Take from the user's description. If they say "first to 10 points", target_points = 10. If they don't specify, ask a clarifying question instead.
  - "distances": Array of distances the user mentioned. If they mentioned one distance, this is [<that distance>]. If multiple, list them all in the order the user gave them.
  - "end_condition": Short sentence: "Reach <target_points> points." or similar wording the user used.

score_entry (drill_type = "score_entry"):
  - "score_label": Short label for the score field (e.g. "Total makes", "Putts in a row", "Strokes"). Match score_unit.
  - "score_unit": As mapped above.
  - "prompt": Short instruction shown above the score field: "How many putts did you make?", "How many in a row?", "Total strokes?", etc.

station_entry (drill_type = "station_entry") — used for distance_to_pin, a continuous measurement:
  - "stations": Array of distances (numbers in meters or yards — preserve the user's unit choice, but encode as a plain number; the unit is implied by the shot_area).
  - "station_score_mode": always "measurement". The player records a measured decimal value at each station; there is NO discrete chip range.
  - "station_score_unit": the unit the player records the value in, e.g. "m" or "ft". Short (<= 10 chars).
  - "station_score_step": the decimal increment for entry, e.g. 0.1 or 0.5.
  - "station_score_label": Short label for the per-station value (e.g. "Distance to pin (ft)").
  - Do NOT emit station_score_min or station_score_max — measurement entry is open-ended.
  - "lower_is_better" is true for distance-to-pin (closer is better).

DO NOT include benchmarks, scoring_combos, questions, retry_label, pass_label, stations_labels, total_shots, shuffle_stations, shuffle_targets, or targets. Those fields belong to other drill types not available in Build-a-Drill.

EXAMPLES (study these — outputs that deviate are wrong)

USER input:
  name: "1m Putt Streak"
  description: "Putt from 1 meter. Count how many you make in a row. Streak ends on the first miss."
  shot_area: "putting"
  scoring_method: "in_a_row"
  length_minutes: 10
  hcp_low: 5, hcp_high: 15
RIGHT OUTPUT:
{
  "drill": {
    "drill_type": "score_entry",
    "title": "1m Putt Streak",
    "goal": "Hole consecutive 1-meter putts to build short-putt consistency under pressure.",
    "icon": "scope",
    "time_minutes": 10,
    "shot_area": "putting",
    "setup_steps": [
      "Place a ball 1 meter from the hole.",
      "Mark the position with a tee."
    ],
    "rules": [
      "Putt one ball at a time from 1 meter.",
      "Count each consecutive make.",
      "The streak ends on the first miss."
    ],
    "lower_is_better": false,
    "hcp": { "input": "5-15", "value": 10, "band": "6_to_12" },
    "score_label": "Putts in a row",
    "score_unit": "in a row",
    "prompt": "How many in a row?"
  }
}

USER input:
  name: "Wedge Ladder 60-80m"
  description: "Hit 5 shots each from 60, 70, and 80 meters. Record distance to pin in feet for each shot."
  shot_area: "wedges"
  scoring_method: "distance_to_pin"
RIGHT OUTPUT:
{
  "drill": {
    "drill_type": "station_entry",
    "title": "Wedge Ladder 60-80m",
    "goal": "Distance control across short wedge yardages.",
    "icon": "scope",
    "time_minutes": 20,
    "shot_area": "wedges",
    "setup_steps": [
      "Mark targets at 60, 70, and 80 meters.",
      "Have 5 balls ready for each station."
    ],
    "rules": [
      "Hit 5 shots from 60 meters, then 70, then 80.",
      "Record the distance to the pin in feet for each shot."
    ],
    "lower_is_better": true,
    "hcp": { "input": null, "value": null, "band": "no_hcp" },
    "stations": [60, 70, 80],
    "station_score_mode": "measurement",
    "station_score_unit": "ft",
    "station_score_step": 0.5,
    "station_score_label": "Distance to pin (ft)"
  }
}

USER input (TOO VAGUE):
  name: "Putting Drill"
  description: "Putting points game."
  scoring_method: "points"
RIGHT OUTPUT:
{ "clarifying_question": "From what distance, and how many points wins?" }

WRONG OUTPUT (invents content): a points drill with [1m, 2m, 3m] distances, made-up outcomes, target_points=10. None of those came from the user.`;
}
function buildUserPrompt(body) {
  const hcp = body.hcp_low != null || body.hcp_high != null ? `HCP target: ${body.hcp_low ?? "?"} to ${body.hcp_high ?? "?"}` : "HCP target: not specified";
  const length = body.length_minutes != null ? `Length: ${body.length_minutes} minutes` : "Length: not specified (estimate sensibly)";
  const clar = body.clarification_answer ? `\n\nYou previously asked a clarifying question. The user answered: "${body.clarification_answer}"\nFormat the drill now using the original description PLUS this answer. Do NOT ask another clarifying question.` : "";
  return `Build a Drill request:

User's drill name: ${body.name}
Shot area: ${body.shot_area}
Scoring method: ${body.scoring_method}
${hcp}
${length}

User's description:
"""
${body.description}
"""${clar}

Format the drill per the system rules. JSON only.`;
}
/// Defensive: replace em dashes the model might slip past the prompt ban.
function scrubDashesInDrill(d) {
  const fix = (s)=>s.replace(/^—\s*/gm, "• ").replace(/\s*—\s*/g, ", ").replace(/—/g, "");
  return {
    ...d,
    title: fix(d.title),
    goal: fix(d.goal),
    setup_steps: d.setup_steps.map(fix),
    rules: d.rules.map(fix),
    ...d.drill_type === "points" ? {
      end_condition: fix(d.end_condition),
      outcomes: d.outcomes.map((o)=>({
          ...o,
          label: fix(o.label)
        }))
    } : {},
    ...d.drill_type === "score_entry" ? {
      score_label: fix(d.score_label),
      prompt: fix(d.prompt),
      ...d.score_unit ? {
        score_unit: fix(d.score_unit)
      } : {}
    } : {},
    ...d.drill_type === "station_entry" ? {
      station_score_label: fix(d.station_score_label)
    } : {}
  };
}
/* ------------------------------------------------------------------ */ /*  OpenAI call                                                        */ /* ------------------------------------------------------------------ */ async function callOpenAI(body) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: {
        type: "json_object"
      },
      // Lower than generate-drill: we want strict adherence, not creativity.
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: buildUserPrompt(body)
        }
      ]
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const payload = await res.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI returned no content");
  }
  const parsed = JSON.parse(content);
  const validated = aiOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI output failed validation: ${validated.error.message}`);
  }
  if ("clarifying_question" in validated.data) {
    return {
      clarifying_question: validated.data.clarifying_question
    };
  }
  return {
    drill: scrubDashesInDrill(validated.data.drill)
  };
}
/* ------------------------------------------------------------------ */ /*  Handler                                                            */ /* ------------------------------------------------------------------ */ serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return json({
      error: "Method not allowed."
    }, 405);
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({
        error: "Missing Supabase configuration."
      }, 500);
    }
    // ---- Auth ----
    const auth = req.headers.get("authorization");
    const token = auth && /^Bearer\s+/i.test(auth) ? auth.slice(7).trim() : null;
    if (!token) {
      return json({
        error: "Missing or invalid authorization."
      }, 401);
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({
        error: "Invalid or expired token."
      }, 401);
    }
    // ---- Body ----
    const rawBody = await req.json();
    const bodyParse = bodySchema.safeParse(rawBody);
    if (!bodyParse.success) {
      return json({
        error: `Invalid request: ${bodyParse.error.message}`
      }, 400);
    }
    const body = bodyParse.data;
    // ---- Rate limit (shared pool with generate-drill / generate-level) ----
    // Note: a clarifying-question round-trip costs the same rate-limit slot
    // as a full drill. That's intentional — the OpenAI tokens are spent
    // either way, and refusing to charge would let users probe the model
    // freely. The follow-up "with clarification_answer" call is ALSO a fresh
    // OpenAI call, so it ALSO counts. Users who hit the cap mid-conversation
    // see the same 429 they'd see anywhere else.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: profileRow }, { count: recentCount }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase.from("coach_drill_generations").select("*", {
        count: "exact",
        head: true
      }).eq("user_id", user.id).gte("created_at", since24h)
    ]);
    const isCoach = profileRow?.role === "coach" || profileRow?.role === "admin";
    const dailyLimit = isCoach ? 50 : 10;
    const used = recentCount ?? 0;
    if (used >= dailyLimit) {
      return json({
        error: `Daily AI generation limit reached (${dailyLimit} per 24 hours). Please try again later.`,
        rate_limited: true,
        limit: dailyLimit,
        used
      }, 429);
    }
    // Log the attempt before the OpenAI call (best-effort — same pattern as
    // generate-drill / generate-level).
    const { error: logError } = await supabase.from("coach_drill_generations").insert({
      user_id: user.id,
      kind: "format_drill"
    });
    if (logError) {
      console.error("[format-drill] Rate-limit log insert failed:", logError.message);
    }
    // ---- Format ----
    const result = await callOpenAI(body);
    // ---- Patch hcp metadata onto the drill ----
    // The AI is told to copy what we send, but to be safe we overwrite with
    // the canonical values we computed server-side. The drill's hcp is
    // descriptive metadata — it doesn't drive any AI behavior at runtime.
    if ("drill" in result) {
      const band = bandFromRange(body.hcp_low ?? null, body.hcp_high ?? null);
      const hcpInput = body.hcp_low != null && body.hcp_high != null ? `${body.hcp_low}-${body.hcp_high}` : body.hcp_low != null ? String(body.hcp_low) : body.hcp_high != null ? String(body.hcp_high) : null;
      const hcpValue = body.hcp_low != null && body.hcp_high != null ? (body.hcp_low + body.hcp_high) / 2 : body.hcp_low ?? body.hcp_high ?? null;
      result.drill = {
        ...result.drill,
        hcp: {
          input: hcpInput,
          value: hcpValue,
          band
        },
        // Echo shot_area from the request — the AI was told to do this, but
        // a hard server-side echo means a slipped model response can't drift
        // the UI's category color.
        shot_area: body.shot_area
      };
    }
    return json(result);
  } catch (error) {
    console.error("[format-drill]", error);
    const msg = error instanceof Error ? error.message : "Unknown error occurred";
    return json({
      error: msg
    }, 500);
  }
});
