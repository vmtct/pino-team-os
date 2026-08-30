import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("Pinoria Team staging is isolated from production Core", () => {
  const stagingRaw = readFileSync(join(process.cwd(), "wrangler.staging.jsonc"), "utf8");
  const productionRaw = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  const staging = JSON.parse(stagingRaw);

  assert.equal(staging.name, "pino-team-os-staging");
  assert.equal(staging.workers_dev, true);
  assert.equal(staging.preview_urls, false);
  assert.equal(staging.vars.PINORIA_TV_STAGING_BYPASS, "enabled");
  assert.equal(staging.vars.PINORIA_TOS_STAGING_BYPASS, "enabled");
  assert.equal(staging.vars.PINORIA_BO_STAGING_BYPASS, "enabled");
  assert.equal(staging.vars.OPEN_STUDIO_BO_STAGING_BYPASS, "enabled");
  assert.equal(staging.vars.OPEN_STUDIO_STAGING_BO_EMAIL, "open-studio-control-loop-staging-probe@pino.invalid");
  assert.match(staging.vars.PINORIA_STAGING_STAFF_EMAIL, /@pino\.invalid$/);
  assert.equal(productionRaw.includes("PINORIA_TV_STAGING_BYPASS"), false);
  assert.equal(productionRaw.includes("PINORIA_TOS_STAGING_BYPASS"), false);
  assert.equal(productionRaw.includes("PINORIA_BO_STAGING_BYPASS"), false);
  assert.equal(productionRaw.includes("PINORIA_STAGING_STAFF_EMAIL"), false);
  assert.equal(productionRaw.includes("OPEN_STUDIO_BO_STAGING_BYPASS"), false);
  assert.equal(productionRaw.includes("OPEN_STUDIO_STAGING_BO_EMAIL"), false);

  assert.equal(staging.services.length, 6);
  for (const service of staging.services) assert.equal(service.service, "pino-core-staging");
  assert.equal(staging.services.some((service: { service: string }) => service.service === "pino-core"), false);
});
