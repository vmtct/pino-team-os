import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1546 / PAP-1316: deny Open Studio issue CTA until Core attests selected Center", () => {
  const ui = readFileSync("app/bo/open-studio-passes/BoOpenStudioPassesTdd.tsx", "utf8");
  const provider = readFileSync("app/bo/open-studio-passes/schema.ts", "utf8");
  const issue = ui.indexOf("<CenterPassActions");
  const gate = ui.indexOf("await readCenterPasses(fetch,centerId,controller.signal)");
  const ready = ui.indexOf("setReady({centerId,adapter:bound");
  assert.ok(gate > 0 && ready > gate && issue > ready, "Core scoped read must precede any issue action");
  assert.match(ui, /if\(error\)return <p role="alert">/);
  assert.match(ui, /if\(ready\?\.centerId!==centerId\)return <p role="status">/);
  assert.match(provider, /\/api\/bo\/open-studio\/walkin\/inventory\?centerId=/);
  assert.match(provider, /if\(!response\.ok\)throw Error/);
  assert.match(provider, /p\.center_id!==centerId/);
  assert.doesNotMatch(ui, /onClick=\{.*assign\(/);
});
