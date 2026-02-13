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
  label: z.string().max(35),
  points: z.number(),
})

const baseSchema = z.object({
  title: z.string().max(60),
  goal: z.string().max(150),
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
  outcomes: z.array(outcomeSchema).min(2).refine(
    (outcomes) => outcomes.some((o) => o.points > 0),
    { message: "At least one outcome must have positive points" }
  ),
  target_points: z.number().min(1),
  distances: z.array(z.number()).min(1),
  end_condition: z.string(),
})

const benchmarksSchema = z.object({
  hcp_0: z.number(),   // Score a scratch golfer would get
  hcp_10: z.number(),  // Score a 10 HCP would get
  hcp_20: z.number(),  // Score a 20 HCP would get
})

const scoreEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("score_entry"),
  score_label: z.string(),
  score_unit: z.string().optional(),
  prompt: z.string(),
  benchmarks: benchmarksSchema.optional(),
})

const stationEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("station_entry"),
  stations: z.array(z.number()).min(3),
  station_score_min: z.number().min(1),
  station_score_max: z.number().max(10),
  station_score_label: z.string().max(40),
  benchmarks: benchmarksSchema.optional(),
})

const stationOutcomesDrillSchema = baseSchema.extend({
  drill_type: z.literal("station_outcomes"),
  outcomes: z.array(outcomeSchema).min(2),
  stations: z.array(z.string()).min(1),
  total_shots: z.number().min(1),
  shuffle_stations: z.boolean(),
  benchmarks: benchmarksSchema.optional(),
})

const questionSchema = z.object({
  text: z.string().max(80),
  conditional_on_previous: z.boolean(),
})

const scoringComboSchema = z.object({
  answers: z.array(z.boolean()),
  points: z.number(),
  label: z.string().max(50),
})

const conditionalEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("conditional_entry"),
  questions: z.array(questionSchema).min(2).max(3),
  scoring_combos: z.array(scoringComboSchema).min(2),
  total_shots: z.number().min(1),
  shot_labels: z.array(z.string()).optional(),
  benchmarks: benchmarksSchema.optional(),
})

const targetSchema = z.object({
  label: z.string().max(60),
})

const retryEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("retry_entry"),
  targets: z.array(targetSchema).min(2),
  pass_label: z.string().max(30),
  retry_label: z.string().max(30),
  shuffle_targets: z.boolean(),
  benchmarks: benchmarksSchema.optional(),
})

const drillSchema = z.discriminatedUnion("drill_type", [
  pointsDrillSchema,
  scoreEntryDrillSchema,
  stationEntryDrillSchema,
  stationOutcomesDrillSchema,
  conditionalEntryDrillSchema,
  retryEntryDrillSchema,
])

type Drill = z.infer<typeof drillSchema>

/* ------------------------------------------------------------------ */
/*  Few-shot Examples                                                  */
/* ------------------------------------------------------------------ */

