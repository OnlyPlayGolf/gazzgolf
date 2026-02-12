import { z } from "zod";
import { HCP_BANDS } from "./hcpBands.ts";

export const hcpBandSchema = z.enum(HCP_BANDS);
export type HcpBand = z.infer<typeof hcpBandSchema>;

const outcomeSchema = z.object({
  label: z.string(),
  points: z.number(),
});

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
});

const pointsDrillSchema = baseSchema.extend({
  drill_type: z.literal("points"),
  outcomes: z.array(outcomeSchema).min(2),
  target_points: z.number(),
  distances: z.array(z.number()).min(1),
  end_condition: z.string(),
});

const scoreEntryDrillSchema = baseSchema.extend({
  drill_type: z.literal("score_entry"),
  score_label: z.string(),
  score_unit: z.string().optional(),
  prompt: z.string(),
});

export const drillSchema = z.discriminatedUnion("drill_type", [
  pointsDrillSchema,
  scoreEntryDrillSchema,
]);

export type Drill = z.infer<typeof drillSchema>;
export type PointsDrill = z.infer<typeof pointsDrillSchema>;
export type ScoreEntryDrill = z.infer<typeof scoreEntryDrillSchema>;
