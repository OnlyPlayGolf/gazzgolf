import type { Connect } from "vite";

const API_PATH = "/api/ai/coach/generate-drill";

function parseBody(raw: string): {
  goal?: string;
  hcpInput?: string | null;
  timeMinutes?: number;
} {
  try {
    const body = JSON.parse(raw || "{}");
    const hcpInput = body.hcpInput;
    return {
      goal: typeof body.goal === "string" ? body.goal : "",
      hcpInput:
        hcpInput == null ? null : typeof hcpInput === "string" ? hcpInput : null,
      timeMinutes: typeof body.timeMinutes === "number" ? body.timeMinutes : undefined,
    };
  } catch {
    return {};
  }
}

const HCP_BANDS = ["plus_5_to_0", "0_to_5", "6_to_12", "13_to_20", "21_to_30", "31_plus", "no_hcp"] as const;

function getHcpBand(value: number | null | undefined): (typeof HCP_BANDS)[number] {
  if (value == null || typeof value !== "number") return "no_hcp";
  if (value < 0) return "plus_5_to_0";
  if (value <= 5) return "0_to_5";
  if (value <= 12) return "6_to_12";
  if (value <= 20) return "13_to_20";
  if (value <= 30) return "21_to_30";
  return "31_plus";
}

function parseHcpStub(hcpInput: string | null | undefined): {
  input: string | null;
  value: number | null;
  band: (typeof HCP_BANDS)[number];
} {
  const raw = typeof hcpInput === "string" ? hcpInput.trim() : "";
  if (raw === "") return { input: null, value: null, band: "no_hcp" };
  if (raw.startsWith("+")) {
    const rest = raw.slice(1).trim();
    const num = parseFloat(rest);
    if (rest === "" || !Number.isFinite(num) || num < 0) throw new Error("Invalid HCP");
    const value = -num;
    return { input: raw, value, band: getHcpBand(value) };
  }
  const num = parseFloat(raw);
  if (!Number.isFinite(num) || num < 0) throw new Error("Invalid HCP");
  return { input: raw, value: num, band: getHcpBand(num) };
}

function buildDrill(
  body: ReturnType<typeof parseBody>,
  parsed: { input: string | null; value: number | null; band: (typeof HCP_BANDS)[number] }
) {
  const goal = body.goal ?? "";
  const timeMinutes = body.timeMinutes ?? 20;
  const d = (changes: string[], target: string) => ({ changes, target });
  return {
    mode: "singles",
    drill_type: "points",
    title: goal ? `${goal} (dev stub)` : "Custom drill",
    goal: goal || "General practice",
    time_minutes: timeMinutes,
    setup_steps: [
      "Place 10 balls at 1m.",
      "Mark a 2m circle around the hole.",
      "Have a pencil to log score.",
    ],
    rules: [
      "Putt each ball; count holed putts.",
      "Must complete all 10 before moving on.",
      "Miss resets streak; no do-overs.",
      "Record total putts taken.",
    ],
    target_points: 8,
    scoring: [
      "Holed = +2 points.",
      "Within 2m = +1 point.",
      "Outside 2m or miss = 0 points.",
    ],
    end_condition: "Reach 8 points. Score = total putts.",
    log_fields: ["score", "notes"],
    hcp: { input: parsed.input, value: parsed.value, band: parsed.band },
    recommended_hcp_bands: ["6_to_12", "13_to_20", "21_to_30", "31_plus", "no_hcp"],
    difficulty_by_band: {
      plus_5_to_0: d(["1.5m. Pass = 10/10."], "10/10"),
      "0_to_5": d(["1.25m. Pass = 9/10."], "9/10"),
      "6_to_12": d(["1m. Pass = 8/10."], "8/10"),
      "13_to_20": d(["1m. Pass = 7/10."], "7/10"),
      "21_to_30": d(["0.75m. Pass = 6/10."], "6/10"),
      "31_plus": d(["0.5m. Pass = 5/10."], "5/10"),
      no_hcp: d(["0.5m. Pass = 4/10. Beginner-friendly."], "4/10"),
    },
  };
}

export function coachApiDevMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = req.url?.split("?")[0];
    if (req.method !== "POST" || path !== API_PATH) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = parseBody(raw);
      let parsed: { input: string | null; value: number | null; band: string };
      try {
        parsed = parseHcpStub(body.hcpInput);
      } catch {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid HCP" }));
        return;
      }
      const drill = buildDrill(body, parsed);
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ id: "dev-stub", drill }));
    });
    req.on("error", () => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Bad request" }));
    });
  };
}
