import test from "node:test";
import assert from "node:assert/strict";
import { safeG4Failure, safeG4SurfaceProbe } from "./pap1214-g4-failure.mjs";

test("PAP-1214 records bounded phase and type but never exception messages, URLs, secrets or PII", () => {
  const error = Object.assign(new Error("PRIVATE_EMAIL cookie=secret https://private.invalid/path?token=secret"), { name: "TimeoutError" });
  const result = safeG4Failure("invalid_id_never_displays_detail", error, "runtime_surface_visible");
  assert.deepEqual(result, {
    name: "invalid_id_never_displays_detail",
    status: "FAIL",
    phase: "runtime_surface_visible",
    errorType: "TimeoutError",
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|secret|private.invalid/);
});

test("PAP-1214 never mirrors arbitrary error class or free-text phases", () => {
  const custom = Object.assign(new Error("secret"), { name: "SensitiveCustomerPayload" });
  assert.deepEqual(safeG4Failure("invalid_id_never_displays_detail", custom, "Bearer abc123"), {
    name: "invalid_id_never_displays_detail",
    status: "FAIL",
    phase: "unspecified",
    errorType: "UnknownError",
  });
  assert.equal(safeG4Failure("case", new Error("no detail"), "invalid_detail_absent").errorType, "Error");
});

test("PAP-1214 surface probe never echoes arbitrary page values", () => {
  const hostile = {
    subscriptionHost: true,
    subscriptionSurface: false,
    invalidAlert: true,
    anyDetail: true,
    redirectedLogin: false,
    nextError: false,
    cookie: "secret",
    url: "https://example.invalid/private",
    email: "PRIVATE_EMAIL",
  };
  const result = safeG4SurfaceProbe(hostile);
  assert.deepEqual(result, {
    subscriptionHost: true,
    subscriptionSurface: false,
    invalidAlert: true,
    anyDetail: true,
    redirectedLogin: false,
    nextError: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_EMAIL|secret|private/);
  assert.equal(safeG4SurfaceProbe({subscriptionHost:"true",anyDetail:1}).subscriptionHost, false);
  assert.equal(safeG4Failure("invalid_id_never_displays_detail",new Error("secret"),"invalid_error_visible").phase, "invalid_error_visible");
});

test("PAP-1214 fail-closed G4 source keeps real TDD detail selector and invalid-alert contract", async () => {
  const fs = await import("node:fs");
  const source = fs.readFileSync(new URL("./run-tdd-g4-ci.mjs",import.meta.url),"utf8");
  assert.match(source, /await fp\.locator\('\[data-bo-runtime-surface="subscriptions-core"\]'\)\.waitFor/);
  assert.match(source, /\[data-tdd-shell="detail"\],\[data-bo-full-detail\]/);
  assert.match(source, /"invalid detail mounted"/);
  assert.match(source, /invalid_error_visible/);
  assert.match(source, /\[data-bo-runtime-surface="subscriptions-core"\] \[role="alert"\]/);
});
