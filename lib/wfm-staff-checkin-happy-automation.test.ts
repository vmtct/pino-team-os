import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const spec = readFileSync("e2e/wfm-staff-checkin-happy-staging.spec.ts", "utf8");
const workflow = readFileSync(".github/workflows/workforce-staff-checkin-happy-staging-e2e.yml", "utf8");

test("happy Staff Check-In journey is browser-driven and API-verified", () => {
  for (const required of [
    'page.goto("/staff-login")',
    'getByRole("button", { name: "Vào PINO Team" })',
    'page.goto("/check-in")',
    'getByRole("button", { name: "Check-in", exact: true })',
    'page.waitForURL("**/tasks")',
    '/api/workforce/timekeeping/current?centerId=',
    '/api/pinoria-tv/snapshot?centerId=',
    'source.sourceType === "TIMEKEEPING_SESSION"',
    'journey_id: "GJ-WFM-STAFF-CHECKIN-01"',
    'mode: "UI_DRIVEN_API_VERIFIED"',
    'PINO_HAPPY_RECEIPT_JSON=',
    '/api/workforce/timekeeping/check-out',
  ]) assert.ok(spec.includes(required), `missing happy-path contract: ${required}`);
});

test("happy staging workflow is exact-composition and fixture bound", () => {
  for (const required of [
    "TEAM_SHA:",
    "CORE_SHA:",
    "TEAM_STAGING_RUN_ID:",
    "CORE_FIXTURE_RUN_ID:",
    "RUN_WORKFORCE_STAFF_CHECKIN_HAPPY_STAGING_E2E",
    ".github/workflows/workforce-staff-checkin-staging-fixture.yml",
    "Cloudflare Build + Serving Truth",
    "PINO_STAGING_RUNTIME_EVIDENCE:",
    "wfm-staff-checkin-happy-staging.spec.ts --workers=1 --retries=0",
    "actions/upload-artifact@v4",
    "UI_DRIVEN_API_VERIFIED",
    "No Production mutation was performed.",
  ]) assert.ok(workflow.includes(required), `missing workflow contract: ${required}`);
});
