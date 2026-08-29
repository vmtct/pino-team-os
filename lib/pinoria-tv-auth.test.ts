import assert from "node:assert/strict";
import test from "node:test";
import { isPinoriaTvStagingBypass } from "./pinoria-tv-auth";

test("Pinoria TV staging bypass is workers.dev-only and explicitly enabled", () => {
  assert.equal(
    isPinoriaTvStagingBypass("https://pino-team-os-staging.example.workers.dev/pinoria-tv", "enabled"),
    true,
  );
  assert.equal(isPinoriaTvStagingBypass("https://tos.pinohouse.art/pinoria-tv", "enabled"), false);
  assert.equal(isPinoriaTvStagingBypass("https://pino-team-os-staging.example.workers.dev/pinoria-tv", undefined), false);
  assert.equal(isPinoriaTvStagingBypass("https://workers.dev.evil.example/pinoria-tv", "enabled"), false);
});
