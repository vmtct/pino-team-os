import test from "node:test";
import assert from "node:assert/strict";
import { validateG4RunnerEnv, g4SubscriptionUrl, G4_BO_ORIGIN, G4_HO_ORIGIN, type G4RunnerEnv } from "./tdd-g4-staging-config";

const good: G4RunnerEnv = {
  TDD_G4_RUN: "1",
  TDD_G4_EXPECTED_MAIN_SHA: "a".repeat(40),
  TDD_G4_SERVING_SHA: "a".repeat(40),
  TDD_G4_MAIN_CI_RUN: "40710206523",
  TDD_G4_STAGING_CD_RUN: "40710652581",
  TDD_G4_FOUNDER_STATE: "private/founder.json",
  TDD_G4_MANAGER_STATE: "private/manager.json",
  TDD_G4_SUBSCRIPTION_ID: "11111111-2222-4333-8444-555555555555",
};
test("G4 complete staging-only preflight passes", () => assert.deepEqual(validateG4RunnerEnv(good), []));
for (const [name, edit] of [
  ["no explicit opt-in", { TDD_G4_RUN: undefined }],
  ["missing actual serving SHA", { TDD_G4_SERVING_SHA: undefined }],
  ["old deployment", { TDD_G4_SERVING_SHA: "b".repeat(40) }],
  ["missing main CI receipt", { TDD_G4_MAIN_CI_RUN: "" }],
  ["missing guarded CD receipt", { TDD_G4_STAGING_CD_RUN: "" }],
  ["no Founder state", { TDD_G4_FOUNDER_STATE: undefined }],
  ["no Manager state", { TDD_G4_MANAGER_STATE: undefined }],
  ["same account for both roles", { TDD_G4_MANAGER_STATE: good.TDD_G4_FOUNDER_STATE }],
  ["invented Subscription", { TDD_G4_SUBSCRIPTION_ID: "not-a-uuid" }],
  ["remote authentication URL is not a local state", { TDD_G4_FOUNDER_STATE: "https://example.org/founder.json" }],
] as const) test("G4 FAIL CLOSED: " + name, () => {
  assert.ok(validateG4RunnerEnv({ ...good, ...edit }).length);
});
test("G4 immutable origins are staging-only", () => {
  assert.equal(G4_BO_ORIGIN, "https://bo.staging.pinohouse.art");
  assert.equal(G4_HO_ORIGIN, "https://ho.staging.pinohouse.art");
  assert.match(g4SubscriptionUrl(good.TDD_G4_SUBSCRIPTION_ID!), /^https:\/\/bo\.staging\.pinohouse\.art\/bo\?module=subscriptions&record=/);
  assert.match(g4SubscriptionUrl(good.TDD_G4_SUBSCRIPTION_ID!, "history"), /&tab=history$/);
  assert.throws(() => g4SubscriptionUrl("not-a-uuid"), /invalid/);
});
