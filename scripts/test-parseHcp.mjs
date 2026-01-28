/**
 * Quick tests for parseHcp / getHcpBand.
 * Run: node scripts/test-parseHcp.mjs
 *
 * Proves:
 *   "+2" => value -2 => plus_5_to_0
 *   "12" => 6_to_12
 *   ""   => no_hcp
 */

import { parseHcp } from "../api/ai/coach/hcpBands.ts";

function run() {
  const cases = [
    { input: "+2", expectValue: -2, expectBand: "plus_5_to_0" },
    { input: "12", expectValue: 12, expectBand: "6_to_12" },
    { input: "", expectValue: null, expectBand: "no_hcp" },
  ];

  let ok = 0;
  for (const { input, expectValue, expectBand } of cases) {
    const parsed = parseHcp(input === "" ? "" : input);
    const pass =
      parsed.value === expectValue &&
      parsed.band === expectBand &&
      (input === "" ? parsed.input === null : parsed.input !== null);
    if (pass) {
      ok++;
      console.log(`OK: ${JSON.stringify(input)} => value ${parsed.value} => ${parsed.band}`);
    } else {
      console.error(
        `FAIL: ${JSON.stringify(input)} => got value=${parsed.value} band=${parsed.band}, expected value=${expectValue} band=${expectBand}`
      );
    }
  }
  console.log(`\n${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

run();