const coachDrillExamples = [
  // ── PUTTING ──────────────────────────────────────────────────────────
  // NOTE: Putting examples deliberately show DIFFERENT drill structures.
  // Do NOT default to "cycle distances + proximity outcomes" for every putting drill.
  {
    drill_type: "score_entry",
    title: "Survival Putting 3m",
    goal: "Build clutch putting under increasing pressure from a single fixed distance.",
    icon: "bolt.fill",
    time_minutes: 10,
    shot_area: "putting",
    setup_steps: [
      "Place a tee 3 meters from the hole.",
      "Use a different break for each set of 5 putts (move the tee to a new angle).",
    ],
    rules: [
      "All putts from 3m. No distance changes — pressure comes from the scoring.",
      "Start with 10 points. Holed = +1, miss = −2.",
      "If your score drops to 0, the drill ends immediately — you are eliminated.",
      "Survive 20 putts without hitting 0 to complete the drill.",
      "Enter your final score (0 if eliminated, otherwise points remaining after 20 putts).",
    ],
    score_label: "Final Score",
    score_unit: "points",
    prompt: "What was your final score? (0 if eliminated, or points remaining after 20 putts)",
    lower_is_better: false,
    benchmarks: { hcp_0: 8, hcp_10: 3, hcp_20: 0 },
    hcp: { input: "15", value: 15, band: "13_to_20" },
  },
  {
    drill_type: "score_entry",
    title: "Short Putt Test",
    goal: "Test your short putting under pressure with increasing distances.",
    icon: "scope",
    time_minutes: 15,
    shot_area: "putting",
    setup_steps: [
      "Set 4 tees around the hole at 12, 3, 6, and 9 o'clock positions.",
      "Start each tee at 1 meter from the hole.",
    ],
    rules: [
      "Putt from each position in order: 12 → 3 → 6 → 9 o'clock, then repeat.",
      "Every made putt increases that position's distance by 0.3m (1 foot).",
      "First miss ends the drill immediately.",
      "Score = total consecutive putts made before missing.",
    ],
    score_label: "Consecutive Makes",
    score_unit: "putts",
    prompt: "How many consecutive putts did you make before your first miss?",
    lower_is_better: false,
    benchmarks: { hcp_0: 16, hcp_10: 10, hcp_20: 6 },
    hcp: { input: "10", value: 10, band: "6_to_12" },
  },
  {
    drill_type: "score_entry",
    title: "Gate Drill 1.5m",
    goal: "Improve start line accuracy by putting through a narrow gate.",
    icon: "arrow.right.to.line",
    time_minutes: 10,
    shot_area: "putting",
    setup_steps: [
      "Place two tees 5cm apart on a straight, flat putt 0.5m in front of the hole.",
      "Mark your starting position 1.5m from the hole with a coin.",
    ],
    rules: [
      "Hit 20 putts from 1.5m, aiming through the gate.",
      "A putt counts as 'through the gate' if the ball passes between the tees without touching either.",
      "Count total putts that pass through the gate AND are holed.",
      "Target: 16 out of 20 for mid-handicappers.",
    ],
    score_label: "Gate + Holed",
    score_unit: "out of 20",
    prompt: "How many of 20 putts went through the gate and were holed?",
    lower_is_better: false,
    benchmarks: { hcp_0: 15, hcp_10: 12, hcp_20: 8 },
    hcp: { input: "18", value: 18, band: "13_to_20" },
  },
  {
    drill_type: "points",
    title: "Make or Break 2m",
    goal: "Build confidence on the putts that matter most — holing out from 2 meters.",
    icon: "target",
    time_minutes: 10,
    shot_area: "putting",
    setup_steps: [
      "Place a coin 2 meters from the hole on a straight putt.",
      "Use the same line for all putts. Move to a breaking putt after reaching 6 points if you want extra challenge.",
    ],
    rules: [
      "All putts from 2m. Simple make or miss.",
      "Reach 6 points to complete the drill.",
    ],
    outcomes: [
      { label: "Holed", points: 2 },
      { label: "Missed", points: -1 },
    ],
    target_points: 6,
    distances: [2],
    end_condition: "Drill ends when you reach 6 points.",
    lower_is_better: true,
    hcp: { input: "15", value: 15, band: "13_to_20" },
  },
  {
    drill_type: "station_entry",
    title: "18-Station Putting Gauntlet",
    goal: "Test putting across 18 distances with a par-based scoring system.",
    icon: "flag.fill",
    time_minutes: 20,
    shot_area: "putting",
    setup_steps: [
      "Use a practice green with enough space for 16m putts.",
      "Set up 18 putt stations at these distances: 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 16 meters.",
    ],
    rules: [
      "Hit one putt from each of the 18 distances. Distances are shuffled randomly.",
      "Vary the break and slope for each station (uphill, downhill, sidehill).",
      "Record putts taken per station (1-5).",
      "Total score = sum of all putts. Tour benchmark: 29 putts.",
    ],
    stations: [0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 12, 16],
    station_score_min: 1,
    station_score_max: 5,
    station_score_label: "Putts taken",
    lower_is_better: true,
    benchmarks: { hcp_0: 27, hcp_10: 32, hcp_20: 38 },
    hcp: { input: "3", value: 3, band: "0_to_5" },
  },

  {
    drill_type: "score_entry",
    title: "Three-Foot Confidence Builder",
    goal: "Build a reliable short putt stroke by tracking makes from 1 meter.",
    icon: "hand.thumbsup.fill",
    time_minutes: 10,
    shot_area: "putting",
    setup_steps: [
      "Place a coin 1 meter from the hole.",
      "Choose 4 different angles around the hole (front, back, left, right) and mark each with a tee.",
    ],
    rules: [
      "Putt 5 balls from each of the 4 positions (20 putts total).",
      "Count how many you hole out of 20.",
      "Target for high-handicappers: 14 out of 20.",
      "If you hole fewer than 10, move closer to 0.75m and repeat.",
    ],
    score_label: "Putts Holed",
    score_unit: "out of 20",
    prompt: "How many of your 20 putts from 1 meter did you hole?",
    lower_is_better: false,
    benchmarks: { hcp_0: 18, hcp_10: 14, hcp_20: 11 },
    hcp: { input: "28", value: 28, band: "21_to_30" },
  },

  // ── SHORT GAME ───────────────────────────────────────────────────────
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
    title: "Short Game Circuit",
    goal: "Build well-rounded short game skills by rotating through 8 different stations.",
    icon: "figure.golf",
    time_minutes: 20,
    shot_area: "mixed",
    setup_steps: [
      "Set up 8 stations: Chip 10m, Chip 30m, Pitch 20m, Pitch 40m, Lob 15m, Lob 25m, Bunker 10m, Bunker 20m.",
      "Place a target flag or towel at each station's landing area.",
    ],
    rules: [
      "Rotate through all 8 stations in order. Never hit the same shot twice in a row.",
      "Complete 5 full rounds (40 shots total).",
      "Score each shot: Holed = 4, Within 1m = 3, Within 2m = 2, Within 3m = 1, 3m+ = 0.",
      "Sum all 40 scores. Maximum possible: 160. Target for mid-handicappers: 80+.",
    ],
    score_label: "Total Points",
    score_unit: "points",
    prompt: "What was your total points across all 40 shots?",
    lower_is_better: false,
    hcp: { input: "12", value: 12, band: "6_to_12" },
  },
  {
    drill_type: "score_entry",
    title: "18 Up & Downs",
    goal: "Simulate on-course up-and-down situations from varied lies and distances.",
    icon: "scope",
    time_minutes: 25,
    shot_area: "mixed",
    setup_steps: [
      "Set up 18 stations with varied lies: bunker (10m, 20m), rough (10m, 20m), fairway (10m, 15m, 20m, 30m).",
      "Randomize the order each session.",
    ],
    rules: [
      "Play each station as an up-and-down: chip/pitch then putt out.",
      "Record total strokes to hole out per station (1-5).",
      "Complete all 18 stations.",
      "Total score = sum of all strokes. Lower is better.",
    ],
    score_label: "Total Strokes",
    score_unit: "strokes",
    prompt: "What was your total strokes across all 18 up-and-down stations?",
    lower_is_better: true,
    hcp: { input: "10", value: 10, band: "6_to_12" },
  },

  // ── APPROACH ──────────────────────────────────────────────────────────
  {
    drill_type: "points",
    title: "Approach Distance Control 40-80m",
    goal: "Sharpen wedge precision across 9 distances in a two-lap format.",
    icon: "scope",
    time_minutes: 15,
    shot_area: "wedges",
    setup_steps: [
      "Set up on the range with targets at 40, 45, 50, 55, 60, 65, 70, 75, and 80 meters.",
      "Use appropriate wedges for each distance.",
    ],
    rules: [
      "Hit one shot from each of the 9 distances (40–80m). That is Lap 1.",
      "Repeat all 9 distances for Lap 2 (18 shots total).",
      "Score each shot based on proximity to the target.",
    ],
    outcomes: [
      { label: "Within 2m", points: 3 },
      { label: "Within 3m", points: 2 },
      { label: "Within 4m", points: 1 },
      { label: "On green", points: 0 },
      { label: "Missed green", points: -1 },
    ],
    target_points: 54,
    distances: [40, 45, 50, 55, 60, 65, 70, 75, 80],
    end_condition: "Drill ends when you reach 54 points.",
    lower_is_better: true,
    hcp: { input: "8", value: 8, band: "6_to_12" },
  },
  {
    drill_type: "score_entry",
    title: "Wedge Ladder 60-120m",
    goal: "Test wedge distance control by climbing through 13 distances.",
    icon: "arrow.up.right",
    time_minutes: 20,
    shot_area: "wedges",
    setup_steps: [
      "Set up on the range with a target at 60 meters.",
      "Have clubs ready for distances up to 120 meters.",
    ],
    rules: [
      "Start at 60m. Hit within 3m of the target to advance to the next distance.",
      "Miss = retry the same distance until you hit within 3m.",
      "Distances: 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120m.",
      "Score = total shots needed to complete all 13 distances. Perfect = 13.",
    ],
    score_label: "Total Shots",
    score_unit: "shots",
    prompt:
      "How many total shots did you need to complete all 13 distances?",
    lower_is_better: true,
    hcp: { input: "6", value: 6, band: "0_to_5" },
  },
  {
    drill_type: "points",
    title: "Approach Control 130-180m",
    goal: "Test approach accuracy with side-targeting and proximity scoring.",
    icon: "scope",
    time_minutes: 20,
    shot_area: "mixed",
    setup_steps: [
      "Set up on the range with targets between 130m and 180m.",
      "Mark a left and right target zone for each distance.",
    ],
    rules: [
      "Hit 14 approach shots from randomized distances (130–180m).",
      "Each shot has a designated target side (left or right). 7 left, 7 right.",
      "Score based on correct side + proximity: correct side & within 5m = 3pts, wrong side & within 5m = 2pts, correct side & outside 5m = 1pt, wrong side & outside 5m = −1pt.",
      "Streak bonus: 3+ consecutive 3-pointers awards +1 bonus each.",
    ],
    outcomes: [
      { label: "Correct + within 5m", points: 3 },
      { label: "Wrong side + within 5m", points: 2 },
      { label: "Correct + outside 5m", points: 1 },
      { label: "Wrong + outside 5m", points: -1 },
    ],
    target_points: 42,
    distances: [130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180],
    end_condition: "Drill ends when you reach 42 points.",
    lower_is_better: true,
    hcp: { input: "4", value: 4, band: "0_to_5" },
  },

  // ── FULL SWING ────────────────────────────────────────────────────────
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
    title: "Driver Control",
    goal: "Test driving accuracy with randomized miss penalties and a streak bonus.",
    icon: "car.side",
    time_minutes: 15,
    shot_area: "driver",
    setup_steps: [
      "Set up on the range with a 30-meter-wide fairway corridor.",
      "Mark the center line and both edges.",
    ],
    rules: [
      "Hit 14 drives aiming for the fairway.",
      "Fairway hit = +1. Miss left or miss right = randomized penalty (0, −1, or −2 per shot).",
      "Streak bonus: after 3+ consecutive fairways, each additional fairway earns +1 bonus point.",
      "First miss after a streak resets the bonus.",
    ],
    outcomes: [
      { label: "Fairway", points: 1 },
      { label: "Miss left", points: 0 },
      { label: "Miss right", points: 0 },
    ],
    target_points: 14,
    distances: [250],
    end_condition: "Drill ends when you reach 14 points.",
    lower_is_better: true,
    hcp: { input: "10", value: 10, band: "6_to_12" },
  },
  {
    drill_type: "points",
    title: "Shot Shape Master",
    goal: "Test ability to hit required shot shapes on demand with varied clubs.",
    icon: "arrow.triangle.branch",
    time_minutes: 15,
    shot_area: "mixed",
    setup_steps: [
      "Set up on the range with a 30m-wide fairway corridor.",
      "Have driver, fairway wood, and hybrid ready.",
    ],
    rules: [
      "Hit 14 tee shots. Each shot specifies a required shape (draw or fade) and club.",
      "Club mix: 9 driver, 2 fairway wood, 3 hybrid. 7 draws, 7 fades.",
      "Score based on shape accuracy + fairway hit: correct shape & fairway = 3pts, wrong shape & fairway = 2pts, correct shape & within 10m of fairway = 1pt, otherwise = 0pts.",
      "Streak bonus: 3+ consecutive 3-pointers awards +1 bonus each.",
    ],
    outcomes: [
      { label: "Shape + fairway", points: 3 },
      { label: "Wrong shape + FW", points: 2 },
      { label: "Shape + near FW", points: 1 },
      { label: "Off line", points: 0 },
    ],
    target_points: 42,
    distances: [250],
    end_condition: "Drill ends when you reach 42 points.",
    lower_is_better: true,
    hcp: { input: "2", value: 2, band: "0_to_5" },
  },
  {
    drill_type: "score_entry",
    title: "9 Windows Shot Shape",
    goal: "Master all 9 trajectory + shape combinations with one club.",
    icon: "square.grid.3x3",
    time_minutes: 20,
    shot_area: "mixed",
    setup_steps: [
      "Use a 7-iron only for the entire drill.",
      "Pick a target on the range with a 15-meter landing zone.",
    ],
    rules: [
      "Complete 9 windows: High Fade, High Straight, High Draw, Mid Fade, Mid Straight, Mid Draw, Low Fade, Low Straight, Low Draw.",
      "Windows are presented in random order each session.",
      "Hit until you execute the correct trajectory + shape within the 15m target. Then move to the next window.",
      "Score = total shots to complete all 9 windows. Perfect = 9.",
    ],
    score_label: "Total Shots",
    score_unit: "shots",
    prompt: "How many total shots did you need to complete all 9 windows?",
    lower_is_better: true,
    hcp: { input: "2", value: 2, band: "0_to_5" },
  },

  // ── STATION OUTCOMES ─────────────────────────────────────────────────
  {
    drill_type: "station_outcomes",
    title: "Lag Putting Proximity 8-16m",
    goal: "Develop distance control on long putts by grading proximity at each station.",
    icon: "scope",
    time_minutes: 15,
    shot_area: "putting",
    setup_steps: [
      "Use a practice green with enough space for 16m putts.",
      "Set up 12 putt stations at: 8, 9, 10, 11, 12, 13, 14, 15, 16, 10, 12, 14 meters.",
    ],
    rules: [
      "Hit one putt from each of the 12 stations. Stations are shuffled randomly.",
      "Vary the break and slope at each station (uphill, downhill, sidehill).",
      "After each putt, tap the outcome that best describes where the ball stopped.",
      "Total score = sum of all outcome points. Higher is better.",
    ],
    outcomes: [
      { label: "Holed", points: 5 },
      { label: "Within 0.5m", points: 3 },
      { label: "Within 1m", points: 2 },
      { label: "Within 2m", points: 1 },
      { label: "2m+ away", points: 0 },
      { label: "3m+ away", points: -1 },
    ],
    stations: ["8m", "9m", "10m", "11m", "12m", "13m", "14m", "15m", "16m", "10m", "12m", "14m"],
    total_shots: 12,
    shuffle_stations: true,
    lower_is_better: false,
    benchmarks: { hcp_0: 30, hcp_10: 22, hcp_20: 15 },
    hcp: { input: "8", value: 8, band: "6_to_12" },
  },

  // ── CONDITIONAL ENTRY ──────────────────────────────────────────────
  {
    drill_type: "conditional_entry",
    title: "Approach Side Control 130-170m",
    goal: "Test approach accuracy with side-targeting and proximity assessment.",
    icon: "scope",
    time_minutes: 20,
    shot_area: "wedges",
    setup_steps: [
      "Set up on the range with targets between 130m and 170m.",
      "Mark a left and right target zone for each distance.",
    ],
    rules: [
      "Hit 14 approach shots from randomized distances (130–170m).",
      "Each shot has a designated target side (left or right). 7 left, 7 right.",
      "After each shot, answer two questions: (1) Did you land on the correct side? (2) Was it inside 5 meters of the target?",
      "Points: correct side + inside 5m = 3pts, wrong side + inside 5m = 2pts, correct side + outside 5m = 1pt, wrong + outside = −1pt.",
    ],
    questions: [
      { text: "Did you land on the correct side?", conditional_on_previous: false },
      { text: "Was it inside 5 meters?", conditional_on_previous: false },
    ],
    scoring_combos: [
      { answers: [true, true], points: 3, label: "Correct side + inside 5m" },
      { answers: [false, true], points: 2, label: "Wrong side + inside 5m" },
      { answers: [true, false], points: 1, label: "Correct side + outside 5m" },
      { answers: [false, false], points: -1, label: "Wrong side + outside 5m" },
    ],
    total_shots: 14,
    shot_labels: [
      "130m - Left", "135m - Right", "140m - Left", "145m - Right",
      "150m - Left", "155m - Right", "160m - Left", "165m - Right",
      "170m - Left", "140m - Right", "150m - Left", "160m - Right",
      "145m - Left", "155m - Right",
    ],
    lower_is_better: false,
    benchmarks: { hcp_0: 32, hcp_10: 22, hcp_20: 12 },
    hcp: { input: "5", value: 5, band: "0_to_5" },
  },

  // ── RETRY ENTRY ────────────────────────────────────────────────────
  {
    drill_type: "retry_entry",
    title: "9 Windows: Trajectory × Shape",
    goal: "Master all 9 trajectory and shape combinations with one club.",
    icon: "square.grid.3x3",
    time_minutes: 20,
    shot_area: "mixed",
    setup_steps: [
      "Use a 7-iron only for the entire drill.",
      "Pick a target on the range with a 15-meter landing zone.",
    ],
    rules: [
      "Complete 9 windows: High Fade, High Straight, High Draw, Mid Fade, Mid Straight, Mid Draw, Low Fade, Low Straight, Low Draw.",
      "Windows are presented in random order.",
      "Hit until you execute the correct trajectory + shape within the 15m target. Then advance to the next window.",
      "Score = total shots to complete all 9 windows. Perfect = 9.",
    ],
    targets: [
      { label: "High Fade" }, { label: "High Straight" }, { label: "High Draw" },
      { label: "Mid Fade" }, { label: "Mid Straight" }, { label: "Mid Draw" },
      { label: "Low Fade" }, { label: "Low Straight" }, { label: "Low Draw" },
    ],
    pass_label: "Next Shot",
    retry_label: "Try Again",
    shuffle_targets: true,
    lower_is_better: true,
    benchmarks: { hcp_0: 11, hcp_10: 16, hcp_20: 25 },
    hcp: { input: "3", value: 3, band: "0_to_5" },
  },

  // ── BUNKER ────────────────────────────────────────────────────────────
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
      "Streak bonus: 2 'Within 2m' in a row earns +2 bonus points.",
      "If you leave 3 balls in the bunker during the drill, restart from 0 points.",
    ],
    outcomes: [
      { label: "Within 2m", points: 3 },
      { label: "On green", points: 1 },
      { label: "Missed green", points: 0 },
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

const DRILL_TYPES = ["points", "score_entry", "station_entry", "station_outcomes", "conditional_entry", "retry_entry"] as const
type DrillType = (typeof DRILL_TYPES)[number]

const REQUIRED_FIELDS: Record<DrillType, string[]> = {
  points: ["outcomes", "target_points", "distances", "end_condition"],
  score_entry: ["score_label", "prompt"],
  station_entry: ["stations", "station_score_min", "station_score_max", "station_score_label"],
  station_outcomes: ["outcomes", "stations", "total_shots", "shuffle_stations"],
  conditional_entry: ["questions", "scoring_combos", "total_shots"],
  retry_entry: ["targets", "pass_label", "retry_label", "shuffle_targets"],
}

function isDrillType(s: unknown): s is DrillType {
  return typeof s === "string" && DRILL_TYPES.includes(s as DrillType)
}

function buildRetryHint(attempted: unknown, zodErrors?: string): string {
  const obj =
    attempted != null && typeof attempted === "object"
      ? (attempted as Record<string, unknown>)
      : null
  const dt = obj && "drill_type" in obj ? obj.drill_type : undefined

  const errorDetail = zodErrors ? ` Zod errors: ${zodErrors}.` : ""

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
    return `Schema validation failed. ${clause}${errorDetail} Output only valid JSON.`
  }
  return `Schema validation failed. drill_type must be one of: "points", "score_entry", "station_entry", "station_outcomes", "conditional_entry", "retry_entry". Include all required fields.${errorDetail} Output only valid JSON.`
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
  "mixed", // legacy — kept for existing drills
] as const

