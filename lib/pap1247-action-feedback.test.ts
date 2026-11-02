import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tddActionFeedback, type TddActionHandler } from "./workspace-schema";

test("PAP-1247: navigation result is not a mutation receipt", () => {
  const navigation: TddActionHandler = { run: () => undefined };
  assert.deepEqual(tddActionFeedback(navigation, { state: "verified" }), { kind: "none", message: "" });
});
test("PAP-1247: verified mutation must have explicit readback outcome", () => {
  const mutation: TddActionHandler = { kind: "mutation", run: async () => ({ state: "verified" }) };
  assert.deepEqual(tddActionFeedback(mutation, { state: "verified" }),
    { kind: "success", message: "Thao tác đã được xác minh." });
  for (const outcome of [undefined, null, {}, { status: 200 }, { state: "saved" },
    { state: "unverified" }, { state: "UNVERIFIED" }]) {
    assert.equal(tddActionFeedback(mutation, outcome).kind, "error");
    assert.match(tddActionFeedback(mutation, outcome).message, /Chưa xác minh/);
  }
});
test("PAP-1247: denied / 409 conflict / validation failures are explicit and fail closed", () => {
  const mutation: TddActionHandler = { kind: "mutation", run: () => undefined };
  for (const state of ["denied", "conflict", "invalid"] as const) {
    const result = tddActionFeedback(mutation, { state, message: "sensitive server text" });
    assert.equal(result.kind, "error");
    assert.doesNotMatch(result.message, /sensitive server text/);
  }
  assert.match(tddActionFeedback(mutation, { state: "conflict" }).message, /thay đổi/);
  assert.match(tddActionFeedback(mutation, { state: "denied" }).message, /Không có quyền/);
});
test("PAP-1247: shared Action Host uses feedback, not promise-completion success", () => {
  const renderer = readFileSync("app/components/workspace-renderer/Renderer.tsx", "utf8");
  assert.match(renderer, /tddActionFeedback\(binding, result\)/);
  assert.match(renderer, /feedback\.kind === "error"/);
  assert.match(renderer, /feedback\.kind === "success"/);
  assert.match(renderer, /role="alert"/);
  assert.match(renderer, /role="status"/);
  assert.match(renderer, /pending\.current \|\|/);
});
