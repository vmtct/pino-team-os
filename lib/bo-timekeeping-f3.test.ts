import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("WFM-TIME-BO F3 clearly separates Recorded and Corrected and refetches after save", async () => {
  const [view, api, write, model] = await Promise.all([
    readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx", "utf8"),
    readFile("lib/bo-api.ts", "utf8"),
    readFile("lib/bo-write-handler.ts", "utf8"),
    readFile("lib/bo-model.ts", "utf8"),
  ]);
  assert.match(view, />Recorded</);
  assert.match(view, />Corrected</);
  assert.match(view, /Correct attendance/);
  assert.match(view, /expectedLatestCorrectionId:\s*row\.latestCorrection\?\.id\s*\?\?\s*null/);
  assert.match(view, /correctionAttempt\.current\?\.signature !== signature/);
  assert.match(view, /const idempotencyKey = correctionAttempt\.current\.key/);
  assert.match(view, /await boApi\.correctTimekeeping\(row\.id, command, idempotencyKey\)/);
  assert.ok(view.indexOf("correctionAttempt.current = null", view.indexOf("await onSaved()")) > view.indexOf("await onSaved()"));
  assert.ok(view.indexOf("await boApi.correctTimekeeping") < view.indexOf("await onSaved()"));

  assert.doesNotMatch(view, /setLoad\([^\n]*effective|setSelected[^\n]*correct/i);
  assert.match(view, /row\.status === "CLOSED"/);
  assert.match(view, /row\.status === "CLOSED"/);
  assert.match(api, /correctTimekeeping:[\s\S]*workforce\/timekeeping\/\$\{encodeURIComponent\(sessionId\)\}\/corrections/);
  assert.match(write, /TIMEKEEPING_CORRECTION_PATH/);
  assert.match(model, /recorded:[\s\S]*effective:[\s\S]*latestCorrection/);
});
