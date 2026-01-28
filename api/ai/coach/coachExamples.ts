/**
 * Few-shot examples for Coach AI drill generation.
 * Three real drills (Short Game Variety Circuit, Fairway Width Ladder, Match Play Short-Game Battle)
 * plus Aggressive Putting. Each matches the strict drill schema and includes difficulty_by_band for all 7 HCP bands.
 */

const d = (changes: string[], target: string) => ({ changes, target });

export const coachDrillExamples = [
  {
    mode: "singles" as const,
    drill_type: "points" as const,
    title: "Short Game Variety Circuit",
    goal: "Build consistency and precision across all short game shots under game-like variety.",
    time_minutes: 45,
    setup_steps: [
      "Set up 8 stations around the green: chip, pitch, lob, and bunker shots at varying distances.",
      "Place one target hole for all stations or rotate pins if available.",
      "Have a measuring tool ready to record proximity to the hole.",
    ],
    rules: [
      "Complete all 8 stations in sequence to finish one circuit.",
      "Repeat the full circuit 5 times (40 shots total).",
      "Never hit the same type of shot twice in a row.",
      "Record proximity after every shot.",
    ],
    scoring: [
      "Holed = +4 points",
      "Within 1 m = +3 points",
      "1–2 m = +2 points",
      "2–3 m = +1 point",
      "Outside 3 m = 0 points",
    ],
    target_points: 60,
    end_condition: "Drill ends after 5 full circuits. Highest total score wins.",
    log_fields: ["total_score", "best_round", "notes"],
    hcp: { input: "8", value: 8, band: "6_to_12" as const },
    recommended_hcp_bands: ["0_to_5", "6_to_12", "13_to_20"] as const,
    difficulty_by_band: {
      plus_5_to_0: d(
        ["Increase distances by 5–10 m", "Reduce scoring zone by 0.5 m"],
        "70+ points"
      ),
      "0_to_5": d(
        ["Standard distances", "Strict proximity measurement"],
        "65+ points"
      ),
      "6_to_12": d(["Standard setup"], "60+ points"),
      "13_to_20": d(
        ["Reduce distances by 5 m", "Allow one replay per circuit"],
        "55+ points"
      ),
      "21_to_30": d(
        ["Reduce to 6 stations", "Widen scoring zones"],
        "50+ points"
      ),
      "31_plus": d(
        ["Chip and pitch only", "No bunker shots"],
        "Complete all circuits with stable contact"
      ),
      no_hcp: d(
        ["Chip-only stations", "No score penalties"],
        "Finish 5 circuits with consistent contact"
      ),
    },
  },
  {
    mode: "singles" as const,
    drill_type: "succeed_fail" as const,
    title: "Fairway Width Ladder",
    goal: "Improve driver accuracy and commitment under narrowing margins.",
    time_minutes: 20,
    setup_steps: [
      "Visualize or mark fairways of 40y, 30y, 20y, and 10y width.",
      "Use the same starting point for all shots.",
      "Have at least 30 balls available.",
    ],
    rules: [
      "Start at the 40y fairway.",
      "Hit driver until you land 3 consecutive balls inside the fairway.",
      "Once successful, move to the next narrower fairway.",
      "If you miss, the streak resets at that width.",
    ],
    success_criteria: "3 consecutive balls inside the defined fairway width.",
    attempts: 30,
    pass_threshold: 4,
    fail_rule: "If attempts run out, the drill ends at the last completed width.",
    log_fields: ["max_width_completed", "attempts_used", "notes"],
    hcp: { input: "12", value: 12, band: "6_to_12" as const },
    recommended_hcp_bands: ["0_to_5", "6_to_12", "13_to_20"] as const,
    difficulty_by_band: {
      plus_5_to_0: d(["Add 5th level at 8y width"], "Complete all widths"),
      "0_to_5": d(["Standard ladder"], "Reach 10y width"),
      "6_to_12": d(["Standard ladder"], "Reach 20y width"),
      "13_to_20": d(["Start at 50y width"], "Reach 20y width"),
      "21_to_30": d(["Only 40y → 30y → 20y"], "Reach 20y width"),
      "31_plus": d(["Use hybrid instead of driver"], "Complete first width"),
      no_hcp: d(["Single success required per width"], "Complete ladder once"),
    },
  },
  {
    mode: "teams" as const,
    drill_type: "match_play" as const,
    title: "Match Play Short-Game Battle",
    goal: "Apply short-game skill under competitive match-play pressure.",
    time_minutes: 40,
    setup_steps: [
      "Create 4 teams of 2 players.",
      "Set 2–3 pins on one practice green.",
      "Drop balls 5–30 m from the green (chip, pitch, bunker mix).",
    ],
    rules: [
      "Each player plays one ball per hole.",
      "Teams compete head-to-head in match play.",
      "Least total shots wins the hole.",
      "Change lie and distance every hole.",
    ],
    scoring: [
      "Win hole = 1 point",
      "Tie hole = 0.5 points",
      "Both players up-and-down = +1 bonus point",
    ],
    match_format: "Best ball match play",
    holes_or_rounds: 9,
    win_condition: "Team with the most points after all rotations wins.",
    log_fields: ["points", "holes_won", "notes"],
    hcp: { input: "15", value: 15, band: "13_to_20" as const },
    recommended_hcp_bands: ["6_to_12", "13_to_20", "21_to_30"] as const,
    difficulty_by_band: {
      plus_5_to_0: d(
        ["Harder lies only", "Bonus point requires both holed chips"],
        "Win 6+ holes"
      ),
      "0_to_5": d(["Standard setup"], "Win majority of matches"),
      "6_to_12": d(["Standard setup"], "4+ points"),
      "13_to_20": d(["Allow preferred lies"], "3+ points"),
      "21_to_30": d(["Shorter distances only"], "Win 2 holes"),
      "31_plus": d(["Chip + putt only"], "Contribute to team score"),
      no_hcp: d(["No bonus points"], "Complete full match"),
    },
  },
  {
    mode: "singles" as const,
    drill_type: "points" as const,
    title: "Aggressive Putting 4-6m",
    goal: "Become a more aggressive putter within 6 meters while maintaining good speed control. Commit with confidence; train speed and confidence—no hesitant strokes.",
    time_minutes: 15,
    setup_steps: [
      "Place a hole on a flat putt (or use a practice green).",
      "Mark three distances: 4m, 5m, and 6m from the hole.",
      "Have enough balls. You will use a different spot for every putt (no repeating the same position).",
    ],
    rules: [
      "Distances cycle in order: 4m → 5m → 6m → repeat. Each putt uses the next distance in the cycle.",
      "Choose a different spot for every putt. You may not putt twice from the same position.",
      "Reach 15 points to finish the drill. Score = total putts taken (fewer is better).",
      "Short putts subtract points; long missed return subtracts points.",
    ],
    target_points: 15,
    scoring: [
      "Holed putt = +3 points.",
      "Good pace (within 3 ft past the hole) = +1 point.",
      "Long but made return putt (3+ ft past) = 0 points.",
      "Short putt = -3 points.",
      "Long and missed return putt = -3 points.",
      "4-putt or worse = -5 points.",
    ],
    end_condition: "Drill ends at 15 points. Score = total putts taken.",
    log_fields: ["score", "total_putts", "notes"],
    hcp: { input: "15", value: 15, band: "13_to_20" as const },
    recommended_hcp_bands: ["6_to_12", "13_to_20", "21_to_30", "31_plus", "no_hcp"] as const,
    difficulty_by_band: {
      plus_5_to_0: d(
        ["Use 5m, 6m, 7m cycle. Stricter pace: good = within 2 ft past."],
        "≤10 putts"
      ),
      "0_to_5": d(
        ["Use 4m, 5m, 6m. Same scoring. Target 12 points."],
        "≤11 putts"
      ),
      "6_to_12": d(
        ["4–6m cycle. Target 15 points. Standard scoring."],
        "≤13 putts"
      ),
      "13_to_20": d(
        ["4–6m cycle. Target 15 points. Standard scoring."],
        "≤15 putts"
      ),
      "21_to_30": d(
        ["Shorten to 3m, 4m, 5m. Softer penalties: short = -2, long miss = -2. Target 12 points."],
        "≤18 putts"
      ),
      "31_plus": d(
        ["Use 2m, 3m, 4m. Minimal penalties: short = -1, long miss = -1. Target 10 points."],
        "≤20 putts"
      ),
      no_hcp: d(
        ["2–4m. Beginner-friendly. No negative points; only +1 holed, +0 good pace. Target 8 points."],
        "Complete drill; focus on pace."
      ),
    },
  },
];
