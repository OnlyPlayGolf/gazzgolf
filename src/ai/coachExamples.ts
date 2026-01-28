/**
 * Few-shot examples for Coach AI drill generation.
 * Matches the drill schema (drillSchema): base + drill_type-specific fields.
 * API uses api/ai/coach/coachExamples; this file mirrors for reference.
 */

export const coachDrillExamples = [
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
      plus_5_to_0: { changes: ["Use 5m, 6m, 7m cycle. Stricter pace: good = within 2 ft past."], target: "≤10 putts" },
      "0_to_5": { changes: ["Use 4m, 5m, 6m. Same scoring. Target 12 points."], target: "≤11 putts" },
      "6_to_12": { changes: ["4–6m cycle. Target 15 points. Standard scoring."], target: "≤13 putts" },
      "13_to_20": { changes: ["4–6m cycle. Target 15 points. Standard scoring."], target: "≤15 putts" },
      "21_to_30": { changes: ["Shorten to 3m, 4m, 5m. Softer penalties. Target 12 points."], target: "≤18 putts" },
      "31_plus": { changes: ["Use 2m, 3m, 4m. Minimal penalties. Target 10 points."], target: "≤20 putts" },
      no_hcp: { changes: ["2–4m. Beginner-friendly. No negative points. Target 8 points."], target: "Complete drill; focus on pace." },
    },
  },
];
