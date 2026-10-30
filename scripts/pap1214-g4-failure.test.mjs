import test from "node:test";
import assert from "node:assert/strict";
import { safeG4Failure } from "./pap1214-g4-failure.mjs";

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
