import assert from "node:assert/strict";
import test from "node:test";
import { stagingBoOpenStudioIdentity } from "./bo-open-studio-staging-auth";

const env = {
  OPEN_STUDIO_BO_STAGING_BYPASS: "enabled",
  OPEN_STUDIO_STAGING_BO_EMAIL: "open-studio-control-loop-staging-probe@pino.invalid",
};

test("Open Studio BO staging identity is workers.dev-only and exact", () => {
  const identity = stagingBoOpenStudioIdentity(
    new Request("https://pino-team-os-staging.example.workers.dev/api/bo/open-studio/operations"), env,
  );
  assert.equal(identity?.subject, "open-studio-control-loop-staging-probe-v1");
  assert.equal(identity?.email, "open-studio-control-loop-staging-probe@pino.invalid");
  assert.equal(identity?.issuer, "https://open-studio-control-loop-staging.invalid");
  assert.deepEqual(identity?.audience, ["open-studio-control-loop-staging"]);
});

test("Open Studio BO staging identity cannot activate on production host or without its flag", () => {
  assert.equal(stagingBoOpenStudioIdentity(new Request("https://bo.pinohouse.art/api/bo/open-studio/operations"), env), null);
  assert.equal(stagingBoOpenStudioIdentity(
    new Request("https://pino-team-os-staging.example.workers.dev/api/bo/open-studio/operations"),
    { ...env, OPEN_STUDIO_BO_STAGING_BYPASS: "disabled" },
  ), null);
});
