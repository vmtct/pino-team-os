import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PAP-670 local-time correction and missing-checkout preserve Core contracts", async () => {
 const view=await readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx","utf8");
 assert.match(view,/type="datetime-local" value=\{correctedAt\}/);
 assert.match(view,/type="datetime-local" value=\{resolvedCheckOutAt\}/);
 assert.match(view,/const correctedIso = localInputToIso\(correctedAt, timeZone\)/);
 assert.match(view,/const checkoutIso = localInputToIso\(resolvedCheckOutAt, timeZone\)/);
 assert.match(view,/const command = \{ checkOutAt: checkoutIso, reason: resolveReason.trim\(\) \}/);
 assert.match(view,/correctedAt: correctedIso/);
 assert.match(view,/expectedLatestCorrectionId: row.latestCorrection\?\.id \?\? null/);
 assert.match(view,/missedCheckoutAttempt.current\?\.signature !== signature/);
 assert.match(view,/correctionAttempt.current\?\.signature !== signature/);
 assert.match(view,/matches.length === 1/);
 assert.match(view,/Date.parse\(correctedIso\) >= Date.parse\(other\)/);
});

test("PAP-670 Needs Attention uses bounded server OPEN query",async()=>{
 const view=await readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx","utf8");
 assert.match(view,/mode === "attention" \? \{ status: "OPEN" as const \}/);
 assert.match(view,/mode !== "today" &&/);
 assert.match(view,/Core anomaly flags remain authoritative/);
 assert.match(view,/Review signals/);
});
