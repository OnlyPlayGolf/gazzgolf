import { z } from "zod";
import { HCP_BANDS } from "./hcpBands.ts";

export const hcpBandSchema = z.enum(HCP_BANDS);
export type HcpBand = z.infer<typeof hcpBandSchema>;

const difficultyEntrySchema = z.object({
  changes: z.array(z.string()),
  target: z.string(),
});

const difficultyByBandSchema = z.object({
  plus_5_to_0: difficultyEntrySchema,
  "0_to_5": difficultyEntrySchema,
  "6_to_12": difficultyEntrySchema,
  "13_to_20": difficultyEntrySchema,
  "21_to_30": difficultyEntrySchema,
  "31_plus": difficultyEntrySchema,
  no_hcp: difficultyEntrySchema,
});

const baseSchema = z.object({
  title: z.string(),
  goal: z.string(),
  time_minutes: z.number(),
  mode: z.enum(["singles", "teams"]),
  setup_steps: z.array(z.string()).min(3),
  rules: z.array(z.string()).min(4),
  log_fields: z.array(z.string()),
  hcp: z.object({
    input: z.string().nullable(),
    value: z.number().nullable(),
    band: hcpBandSchema,
  }),
  recommended_hcp_bands: z.array(hcpBandSchema).min(1),
  difficulty_by_band: difficultyByBandSchema,
});

const pointsSchema = baseSchema.extend({
  drill_type: z.literal("points"),
  target_points: z.number(),
  scoring: z.array(z.string()).min(3),
  end_condition: z.string(),
});

const succeedFailSchema = baseSchema.extend({
  drill_type: z.literal("succeed_fail"),
  attempts: z.number(),
  success_criteria: z.string(),
  pass_threshold: z.number(),
  fail_rule: z.string(),
  scoring: z.array(z.string()).min(1).optional(),
});

const matchPlaySchema = baseSchema.extend({
  drill_type: z.literal("match_play"),
  match_format: z.string(),
  holes_or_rounds: z.number(),
  win_condition: z.string(),
  scoring: z.array(z.string()).min(3),
});

const teamSucceedFailSchema = baseSchema.extend({
  drill_type: z.literal("team_succeed_fail"),
  team_attempts: z.number(),
  team_success_criteria: z.string(),
  team_pass_threshold: z.number(),
  team_fail_rule: z.string(),
});

export const drillSchema = z.discriminatedUnion("drill_type", [
  pointsSchema,
  succeedFailSchema,
  matchPlaySchema,
  teamSucceedFailSchema,
]);

export type Drill = z.infer<typeof drillSchema>;
