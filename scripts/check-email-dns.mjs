import dns from "node:dns/promises";

function uniq(arr) {
  return Array.from(new Set(arr));
}

async function safeResolveTxt(name) {
  try {
    const records = await dns.resolveTxt(name);
    // records: string[][]
    return records.map((parts) => parts.join("")).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function safeResolveCname(name) {
  try {
    return await dns.resolveCname(name);
  } catch (e) {
    return [];
  }
}

async function safeResolveMx(name) {
  try {
    const mx = await dns.resolveMx(name);
    return mx.sort((a, b) => a.priority - b.priority);
  } catch (e) {
    return [];
  }
}

async function main() {
  const domain = (process.argv[2] || "onlyplaygolf.com").trim();

  console.log(`Domain: ${domain}`);
  console.log("");

  // SPF
  const txt = await safeResolveTxt(domain);
  const spf = txt.filter((t) => t.toLowerCase().startsWith("v=spf1"));
  console.log("SPF (TXT v=spf1):");
  if (spf.length === 0) console.log("  (none found)");
  for (const r of spf) console.log(`  - ${r}`);
  console.log("");

  // DMARC
  const dmarcName = `_dmarc.${domain}`;
  const dmarc = (await safeResolveTxt(dmarcName)).filter((t) =>
    t.toLowerCase().startsWith("v=dmarc1")
  );
  console.log(`DMARC (TXT ${dmarcName}):`);
  if (dmarc.length === 0) console.log("  (none found)");
  for (const r of dmarc) console.log(`  - ${r}`);
  console.log("");

  // DKIM (Microsoft 365 common selectors)
  const selectors = ["selector1", "selector2"];
  console.log("DKIM (CNAME lookups):");
  for (const sel of selectors) {
    const name = `${sel}._domainkey.${domain}`;
    const cnames = await safeResolveCname(name);
    console.log(`  ${name}`);
    if (cnames.length === 0) {
      console.log("    (no CNAME found)");
    } else {
      for (const c of uniq(cnames)) console.log(`    - ${c}`);
    }
  }
  console.log("");

  // MX
  const mx = await safeResolveMx(domain);
  console.log("MX:");
  if (mx.length === 0) console.log("  (none found)");
  for (const r of mx) console.log(`  - ${r.priority} ${r.exchange}`);
  console.log("");

  console.log("Notes:");
  console.log(
    "  - For Microsoft 365, SPF often includes: include:spf.protection.outlook.com"
  );
  console.log(
    "  - DKIM CNAMEs may be different if you changed selectors; update this script if needed."
  );
}

await main();

