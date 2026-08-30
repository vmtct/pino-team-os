import assert from "node:assert/strict";
import test from "node:test";
import { isTosStagingBypassRequest, stagingStaffEmail } from "./tos-staging-auth";

const env = {
  PINORIA_TOS_STAGING_BYPASS: "enabled",
  PINORIA_STAGING_STAFF_EMAIL: "operator@pino.invalid",
};

test("TOS staging bypass is workers.dev-only", () => {
  assert.equal(isTosStagingBypassRequest(new Request("https://pino-team-os-staging.example.workers.dev/pinoria"), env), true);
  assert.equal(isTosStagingBypassRequest(new Request("https://tos.pinohouse.art/pinoria"), env), false);
});

test("TOS staging staff identity comes only from explicit staging config", () => {
  assert.equal(stagingStaffEmail(new Request("https://pino-team-os-staging.example.workers.dev/staff-login"), env), "operator@pino.invalid");
  assert.equal(stagingStaffEmail(new Request("https://pino-team-os-staging.example.workers.dev/staff-login"), { ...env, PINORIA_STAGING_STAFF_EMAIL: "" }), null);
});
