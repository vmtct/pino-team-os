import { chromium } from "@playwright/test";
import { checkTdd } from "./tdd.mjs";

const profiles = {
  ho: {role:"Founder", port:9337}, bo: {role:"Manager", port:9335}, tos: {role:"Staff", port:9336}
};

// Called inside the existing i5 admission owner's operation. withProfile owns
// atomic acquire and release; verify checks actual actor, Center and serving pins.
export async function runStaging({surface, cases, withProfile, verify}) {
  const profile = profiles[surface];
  if (process.env.CI || !profile || !cases?.length || typeof withProfile !== "function" || typeof verify !== "function") {
    throw Error("Staging requires scoped cases and existing local admission");
  }
  const origin = "https://" + surface + ".staging.pinohouse.art";
  return withProfile(profile, async () => {
    const browser = await chromium.connectOverCDP("http://127.0.0.1:" + profile.port, {timeout:15000, noDefaults:true});
    try {
      const contexts = browser.contexts();
      if (contexts.length !== 1) throw Error("Expected one admitted profile context");
      const results = [];
      for (const item of cases) {
        const url = new URL(item.path, origin);
        if (url.origin !== origin || url.username || url.password) throw Error("Unexpected staging target");
        const started = Date.now();
        const page = await contexts[0].newPage();
        let phase = "admission";
        let result = "BLOCKED";
        try {
          let unexpectedWrite = false;
          await page.route("**/*", route => {
            const request = route.request();
            if (!["GET","HEAD","OPTIONS"].includes(request.method())) {
              if (new URL(request.url()).pathname !== "/cdn-cgi/rum") unexpectedWrite = true;
              return route.abort();
            }
            if (request.isNavigationRequest() && new URL(request.url()).origin !== origin) return route.abort();
            return route.continue();
          });
          await page.goto(url.href, {waitUntil:"domcontentloaded"});
          if (new URL(page.url()).origin !== origin) throw Error("Unexpected final origin");
          const before = await verify(page, profile, item);
          if (!validProof(before) || before.actorId !== item.actorId || before.scope !== item.scope) throw Error("Admission not proved");
          phase = "journey";
          const outcome = await verifyJourney({
            before,
            run: () => item.run ? item.run(page) : checkTdd(page, item.fixture),
            readback: () => verify(page, profile, item),
            hasUnexpectedWrite: () => unexpectedWrite
          });
          phase = outcome.phase;
          result = outcome.result;
        } catch {
          result = phase === "journey" ? "FAIL" : "BLOCKED";
        } finally {
          await page.close();
        }
        results.push({feature:item.key, phase, result, elapsedMs:Date.now()-started});
        if (result === "BLOCKED") break;
      }
      const remaining = cases.slice(results.length).map(item => ({feature:item.key, result:"NOT_RUN"}));
      return results.concat(remaining);
    } finally {
      await browser.close(); // disconnect from the attached browser
    }
  });
}

function validProof(proof) {
  return proof?.authorized === true && typeof proof.actorId === "string" && !!proof.actorId &&
    typeof proof.scope === "string" && !!proof.scope && /^[a-f0-9]{40}$/.test(proof.teamSha) &&
    /^[a-f0-9]{40}$/.test(proof.coreSha);
}

// Verify the same admission and serving pins even when the native journey fails.
// An unverified or stale post-state is BLOCKED, not a product failure.
export async function verifyJourney({before, run, readback, hasUnexpectedWrite}) {
  if (!validProof(before)) return {phase:"admission", result:"BLOCKED"};
  const baseline = {...before};
  let failed = false;
  try {
    await run();
  } catch {
    failed = true;
  }
  try {
    const after = await readback();
    if (!validProof(after) || Object.keys(baseline).some(key => baseline[key] !== after[key])) {
      return {phase:"readback", result:"BLOCKED"};
    }
  } catch {
    return {phase:"readback", result:"BLOCKED"};
  }
  if (failed || hasUnexpectedWrite()) return {phase:"journey", result:"FAIL"};
  return {phase:"readback", result:"PASS"};
}
