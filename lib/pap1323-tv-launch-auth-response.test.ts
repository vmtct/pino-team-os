import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LocalStaffSessionError, staffPasswordSession } from "./local-staff-session";
import { TeamAuthError } from "./team-auth";
import { tvLaunchAuthErrorResponse } from "./pap1323-tv-launch-auth-response";

test("PAP-1323 absent Staff cookie fails closed as 401, not 500", async () => {
  const request = new Request("https://tos.staging.pinohouse.art/api/tv/test/launch", {method:"POST"});
  let failure: unknown;
  try { staffPasswordSession(request); } catch (error) { failure=error; }
  assert.ok(failure instanceof LocalStaffSessionError);
  const response=tvLaunchAuthErrorResponse(failure);
  assert.equal(response?.status,401);
  assert.equal(response?.headers.get("cache-control"),"no-store");
  assert.equal((await response?.json())?.error?.code,"IDENTITY_AUTHENTICATION_FAILED");
});

test("PAP-1323 known Team auth failures retain status; unknown error remains 500 path",()=>{
  assert.equal(tvLaunchAuthErrorResponse(new TeamAuthError(401,"Invalid session"))?.status,401);
  assert.equal(tvLaunchAuthErrorResponse(new TeamAuthError(503,"Unavailable"))?.status,503);
  assert.equal(tvLaunchAuthErrorResponse(new Error("TV_RUNTIME_TOKEN_MISSING")),null);
});

test("PAP-1323 launch catches classified auth failure before generic 500; Core retains 201/403",()=>{
  const route=readFileSync(new URL("../app/api/tv/[displayId]/launch/route.ts",import.meta.url),"utf8");
  assert.match(route,/const authError = tvLaunchAuthErrorResponse\(error\)/);
  assert.match(route,/if \(authError\) return authError/);
  assert.match(route,/result\.status!==201/);
  assert.match(route,/status:result\.status/);
  assert.match(route,/status:500/);
});
