import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("WFM-TIME-BO F4 resolves OPEN missed checkout only through Core then refetches", async () => {
  const [view, api, write] = await Promise.all([
    readFile("app/bo/workforce/timekeeping/TimekeepingView.tsx", "utf8"),
    readFile("lib/bo-api.ts", "utf8"),
    readFile("lib/bo-write-handler.ts", "utf8"),
  ]);
  assert.match(view, /Resolve missing checkout/);
  assert.match(view, /Enter the actual checkout time; PINO will not infer it/);
  assert.match(view, /await boApi\.resolveMissedCheckout/);
  assert.ok(view.indexOf("await boApi.resolveMissedCheckout") < view.indexOf("await onSaved()"));
  assert.match(view, /Core was refetched before this status changed/);
  assert.doesNotMatch(view, /setLoad\([^\n]*status:\s*"CLOSED"/);
  assert.match(api, /resolveMissedCheckout:[\s\S]*resolve-missed-checkout/);
  assert.match(write, /TIMEKEEPING_MISSED_CHECKOUT_PATH/);
});
