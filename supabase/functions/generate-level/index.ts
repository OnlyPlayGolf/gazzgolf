// generate-level
//
// AI-generates a single user-created Level (a pass/fail practice challenge)
// and inserts it into `public.levels` with `created_by = user.id`.
//
// Levels are simpler than coach drills: 5 fields (name, description,
// distance, success_criteria + the user-chosen category). The AI doesn't
// pick a tier or XP — server forces `tier='custom'`, `level_in_tier=1`,
// `xp=0` so custom levels stay out of the built-in tier path and don't
// award progression XP.
//
// Rate limit: shared with generate-drill via `coach_drill_generations`
// (10/day regular, 50/day coaches) — kind='create_level'.
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
/* ------------------------------------------------------------------ */ /*  Schemas                                                            */ /* ------------------------------------------------------------------ */ const categorySchema = z.enum([
  "putting",
  "short_game"
]);
/// Body for `mode: "preview"` (new) and legacy mode (no field).
/// Both run the AI; preview skips the DB insert.
const generateBodySchema = z.object({
  category: categorySchema,
  goal: z.string().trim().min(3).max(500),
  // hcpInput is accepted for backwards compatibility but no longer used in
  // the prompt. Levels are user-designed challenges (coaches especially) —
  // adapting them to handicap was actively rewriting user intent.
  hcpInput: z.string().nullish()
});
const aiOutputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  // Min relaxed to 3 so terse outputs like "Hole a 1m putt." don't force
  // the model to pad with filler just to hit the length floor.
  description: z.string().trim().min(3).max(600),
  // Required. The AI must always pick something (a single value, a range,
  // or the literal "Mixed") so the UI never has to render "—" in the
  // Distance slot.
  distance: z.string().trim().min(1).max(40),
  success_criteria: z.string().trim().min(5).max(200)
});
/// Body for `mode: "save"`. Contains a pre-built (possibly edited) draft
/// the client wants persisted into a specific user-owned map. Maps are
/// now category-agnostic, so the client supplies the category per draft
/// (a single map can mix putting + short_game levels). Server verifies
/// the map is owned by the user and computes the next `level_in_tier`.
const saveBodySchema = z.object({
  map_id: z.string().uuid(),
  category: categorySchema,
  draft: aiOutputSchema
});
/* ------------------------------------------------------------------ */ /*  HCP parsing — mirrors generate-drill's parseHcp                    */ /* ------------------------------------------------------------------ */ /* ------------------------------------------------------------------ */ /*  Prompt                                                             */ /* ------------------------------------------------------------------ */ function buildSystemPrompt() {
  return `You FORMAT a golf practice level into structured JSON. The user (often a coach) has already designed the challenge. Your job is wording polish ONLY. Output valid JSON matching the schema. No markdown, no commentary.

LANGUAGE
- Detect the language of the user's level description.
- If the user wrote in a non-English language (e.g. Swedish, Spanish, German, Norwegian, French), produce ALL human-readable text VALUES in that SAME language: "name", "success_criteria", "description". Do NOT translate the user's content into English.
- The "distance" field stays in canonical numeric form ("1 m", "10-45 m", "8 ft") regardless of input language. Distance units (m, ft, yds) are universal in golf.
- JSON keys and the JSON structure itself stay in English no matter what.
- IMPORTANT: the rules, REFERENCE STYLE, and WORKED EXAMPLES below are written in English for INSTRUCTION ONLY. They do NOT mean the output must be English. Always match the user's input language.
- Only default to English if the input itself is English or the language is genuinely impossible to tell.
- Example: user writes "Håla tre puttar i rad från 1m" (Swedish) → output name, success_criteria, description in Swedish. User writes "Hole 3 putts in a row from 1m" → output in English.

CORE ROLE
- You are a copyeditor, not a designer or coach.
- The user's text is authoritative. Preserve every distance, count, time limit, position, and club EXACTLY.
- Do NOT change numbers. A 1m putt stays a 1m putt; "4 putts in a row" stays "4 putts in a row".
- Do NOT invent shot types, extra steps, or alternate conditions the user didn't mention.

HARD BANS (these tokens / patterns must never appear in output)
- Em dashes — anywhere. Use periods, commas, colons, or the bullet character "•". Hyphens are fine inside compound words ("up-and-down") but not as sentence connectors.
- Technique tips: "focus on", "concentrate on", "aim for", "stay relaxed", "stay calm", "be consistent", "trust your stroke", "build confidence", any variation. Never advise.
- Setup framing the user didn't request: "set up at the putting area", "get ready by", "position yourself", "head to the practice green". The user already knows where they are.
- Closing fluff: "to successfully complete the task", "to reach the goal", "to pass this level". The success condition speaks for itself.
- Filler explainers: "This challenge requires you to...", "In this level you will...". Just state the action.

FIELD RULES

"name" — 3 to 6 words. Title that clearly evokes the user's challenge. Examples for "hole a 1m putt": "1m Putt", "1m Tap-In", "Short Putt".

"distance" — REQUIRED. Take from the user's text exactly:
  · single value: "1 m", "8 ft", "30 m"
  · range: "10-45 m" (use ASCII hyphen, NOT em dash or en dash)
  · "Mixed" only if the challenge spans multiple wildly different distances

"success_criteria" — ONE concise sentence under 90 characters. State the exact pass condition.

"description" — As SHORT as possible.
  · For a single-step challenge: ONE short sentence. Often it's fine for description to restate the success criteria; do not pad with extra sentences just to look longer.
  · For a multi-step challenge with 2 or more distinct shots/positions: write each step on its own line prefixed with "• " (bullet character + space). Keep each bullet to one short line. No intro sentence unless genuinely needed.
  · Never write a second sentence solely to explain or motivate the first.

INTERPRETATION RULE
- If the user does NOT explicitly say "land", "carry", or "first bounce", interpret distances as where the ball comes to REST.

REFERENCE STYLE (these are real wordings from the app's built-in level catalog — match this style)

- "Make 1 putt from 0.3 meters"
- "Make 2 consecutive putts from 0.3 meters"
- "Make 3 putts in a row from 2 meter distance"
- "Hit one putt in the hole or past the hole within 1 meter from 1 meter"
- "Chip 1 ball inside 6m from 8 meter (fairway)"
- "Get 3 putts to go in the hole or stop 0.5m past the hole from 4 meters"
- "From any distance, hit 1 bunker shot onto the green within 10 meters of the hole, and the ball must stay on the green"
- "Hit 4 chips within 2m of the hole from 10 meters (Fairway)"
- "Pick a 40 meter wide target and hit 4 out of 10 drivers inside the target"
- "From 60 meters carry 3 shots inside 3 meters with 5 attempts"
- "Make 10 out of 10 different putts from 4 feet"
- "Pick one club. Hit 5/5 shots within 3 m of your carry target at 40 m, 50 m, 60 m, 70 m, and 80 m."

Note: every one of those descriptions is a single short imperative. No setup framing. No technique tips. No filler. Roughly 7 to 25 words. Distance and count are stated inline. That's the bar.

WORKED EXAMPLES (study these — outputs that deviate are wrong)

USER: "Hole a 1m putt"
RIGHT:
  name: "1m Putt"
  distance: "1 m"
  success_criteria: "Make 1 putt from 1m."
  description: "Make 1 putt from 1 meter."
WRONG description: "Set up at the putting area. Attempt to hole a putt from a distance of 1 meter."  (banned: setup framing, padding)

USER: "Hole 4 putts in a row from 1m"
RIGHT:
  name: "4 in a Row from 1m"
  distance: "1 m"
  success_criteria: "Make 4 putts in a row from 1m."
  description: "Make 4 putts in a row from 1 meter."
WRONG description: "This challenge requires you to hole four putts consecutively from 1 meter. Focus on your stroke."  (banned: filler explainer, technique tip)

USER: "Land 8 of 10 chips within 6 ft from 15 yards"
RIGHT:
  name: "15-Yard Chip Accuracy"
  distance: "15 yds"
  success_criteria: "Land 8 of 10 chips within 6 ft."
  description: "Land 8 out of 10 chips within 6 ft of the pin from 15 yards."

USER: "5 shots: fairway chip 10m within 1m, bunker 15m within 2m, pitch 30m within 2m, pitch 45m within 3m"
RIGHT:
  name: "Short Game Ladder"
  distance: "10-45 m"
  success_criteria: "Stop each shot within its target distance."
  description: "Hit each shot in order. Ball must stop within the listed distance.
• Fairway chip from 10 m: within 1 m
• Bunker from 15 m: within 2 m
• Pitch from 30 m: within 2 m
• Pitch from 45 m: within 3 m"`;
}
function buildUserPrompt(category, goal) {
  const area = category === "putting" ? "Putting" : "Short Game (chips, pitches, bunker)";
  return `Practice area: ${area}
User's level description: ${goal}

Format this into a Level. Preserve every distance and count exactly. JSON only.`;
}
/* ------------------------------------------------------------------ */ /*  OpenAI call                                                        */ /* ------------------------------------------------------------------ */ async function callOpenAI(category, goal) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // One model round-trip with a hard timeout. Returns { ok, data } on success
  // or { ok: false, reason } for recoverable failures (bad JSON / schema), so
  // the caller can retry once with a corrective hint. Network / non-200 /
  // timeout errors throw (not retried here).
  async function attempt(retryHint) {
    // Temperature 0.3: this is a copyeditor that must preserve the user's text
    // exactly — strict adherence, not creativity.
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 20000);
    let res;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: {
            type: "json_object"
          },
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt()
            },
            {
              role: "user",
              content: buildUserPrompt(category, goal) + (retryHint ? `\n\n${retryHint}` : "")
            }
          ]
        }),
        signal: controller.signal
      });
    } catch (e) {
      if (e?.name === "AbortError") throw new Error("AI request timed out. Please try again.");
      throw e;
    } finally{
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }
    const payload = await res.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI returned no content");
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      return { ok: false, reason: "the response was not valid JSON" };
    }
    const validated = aiOutputSchema.safeParse(parsed);
    if (!validated.success) {
      const detail = validated.error.issues.slice(0, 4).map((i)=>`${i.path.join(".")}: ${i.message}`).join("; ");
      return { ok: false, reason: `it failed schema validation (${detail})` };
    }
    return { ok: true, data: scrubDashes(validated.data) };
  }

  let result = await attempt();
  if (!result.ok) {
    // One corrective retry. Cheap (gpt-4o-mini) and turns a user-visible 500
    // into a recovered success in the common transient case.
    result = await attempt(
      `[RETRY] Your previous answer was rejected because ${result.reason}. Output ONLY valid JSON with exactly these fields: name, description, distance, success_criteria — in the SAME language as the user's input.`
    );
  }
  if (!result.ok) {
    throw new Error(`AI output failed validation after a retry: ${result.reason}`);
  }
  return result.data;
}
/// Defensive cleanup: replace em dashes the model might have slipped past
/// the prompt ban. Line-start em dashes (used as bullet markers) become
/// "• " (the new bullet character); mid-line em dashes become ", ". The
/// prompt is the primary lever — this just keeps a stray dash from
/// reaching the user.
function scrubDashes(d) {
  const fix = (s)=>s// Bullet-like em dash at start of any line → bullet character
    .replace(/^—\s*/gm, "• ")// Em dash between words mid-line → ", " (with surrounding spaces collapsed)
    .replace(/\s*—\s*/g, ", ")// Standalone or paired em dashes anywhere else
    .replace(/—/g, "");
  return {
    ...d,
    name: fix(d.name),
    description: fix(d.description),
    distance: fix(d.distance),
    success_criteria: fix(d.success_criteria)
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
    const mode = typeof rawBody?.mode === "string" ? rawBody.mode : undefined;
    // ---- Branch: save mode ----
    // No AI call, no rate-limit consumption — the user has already approved
    // a draft (which may include their edits). Server-side responsibilities:
    //   1. Verify the target map exists AND is owned by the requesting user.
    //   2. Derive category from the map (don't trust the client).
    //   3. Compute the next `level_in_tier` for the map so positions stay
    //      sequential without client-side races.
    if (mode === "save") {
      const saveParse = saveBodySchema.safeParse(rawBody);
      if (!saveParse.success) {
        return json({
          error: `Invalid save request: ${saveParse.error.message}`
        }, 400);
      }
      const { map_id, category, draft } = saveParse.data;
      // Verify ownership. Category comes from the request (maps are
      // category-agnostic — each level inside a map carries its own).
      const { data: mapRow, error: mapError } = await supabase.from("custom_level_maps").select("id, owner_id").eq("id", map_id).maybeSingle();
      if (mapError) {
        console.error("[generate-level] Map lookup error:", mapError.message);
        return json({
          error: "Could not verify map."
        }, 500);
      }
      if (!mapRow) {
        return json({
          error: "Map not found."
        }, 404);
      }
      if (mapRow.owner_id !== user.id) {
        return json({
          error: "You don't own that map."
        }, 403);
      }
      // Count existing levels in this map to compute the next position.
      const { count: existingCount, error: countError } = await supabase.from("levels").select("*", {
        count: "exact",
        head: true
      }).eq("custom_map_id", map_id);
      if (countError) {
        console.error("[generate-level] Map count error:", countError.message);
        return json({
          error: "Could not compute level position."
        }, 500);
      }
      const nextLevelInTier = (existingCount ?? 0) + 1;
      const insertRow = {
        category,
        tier: "custom",
        level_in_tier: nextLevelInTier,
        name: draft.name,
        description: draft.description,
        distance: draft.distance,
        success_criteria: draft.success_criteria,
        xp: 0,
        created_by: user.id,
        custom_map_id: map_id
      };
      const { data: row, error: insertError } = await supabase.from("levels").insert(insertRow).select().single();
      if (insertError || !row) {
        console.error("[generate-level] Save insert error:", insertError?.message);
        return json({
          error: "Could not save level."
        }, 500);
      }
      return json({
        level: row
      });
    }
    // ---- Branch: preview or default (legacy) — both run the AI ----
    const bodyParse = generateBodySchema.safeParse(rawBody);
    if (!bodyParse.success) {
      return json({
        error: `Invalid request: ${bodyParse.error.message}`
      }, 400);
    }
    const body = bodyParse.data;
    // ---- Rate limit (shared pool with generate-drill) ----
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
    // Log the attempt before the OpenAI call (best-effort).
    const { data: rateLimitLog, error: logError } = await supabase.from("coach_drill_generations").insert({
      user_id: user.id,
      kind: "create_level"
    }).select("id").single();
    const rateLimitLogId = rateLimitLog?.id ?? null;
    if (logError) {
      console.error("[generate-level] Rate-limit log insert failed:", logError.message);
    }
    // ---- Generate ----
    // Note: body.hcpInput is intentionally not passed through — the prompt
    // is a copyeditor, not a designer, and using HCP biased outputs toward
    // "appropriate difficulty" rather than preserving the user's intent.
    // On a hard failure the user got no level, so refund the rate-limit slot.
    let aiOut;
    try {
      aiOut = await callOpenAI(body.category, body.goal);
    } catch (genErr) {
      if (rateLimitLogId) {
        await supabase.from("coach_drill_generations").delete().eq("id", rateLimitLogId);
      }
      throw genErr;
    }
    // ---- Preview mode: return the draft, do NOT insert ----
    // The client will show the draft for review/edit and then call back
    // with `mode: "save"` and the (possibly edited) draft to persist.
    if (mode === "preview") {
      return json({
        draft: aiOut,
        category: body.category
      });
    }
    // ---- Default / legacy: generate AND insert in one shot ----
    // Preserved so old iOS builds that don't send `mode` keep working.
    const insertRow = {
      category: body.category,
      tier: "custom",
      level_in_tier: 1,
      name: aiOut.name,
      description: aiOut.description,
      distance: aiOut.distance ?? null,
      success_criteria: aiOut.success_criteria,
      xp: 0,
      created_by: user.id
    };
    const { data: row, error: insertError } = await supabase.from("levels").insert(insertRow).select().single();
    if (insertError || !row) {
      console.error("[generate-level] Insert error:", insertError?.message);
      return json({
        error: "Level generated but could not be saved."
      }, 500);
    }
    return json({
      level: row
    });
  } catch (error) {
    console.error("[generate-level]", error);
    const msg = error instanceof Error ? error.message : "Unknown error occurred";
    return json({
      error: msg
    }, 500);
  }
});
