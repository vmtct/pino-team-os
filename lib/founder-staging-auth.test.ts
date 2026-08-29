import assert from "node:assert/strict";
import test from "node:test";
import { stagingFounderActor } from "./founder-staging-auth";

const env = { PINORIA_BO_STAGING_BYPASS: "enabled", FOUNDER_EMAIL: "founder@pino.invalid,other@pino.invalid" };

test("BO staging founder bypass is workers.dev-only", () => {
  assert.equal(stagingFounderActor(new Request("https://pino-team-os-staging.example.workers.dev/bo"), env)?.email, "founder@pino.invalid");
  assert.equal(stagingFounderActor(new Request("https://tos.pinohouse.art/bo"), env), null);
});

test("BO staging founder bypass requires explicit flag and founder email", () => {
  const request = new Request("https://pino-team-os-staging.example.workers.dev/bo");
  assert.equal(stagingFounderActor(request, { ...env, PINORIA_BO_STAGING_BYPASS: "" }), null);
  assert.equal(stagingFounderActor(request, { ...env, FOUNDER_EMAIL: "" }), null);
});
