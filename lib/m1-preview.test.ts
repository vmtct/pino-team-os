import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewFeature, PreviewRecord } from "./m1-preview/contract";
import { decideM1Preview, type PreviewAdmissionInput } from "./m1-preview/admission.server";
import { createPreviewState, readPreviewRecord, reconcilePreviewScope, reducePreview } from "./m1-preview/state";

type Sample = PreviewRecord & { title: string; nested: { value: string } };
const seed: Sample = { id: "SAMPLE-MOCK-001", fixture: true, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null, title: "Synthetic", nested: { value: "first" } };
const definition: PreviewFeature<Sample> = { feature: "PLT-SAMPLE", jiraTask: "PAP-2342", surface: "BO", idPrefix: "SAMPLE-MOCK-", seed, operations: ["create", "replace", "remove"] };
const admitted: PreviewAdmissionInput = { environment: "staging", hostname: "bo.staging.pinohouse.art", surface: "BO", requested: true, featureEnabled: true, authenticated: true, surfaceAuthorized: true, featureReviewAuthorized: true, scopeAuthorized: true };
test("explicit staging server proof is required for both surfaces", () => {
  assert.deepEqual(decideM1Preview(admitted), { allowed: true });
  assert.deepEqual(decideM1Preview({ ...admitted, surface: "HO", hostname: "ho.staging.pinohouse.art" }), { allowed: true });
  for (const change of [{ environment: "production" }, { environment: undefined }, { environment: "development" }, { hostname: "bo.pinohouse.art" }, { hostname: "ho.staging.pinohouse.art" }, { requested: false }, { featureEnabled: false }]) {
    assert.deepEqual(decideM1Preview({ ...admitted, ...change }), { allowed: false, reason: "disabled" });
  }
  assert.deepEqual(decideM1Preview({ ...admitted, authenticated: false }), { allowed: false, reason: "unauthenticated" });
  for (const key of ["surfaceAuthorized", "featureReviewAuthorized", "scopeAuthorized"] as const) {
    assert.deepEqual(decideM1Preview({ ...admitted, [key]: false }), { allowed: false, reason: "forbidden" });
  }
});
test("single seed; same stable identity; independent deep clones", () => {
  const state = createPreviewState(definition, "scope-a");
  assert.equal(state.records.length, 1);
  const row = readPreviewRecord(state, seed.id)!;
  row.nested.value = "changed";
  assert.equal(readPreviewRecord(state, seed.id)?.nested.value, "first");
  const edited = reducePreview(state, { type: "replace", id: seed.id, record: row });
  assert.equal(readPreviewRecord(edited, seed.id)?.nested.value, "changed");
  assert.equal(readPreviewRecord(state, seed.id)?.nested.value, "first");
  assert.equal(seed.nested.value, "first");
  assert.equal(readPreviewRecord(edited, "real-id"), undefined);
});
test("create/remove only transient synthetic records; reset restores seed", () => {
  const state = createPreviewState(definition, "a");
  const added = reducePreview(state, { type: "create", record: { ...seed, title: "new" } });
  assert.deepEqual(added.records.map(row => row.id), ["SAMPLE-MOCK-001", "SAMPLE-MOCK-002"]);
  const removed = reducePreview(added, { type: "remove", id: "SAMPLE-MOCK-002" });
  assert.equal(removed.records.length, 1);
  assert.equal(reducePreview(removed, { type: "remove", id: "unknown" }), removed);
  assert.equal(createPreviewState(definition, "a").records.length, 1);
  assert.equal(reconcilePreviewScope(added, definition, "a"), added);
  assert.equal(reconcilePreviewScope(added, definition, "b").records.length, 1);
});
test("reject identity, fake audit, invalid seed and unregistered operations", () => {
  const state = createPreviewState(definition, "a");
  assert.throws(() => createPreviewState({ ...definition, seed: { ...seed, id: "real" } }, "a"));
  assert.throws(() => createPreviewState(definition, ""));
  assert.throws(() => reducePreview(state, { type: "replace", id: seed.id, record: { ...seed, id: "SAMPLE-MOCK-002" } }));
  assert.throws(() => reducePreview(state, { type: "replace", id: seed.id, record: { ...seed, createdBy: "Fake" } as unknown as Sample }));
  assert.throws(() => reducePreview(createPreviewState({ ...definition, operations: [] }, "a"), { type: "remove", id: seed.id }));
});
