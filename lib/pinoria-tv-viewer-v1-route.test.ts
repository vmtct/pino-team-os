/** PAP-1646 / Epic PAP-650 PNR-TV — status-producing route admission guard. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const routeUrl = new URL("../app/tv/p/[policyRef]/route.ts", import.meta.url);
const oldPageUrl = new URL("../app/tv/p/[policyRef]/page.tsx", import.meta.url);
const route = readFileSync(routeUrl,"utf8");
const gate = readFileSync(new URL("./pinoria-tv-viewer-v1-staff.ts",import.meta.url),"utf8");
const status = readFileSync(new URL("./pinoria-tv-viewer-v1-http.ts",import.meta.url),"utf8");

test("PAP-1646 one nonstreaming logical route, never duplicate page/route",()=>{
  assert.equal(existsSync(routeUrl),true);
  assert.equal(existsSync(oldPageUrl),false);
  assert.match(route,/export async function GET\(request: Request/);
  assert.match(route,/return await handlePolicyViewerHttp\(request, env, policyRef\)/);
  assert.match(route,/return blockedPolicyViewerHttp\(503\)/);
  assert.match(route,/export function HEAD\(\)/);
  assert.match(route,/status: 405/);
  assert.doesNotMatch(route,/notFound\(|redirect\(|NEXT_REDIRECT|TvRuntimeHost|TvLauncher/);
});
test("PAP-1646 output status Response is explicit and Core authorization first",()=>{
  assert.match(status,/const outcome = await readStaffPublishedViewer\(request, env, policyRef\)/);
  assert.match(status,/return blockedPolicyViewerHttp\(outcome.status\)/);
  assert.match(status,/status, headers: HEADERS/);
  assert.match(status,/status: 200, headers: HEADERS/);
  assert.match(status,/data-pnr-tv-published-policy="authorized"/);
  assert.match(status,/data-pnr-tv-frame="16:9"/);
  assert.match(status,/cache-control/);
  assert.match(status,/default-src 'none'/);
  assert.doesNotMatch(status,/localStorage|sessionStorage|window\.|document\.|setInterval|setTimeout/);
});
test("PAP-1646 Core authenticator still demands one Center and distinct Core policy read",()=>{
  assert.match(gate,/callWorkforceCoreWithCredential/);
  assert.match(gate,/ctx\.centers\.length !== 1/);
  assert.match(gate,/credential\.kind !== "password"/);
  assert.match(gate,/policyRef !== "tvp1-center-" \+ centerId/);
  assert.match(gate,/callTosLearningCoreWithCredential/);
  assert.match(gate,/path: "\/pinoria\/tv-policies\/published"/);
  assert.match(gate,/parsePublishedTvPolicyProjection/);
  assert.doesNotMatch(gate,/INSERT INTO|UPDATE |DELETE FROM|WRANGLER|PATCH|POST/);
});
