/** PAP-1646 / Epic PAP-650 PNR-TV — structural route non-bypass gate. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync(new URL("../app/tv/p/[policyRef]/page.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("./pinoria-tv-viewer-v1-staff.ts", import.meta.url), "utf8");

test("PAP-1646 only mounted logical path uses Core verifier, no Client/Device bypass", () => {
  assert.match(route, /readStaffPublishedViewer\(request, env, policyRef\)/);
  assert.match(route, /getCloudflareContext\(\{ async: true \}\)/);
  assert.match(route, /host !== TOS_STAGING_HOSTNAME/);
  assert.match(route, /Object\.keys\(query\)\.length > 0/);
  assert.match(route, /result\.kind === "blocked"/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /redirect\("\/staff-login\?returnTo="/);
  assert.match(route, /PolicyViewerFrame aspect="16:9"/);
  assert.doesNotMatch(route, /TvRuntimeHost|TvLauncher|claimPresentation|pino_support_session/);
  assert.doesNotMatch(route, /localStorage|sessionStorage|window\.|document\.|setInterval|setTimeout/);
  assert.doesNotMatch(route, /PINORIA_TV_STAGING_BYPASS|PINORIA_TOS_STAGING_BYPASS/);
});

test("PAP-1646 Core authenticator requires current Workforce single Center and separate published scope", () => {
  assert.match(gate, /callWorkforceCoreWithCredential/);
  assert.match(gate, /ctx\.centers\.length !== 1/);
  assert.match(gate, /credential\.kind !== "password"/);
  assert.match(gate, /policyRef !== "tvp1-center-" \+ centerId/);
  assert.match(gate, /callTosLearningCoreWithCredential/);
  assert.match(gate, /path: "\/pinoria\/tv-policies\/published"/);
  assert.match(gate, /parsePublishedTvPolicyProjection/);
  assert.doesNotMatch(gate, /INSERT INTO|UPDATE |DELETE FROM|WRANGLER|PATCH|POST/);
});