function isShotArea(s: unknown): boolean {
  if (typeof s !== "string") return false
  // Accept single area or comma-separated list (e.g. "putting,chipping")
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 && parts.every((p) => (SHOT_AREAS as readonly string[]).includes(p))
}

const PRACTICE_AREAS = [
  "driving_range",
  "short_game_area",
  "on_course",
  "indoor_simulator",
] as const

const MEASUREMENT_METHODS = [
  "launch_monitor",
  "visual_manual",
] as const

// Legacy values that map to current options
const MEASUREMENT_LEGACY: Record<string, string> = {
  simulator_builtin: "launch_monitor",
  no_measurement: "visual_manual",
}

function isPracticeArea(s: unknown): boolean {
  return typeof s === "string" && (PRACTICE_AREAS as readonly string[]).includes(s)
}

function isMeasurementMethod(s: unknown): boolean {
  if (typeof s !== "string") return false
  return (MEASUREMENT_METHODS as readonly string[]).includes(s) || s in MEASUREMENT_LEGACY
}

function normalizeMeasurementMethod(s: string): string {
  return MEASUREMENT_LEGACY[s] ?? s
}

function buildSystemPrompt(): string {
  const examplesJson = JSON.stringify(coachDrillExamples, null, 2)

  return `You are a golf coach creating structured practice drills. Output only valid JSON, no markdown or extra text.

Create exactly ONE drill tuned to the player's HCP band. Adjust distances, targets, and penalties directly — do NOT include a difficulty_by_band object.

SIX DRILL TYPES (discriminator: "drill_type"):

1) "points" — Interactive drill with outcome buttons and distance cycling. Ends when target_points reached.
   Required: outcomes (array of {label: string, points: number}, min 2), target_points (number), distances (number[] in meters, min 1), end_condition (string).
   The app renders outcome buttons the player taps after each shot. Distances cycle automatically.
   HOW SCORING WORKS: The player's final score = total shots taken to reach target_points. lower_is_better MUST be true for all points drills (fewer shots = better). Design outcomes so skilled execution earns points fast and poor execution costs points, extending the drill. target_points must always be a positive number.

2) "score_entry" — Simple drill where the player enters a single numeric score at the end.
   Required: score_label (string), prompt (string, the question shown to the player), score_unit (string, optional).
   The app shows the prompt and a number input field. IMPORTANT: The app only accepts integers (positive or negative, no decimals). Design scoring systems that always produce whole number results.
   GREAT FOR: success-out-of-N drills ("how many out of 10 landed within 3m?"), longest-streak drills, counting drills, distance-estimation drills, up-and-down percentage drills.

3) "station_entry" — Per-station drill where the player records a numeric score at each station/distance.
   Required: stations (number[] of distances in meters, min 3), station_score_min (number, minimum button value e.g. 1), station_score_max (number, maximum button value e.g. 5), station_score_label (string, label shown above buttons e.g. "Putts taken").
   The app shuffles stations randomly, shows one station at a time with the distance prominently displayed, renders horizontal numbered buttons from station_score_min to station_score_max, tracks a running total, and auto-saves when all stations are completed. Score = sum of all station scores.
   GREAT FOR: PGA Tour 18-style drills, multi-distance putting tests, up-and-down circuits where the player counts strokes per station.

4) "station_outcomes" — Fixed stations with outcome buttons. Plays all shots, no target_points exit.
   Required: outcomes (array of {label, points}, min 2), stations (string[] of station labels, min 1), total_shots (number), shuffle_stations (boolean).
   The app shows one station at a time with its label, renders outcome buttons (same as "points"), auto-advances. Drill ends when all total_shots are done. Score = sum of outcome points.
   KEY DIFFERENCE FROM "points": no target_points — ALWAYS plays exactly total_shots. Use when you want fixed shot count with graded outcomes.
   If total_shots > stations.length, stations cycle (multiple rounds). If shuffle_stations is true, order is randomized.
   GREAT FOR: lag putting proximity drills (fixed distances, 6 proximity outcomes), short game circuits (rotate through stations with proximity scoring), approach accuracy (fixed distances with outcome grading), any drill with a fixed number of shots and labeled outcome buttons.

5) "conditional_entry" — Per-shot sequential yes/no questions with point lookup.
   Required: questions (array of {text, conditional_on_previous}, min 2, max 3), scoring_combos (array of {answers: boolean[], points, label}), total_shots (number).
   Optional: shot_labels (string[], per-shot context like "Draw - Driver").
   Each shot shows questions one at a time. Q1 always visible. Q2 reveals after Q1 answered. Q3 (if conditional_on_previous=true) only shown if Q2=No; skipped if Q2=Yes. Points computed by matching answers to scoring_combos.
   GREAT FOR: approach control (correct side? + inside 5m?), shot shape assessment (hit shape? + fairway? + miss distance?), any multi-criteria per-shot evaluation.

6) "retry_entry" — Pass/retry through a target list. Score = total attempts.
   Required: targets (array of {label}, min 2), pass_label (string, e.g. "Hit Target"), retry_label (string, e.g. "Try Again"), shuffle_targets (boolean).
   Player attempts each target. Tap pass_label to advance to next target. Tap retry_label to try again (stays on same target). Score = total button taps (passes + retries). lower_is_better MUST be true. Perfect score = targets.count.
   GREAT FOR: shot shape windows (9 trajectory × shape combos), wedge ladders (climb through distances), any "master each item" progression drill.

TYPE SELECTION GUIDE:
- "points": shot-by-shot decisions with varying outcomes, VARIABLE length (ends at target_points)
- "station_outcomes": shot-by-shot outcomes at FIXED stations, FIXED length (plays all shots)
- "station_entry": per-station NUMERIC score (1-5 range), FIXED stations
- "conditional_entry": multi-question evaluation per shot, computed points
- "retry_entry": pass/retry through targets, score = attempt count
- "score_entry": single number entered at end (most flexible, least interactive)

ALL DRILLS require: title, goal, icon (SF Symbol name e.g. "target", "figure.golf", "scope", "flame", "bolt.fill"), time_minutes (5-60), shot_area (one of: "putting"/"chipping"/"pitching"/"bunker"/"wedges"/"driver" — pick the single BEST fit for the drill even if the request mentions multiple areas), setup_steps (string[], min 2), rules (string[], min 2), lower_is_better (boolean), hcp ({input: string|null, value: number|null, band: HcpBand}).

HCP bands: plus_5_to_0, 0_to_5, 6_to_12, 13_to_20, 21_to_30, 31_plus, no_hcp.

HCP TUNING — adapt ALL of these to the player's band:
- Distances: shorter for higher HCP.
  PUTTING distance guide by HCP (DEFAULT ranges when the user gives no specific distance preference):
    31+: 0.5m to 2m (learn to hole short putts consistently)
    21-30: 1m to 3m (build confidence inside 10 feet)
    13-20: 1.5m to 5m (develop mid-range reliability)
    6-12: 2m to 8m (full putting range, introduce speed control)
    0-5: 3m to 12m (tour-level distances, heavy lag component)
    plus: 4m to 16m (elite lag putting + holing from distance)
  IMPORTANT: These are DEFAULTS only. If the user's goal mentions "short putts", "close range", "1 meter", or any specific distance, ALWAYS honor their request regardless of HCP band. A scratch golfer asking for short putting practice should get 0.5m-2m putts, not 3m+ putts. The user's stated goal always overrides the HCP distance defaults.

  REAL PUTTING MAKE PERCENTAGES BY HCP (use these to set realistic targets and scoring):
                        0 HCP   5 HCP   10 HCP  15 HCP  20 HCP  25 HCP
    0-0.9m (0-3ft):    98%     96%     96%     93%     90%     88%
    0.9-1.8m (3-6ft):  76%     67%     65%     59%     55%     48%
    1.8-2.7m (6-9ft):  49%     44%     39%     36%     33%     30%
    2.7-3.6m (9-12ft): 34%     34%     26%     22%     18%     17%
    3.6-5.5m (12-18ft): 19%    19%     18%     16%     14%     12%
    5.5-7.3m (18-24ft): 12%    13%     10%     9%      7%      6%
    7.3-9m (24-30ft):   7%     7%      7%      7%      5%      4%
    9m+ (30ft+):        4%     3%      3%      2%      2%      2%

  ROUND PUTTING STATISTICS BY HCP:
                          0 HCP   5 HCP   10 HCP  15 HCP  20 HCP  25 HCP
    Avg putts/round:      29.3    30      31      31.8    32.2    33.3
    1-putt %:             37%     36%     31%     29%     29%     25%
    2-putt %:             60%     60%     62%     60%     57%     61%
    3-putt %:             3%      4%      7%      11%     14%     14%
    Avg holes per 3-putt: 39.2    20.7    14.9    10.4    8.2     7.6
    Avg length holed (ft): 4.1    4.0     3.9     3.7     3.6     3.7

  LAG PUTTING PROXIMITY (average distance remaining after first putt from 9m+/30ft+):
    0 HCP: 1.4m (4.6ft)    5 HCP: 1.7m (5.7ft)    10 HCP: 1.9m (6.1ft)
    15 HCP: 2.2m (7.2ft)   20 HCP: 2.2m (7.2ft)   25 HCP: 2.4m (7.8ft)

  KEY INSIGHTS from the data:
  - Under 0.9m (3ft): near-automatic for all levels (88-98%) — drills here should be about building rhythm, not challenge
  - 0.9-1.8m (3-6ft): the BIGGEST skill gap — scratch 76% vs 25 HCP 48%. This is where practice matters most
  - 1.8-2.7m (6-9ft): even scratch golfers miss more than half (49%). A 25 HCP holes only 30%
  - Beyond 2.7m (9ft): make rates drop sharply for everyone. A 15 HCP holes only 22% from 3m
  - 3-putts: scratch golfers 3-putt once every 39 holes, 25 HCP once every 7.6 holes — huge skill gap
  - From 9m+, even scratch golfers leave the ball 1.4m away on average
  - The average putt holed across ALL handicaps is only ~1.2m (4ft)
  - Use these to:
    - Set REALISTIC target scores: from 1.5m, even a scratch golfer holes ~65%, so "make 13 out of 20" is a realistic stretch target, not "make 18 out of 20"
    - For 3m+, design drills around two-putt avoidance and proximity, not just holing out
    - Grade lag putting outcomes fairly: leaving a 9m putt within 1.5m is scratch-level performance
    - The 0.9-1.8m (3-6ft) range is the most trainable and impactful — prioritize drills here

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

DRILL STRUCTURES FOR "station_entry" (app shows one station at a time, player taps score button, auto-completes):
- Per-distance putting: fixed distances, record putts taken at each (1-5). Like PGA Tour 18.
- Up-and-down circuit: varied lie/distance stations, record strokes to hole out at each (1-5).
- Proximity stations: approach from multiple distances, score each station on a 1-5 proximity scale.

DRILL STRUCTURES FOR "station_outcomes" (app shows station label + outcome buttons, fixed shot count):
- Lag putting proximity: fixed putt distances as station labels ("8m", "10m uphill"), proximity outcome buttons (Holed/Within 0.5m/Within 1m/etc.), total_shots = station count.
- Short game circuit: station labels describe the shot ("Chip 10m", "Pitch 30m", "Bunker 15m"), outcome buttons grade quality.
- Approach accuracy: station labels are distances + context ("140m left pin", "160m right"), outcome buttons grade proximity.
- Multi-round: total_shots > stations.length means multiple passes through stations (e.g. 8 stations × 2 rounds = 16 total_shots).
- stations are STRING labels — use descriptive names like "6m uphill", "Chip 15m to back pin", "140m - Left target". NOT raw numbers.

DRILL STRUCTURES FOR "conditional_entry" (app shows sequential yes/no questions per shot):
- Side + proximity: Q1 "Correct side?" Q2 "Inside 5m?" — 4 scoring combos from 2 binary answers.
- Shape + fairway + proximity: Q1 "Hit the required shape?" Q2 "Hit the fairway?" Q3 (conditional, shown if Q2=No) "Within 10m of fairway?" — 4+ combos.
- Green hit + proximity: Q1 "Hit the green?" Q2 "Inside 5m of pin?" — evaluate approach accuracy.
- shot_labels are optional per-shot context (e.g. "Draw - Driver", "Fade - 3W", "130m Left") to tell the player what to do for each shot.
- scoring_combos MUST cover ALL possible answer combinations. For 2 questions: 4 combos (TT, TF, FT, FF). For 3 questions with Q3 conditional: the Q3 path only applies when Q2=No, so combos are: [T,T], [T,F], [F,T], [F,F,T], [F,F,F] (5 combos).

DRILL STRUCTURES FOR "retry_entry" (app shows target + pass/retry buttons, score = total attempts):
- Shot shape windows: targets like "High Fade", "Mid Draw", "Low Straight" — player retries until they execute, then advances.
- Wedge ladder: targets are distances like "60m", "70m", "80m" — player retries until landing within tolerance, then advances.
- Putting gates: targets are putt challenges like "3m uphill", "5m right-to-left" — retry until holed, then advance.
- Skill checklist: targets are specific skills to demonstrate — "Bump and run 15m", "Flop over bunker", "Chip from rough".
- lower_is_better MUST be true. Perfect score = number of targets (one attempt each). More retries = worse score.
- pass_label and retry_label should be descriptive: "Hit Target" / "Try Again", "Advance" / "Retry", "Next Window" / "Try Again".

IMPORTANT: For points drills, the saved score is ALWAYS total shots taken (fewer = better). Therefore lower_is_better MUST be true for ALL points drills. Use score_entry if higher scores are better.

GENERAL VARIETY:
- Spread across all 6 types. Don't default to "points" for everything.
- station_outcomes is great when you want fixed shot count + graded outcomes (lag putting, short game circuits).
- conditional_entry adds depth when shots need multi-criteria evaluation (side accuracy + proximity, shape + fairway).
- retry_entry is ideal for progression/mastery drills (shot shape windows, wedge ladders).
- score_entry enables the most diverse structures (survival, gate, clock, streak).
- station_entry for per-station numeric scoring (PGA Tour 18 style).
- points for variable-length pressure drills with target_points exit.
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

SHOT AREA OUTCOME GUIDANCE — use specific, measurable labels with distances. Every label must describe what the ball did, not a generic term:
- putting: "Holed", "Lip-out", "0.5m past", "0.5m short", "1m+ past", "2m+ away"
- chipping: "Inside 1m", "Within 3m", "On green, 3m+", "Missed green", "Thin – ran through", "Fat – came up short"
- pitching: "Within 2m", "Within 5m", "On green, 5m+", "Missed green short", "Thin – low & long", "Fat – short & high"
- bunker: "Within 2m", "On green", "Missed green", "Still in bunker", "Thin – flew over green"
- wedges: "Within 3m", "Within 5m", "On green, 5m+", "Short of green", "Long of green", "Thin – low runner", "Fat – came up short"
- driver: "Fairway center", "Fairway edge", "Light rough", "Deep rough/trees", "OB/lost"

OUTCOME LABEL RULES — labels appear as buttons on a phone screen:
- Maximum 4 words per label. Shorter is better.
- Be SPECIFIC with distances/measurements — vague labels are useless mid-drill.
- Each label must describe a single shot result, not a condition or rule.
- BAD: "Beyond half a meter but not holed" -> GOOD: "0.5m past"
- BAD: "At or within half a meter beyond" -> GOOD: "Within 0.5m"
- BAD: "Second miss in a row, score reset" -> This is a RULE, not an outcome. Put streak penalties in the rules array instead.
- BAD: "Good pace" (vague) -> GOOD: "1m past" (specific)
- BAD: "3-putt range" (vague) -> GOOD: "2m+ away" (specific distance)
- NEVER use distance RANGES in labels. Always use a single specific distance.
  BAD: "1-2m", "0.6m–1m", "2–3m" (ranges are vague — the player can't tell which button to press)
  GOOD: "Within 1m", "1.5m past", "Within 3m", "0.5m short" (one specific distance per label)
  If you need to cover a range, use thresholds: "Within 1m" then "Within 2m" then "2m+ away" — NOT "1-2m".
- Labels should be instantly understandable mid-drill. If you have to re-read it, it's too long.
- Every label MUST include a specific distance OR a specific shot fault. Never use vague golf jargon.
- BANNED LABELS (never use these or similar): "Mishit", "Misshit", "Duffed", "Skulled", "Chunked", "Good", "Bad", "Poor", "OK", "Decent", "Good pace", "3-putt range", "Close", "Far". These are too vague — the player can't tell what happened.
- Instead describe the SHOT OUTCOME: what the ball did and where it went. A thin contact = "Thin – low & long". A fat strike = "Fat – came up short". A toe strike = "Toe – pushed right". A skulled chip = "Thin – ran through".
- Putting examples: "Holed", "Lip-out", "0.5m short", "0.5m past", "1m+ past", "2m+ away"
- Chipping examples: "Inside 1m", "Within 3m", "On green, 3m+", "Missed green", "Thin – ran through", "Fat – came up short"
- General: always use meters (e.g. "Within 2m", "1m short") or specific fault descriptions ("Thin – low runner", "Fat – short") instead of single vague words

EQUIPMENT RULES:
- NEVER use alignment sticks in putting drills. Use tees, coins, or markers to mark starting positions and distances on the green. Alignment sticks are fine for range/full-swing drills only.

SETUP INSTRUCTION SPECIFICITY — every distance in setup_steps must be a single specific number, never a range:
- BAD: "Set up 9 locations between 1.5-3 meters" (vague — the player doesn't know which 9 distances to use)
- GOOD: "Set up 9 putting stations at: 1.5m, 1.7m, 1.9m, 2.1m, 2.3m, 2.5m, 2.7m, 2.9m, 3m"
- BAD: "Place tees at various distances from 2-6 meters"
- GOOD: "Place tees at 2m, 3m, 4m, 5m, and 6m from the hole"
- If a drill uses multiple distances/stations, LIST EVERY SPECIFIC DISTANCE. The player should be able to set up the drill without guessing.
- Use the HCP distance guide above to pick appropriate specific distances for the player's level.

QUALITY RULES:
- No generic tips ("focus on technique", "stay relaxed"). Every step must be actionable.
- Include concrete constraints (distance, width, attempts, target score).
- Distances must be in meters.
- For "points" drills with 3+ outcomes: include a mix of positive, zero, and negative point values. For 2-outcome drills (binary make/miss), use one positive and one negative value — no 0-point needed.
- For "points" drills: lower_is_better MUST be true (saved score = total shots taken). target_points must be a positive number.
- For "score_entry" drills: the prompt must be a clear question answerable with a number. Include total reps or test conditions in the rules.

PUTTING HCP BENCHMARKS — for "score_entry" putting drills (shot_area == "putting"), ALWAYS include a "benchmarks" object with three HCP-anchored scores:
- hcp_0: what score a scratch golfer (0 HCP) would achieve on this drill
- hcp_10: what score a 10 HCP golfer would achieve
- hcp_20: what score a 20 HCP golfer would achieve
- Use the REAL PUTTING MAKE PERCENTAGES table above to calculate realistic benchmarks. For example, if a drill asks "how many out of 20 from 1.5m?": scratch (76% make rate) → hcp_0 = 15, 10 HCP (65%) → hcp_10 = 13, 20 HCP (55%) → hcp_20 = 11.
- If lower_is_better is true, hcp_0 < hcp_10 < hcp_20 (better players score lower).
- If lower_is_better is false, hcp_0 > hcp_10 > hcp_20 (better players score higher).
- The app uses these to reverse-interpolate the player's score to an estimated putting handicap.
- For "points" putting drills, benchmarks are NOT needed (the app calculates them from per-shot data).
- For non-putting drills, benchmarks are optional.

ENVIRONMENT & EQUIPMENT ADAPTATION — if a practice area or measurement method is specified in the user prompt, adapt the drill accordingly:
- driving_range: Use distance markers and bay width for setup. Distances can be specific (e.g. 87m). Multiple targets available.
- short_game_area: Use flag positions for targets. If specific flag distances are provided, use ONLY those distances in the drill — do not invent distances the player doesn't have flags for. Setup should reference flags, not abstract targets.
- on_course: Include hole selection guidance in setup. Use real-course elements (bunkers, slopes, pin positions). Setup should describe how to choose a hole/area.
- indoor_simulator: Reference simulator readout in setup. Use simulator-specific metrics (carry distance, spin, launch angle).

Measurement method adaptation:
- launch_monitor: Player has shot tracking (launch monitor, simulator, or similar device). Use precise carry/total distances in outcomes (e.g. "Carry within 2m of target"). Include dispersion metrics. Distances can be very specific (e.g. 87m, 103m). Setup can reference device readouts.
- visual_manual: Player measures visually (pacing, landing near flags, by eye). Use visual proximity outcomes (e.g. "Within 1 club length of flag", "Past the flag"). Use round distances (e.g. 80m, 90m, 100m). Include pacing or flag-based measurement in setup/rules. Focus on process and observable outcomes.

If no environment is specified, design for a standard driving range with visual measurement (the most common setup).

DRILL DESIGN PRINCIPLES — think like a PGA teaching professional:
- Every rule must interact with other rules. If distances cycle, scoring should reflect difficulty at each distance.
- When a drill has multiple distances, design mechanics around them: "one attempt per distance per round" or "cycle through all distances" — never just list distances with no structure explaining how they're used.
- Scoring must create tension: the player should feel they could fail. If target_points is trivially easy to reach, the drill has no value.
- Setup must be physically realistic: one player alone on a practice green or range with 5-10 balls and basic markers.
- Rules should be unambiguous: another golfer reading them should be able to run the drill without any clarification.
- RULE CONSISTENCY CHECK: Before finalizing, verify every rule is compatible with every other rule. Common contradiction: one rule says "a miss resets distance/position" (drill continues) while another says "count total before a miss" or "miss ends the round" (drill stops). A drill must use ONE miss mechanic consistently.
- Avoid "impossible to fail" drills (e.g. just counting shots with no penalty) and "impossible to complete" drills (e.g. target too high with harsh penalties).
- For score_entry drills: the prompt question must have exactly one clear numeric answer.

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
  if (!shotArea) return "Consider using score_entry drill type for this one."
  // Multi-area (comma-separated) or legacy "mixed"
  if (shotArea.includes(",") || shotArea === "mixed")
    return "This drill covers multiple shot areas — consider station_outcomes (fixed stations + outcome grading) or score_entry."
  if (shotArea === "bunker" || shotArea === "driver")
    return "Consider: score_entry (success count out of N), station_outcomes (fixed stations + outcome buttons), or retry_entry (pass/retry through targets)."
  if (shotArea === "putting")
    return "All six drill types work for putting. Points: make/miss pressure, variable length. Station_outcomes: fixed stations with proximity grading. Station_entry: per-distance numeric score (like PGA Tour 18). Score_entry: survival, gate, clock, streak. Conditional_entry: multi-criteria per-putt evaluation. Retry_entry: master each target before advancing. Pick whichever fits the drill concept best."
  if (shotArea === "wedges" || shotArea === "pitching" || shotArea === "chipping")
    return "Consider: station_outcomes (fixed distances + outcome buttons), conditional_entry (multi-criteria per-shot), retry_entry (pass/retry ladder), points (variable-length outcome buttons), or score_entry (single number at end)."
  return null
}

interface GenerateBody {
  goal?: string
  hcpInput?: string | null
  timeMinutes?: number
  shotArea?: string | null
  baseDrill?: Record<string, unknown> | null
  existingId?: string | null
  practiceArea?: string | null
  measurementMethod?: string | null
  flagDistances?: number[] | null
}

function buildUserPrompt(body: GenerateBody, parsed: ParsedHcp): string {
  const parts: string[] = []

  if (body.baseDrill) {
    // Remix mode: redesign the drill based on the player's request
    // Strip hcp from baseDrill — the system overwrites it with parsedHcp anyway
    const { hcp: _hcp, ...baseDrillClean } = body.baseDrill
    parts.push(
      `Remix this existing drill based on the player's request. Here is the original drill:\n\n${JSON.stringify(baseDrillClean, null, 2)}\n`
    )
    parts.push(
      `Requested changes: ${body.goal || "make it slightly different"}`
    )
    parts.push(
      `REMIX RULES — BE CONSERVATIVE:
- ONLY change what the player explicitly asked for. Preserve EVERYTHING else from the original drill.
- If the player asks to reduce holes/stations (e.g. "9 holes"), keep the SAME scoring system, distance structure, and drill_type. Just pick a subset of distances or reduce repetitions.
- If the player asks to change difficulty, adjust targets and penalties but keep the same drill structure and mechanics.
- Keep the same drill_type unless the changes CLEARLY require switching (e.g. asking for shot-by-shot buttons when the original was score_entry).
- Keep the same scoring system. If the original uses "count putts per station (1-5)", the remix must too. If it uses proximity outcomes, keep those outcomes.
- Keep the same rules and mechanics unless the change request directly contradicts them.
- Distances/stations: REDESIGN the full set to be well-distributed across the original range. If increasing from 12→15, don't just append extras — create a fresh set of 15 distances that spans the same min-to-max range with good spacing. If reducing from 18→9, pick a well-distributed subset (keep the range and variety). Never just tack on or remove a few values at the edges.
- Rules, setup_steps, end_condition, and outcomes must ALL be internally consistent with each other.
- CRITICAL: Check every rule against every other rule for contradictions. A common mistake: one rule says "a miss resets that position" (implying the drill continues) while another rule says "count putts before a miss" (implying the drill ends on a miss). Pick ONE miss mechanic and make ALL rules consistent with it.
- Generate a new title that reflects the changes.`
    )
  } else {
    // Normal generation mode
    parts.push(
      `Design a practice drill for this goal: ${body.goal || "general practice"}`
    )
  }

  parts.push(
    `Player: HCP band ${parsed.band}${parsed.input != null ? ` (handicap ${parsed.value})` : ""}. ${getHcpContext(parsed.band)}`
  )
  if (typeof body.timeMinutes === "number")
    parts.push(`Time budget: ${body.timeMinutes} minutes.`)
  if (body.shotArea) {
    if (body.shotArea.includes(",")) {
      const areas = body.shotArea.split(",").map((a) => a.trim())
      parts.push(`Shot areas: ${areas.join(", ")}. Design a drill that incorporates these areas.`)
    } else {
      parts.push(`Shot area: ${body.shotArea}.`)
    }
  }

  // Environment & equipment context
  if (body.practiceArea) {
    const areaDescriptions: Record<string, string> = {
      driving_range: "Driving range with open bays and distance markers on the ground.",
      short_game_area: "Short game practice area with flag targets.",
      on_course: "On-course practice (real holes, real conditions).",
      indoor_simulator: "Indoor simulator environment.",
    }
    parts.push(`Practice area: ${areaDescriptions[body.practiceArea] || body.practiceArea}`)

    if (body.practiceArea === "short_game_area" && body.flagDistances && body.flagDistances.length > 0) {
      const sorted = [...body.flagDistances].sort((a, b) => a - b)
      parts.push(`Available flag distances: ${sorted.join("m, ")}m. Use ONLY these distances for the drill.`)
    }
  }

  if (body.measurementMethod) {
    const measureDescriptions: Record<string, string> = {
      launch_monitor: "Player has shot tracking (launch monitor, simulator, or similar device) — use exact carry distances and dispersion metrics in outcomes.",
      visual_manual: "Player measures visually (pacing, landing near flags) — use visual proximity outcomes (e.g. 'within 3m of flag'). Use round distances. Focus on process and observable outcomes.",
    }
    parts.push(measureDescriptions[body.measurementMethod] || "")
  }

  if (!body.baseDrill) {
    const nudge = getDrillTypeNudge(body.shotArea ?? null)
    if (nudge) parts.push(nudge)
  }

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
      model: "gpt-4o",
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

  const zodErrors = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ")
  console.error("[generate-drill] Zod errors:", zodErrors)

  if (retryHint) throw new Error("Drill schema validation failed after retry")
  const hint = buildRetryHint(parsed, zodErrors)
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
      baseDrill:
        rawBody.baseDrill != null && typeof rawBody.baseDrill === "object"
          ? rawBody.baseDrill
          : null,
      existingId:
        typeof rawBody.existingId === "string" && rawBody.existingId.length > 0
          ? rawBody.existingId
          : null,
      practiceArea:
        rawBody.practiceArea != null && isPracticeArea(rawBody.practiceArea)
          ? rawBody.practiceArea
          : null,
      measurementMethod:
        rawBody.measurementMethod != null && isMeasurementMethod(rawBody.measurementMethod)
          ? normalizeMeasurementMethod(rawBody.measurementMethod)
          : null,
      flagDistances:
        Array.isArray(rawBody.flagDistances)
          ? rawBody.flagDistances.filter((d: unknown) => typeof d === "number" && d > 0)
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
    if (body.existingId) {
      // Refinement: update existing drill in-place
      const { error: updateError } = await supabase
        .from("coach_drills")
        .update({
          title: drill.title,
          goal: drill.goal,
          payload: drill,
        })
        .eq("id", body.existingId)
        .eq("coach_id", user.id) // security: only owner can update

      if (updateError) {
        console.error(
          "[generate-drill] Supabase update error:",
          updateError.code,
          updateError.message,
          updateError.details
        )
        return json({
          id: body.existingId,
          drill,
          saved: false,
          hint: "Drill generated but not updated.",
        })
      }

      return json({ id: body.existingId, drill, saved: true })
    } else {
      // New drill: insert
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
    }
  } catch (error: unknown) {
    console.error("[generate-drill]", error)
    const msg =
      error instanceof Error ? error.message : "Unknown error occurred"
    return json({ error: msg }, 500)
  }
})
