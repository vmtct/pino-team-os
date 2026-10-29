import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHostBoundary } from "./host-boundary";
import { handleHoStaffRole, linkedRoleUser, parseStaffRoleCommand, type HoStaffRoleEnv } from "./ho-staff-role-facade";
import { resolveStaffRoleAccount } from "../app/ho/staff/StaffRoleAccess";
import type { BoAccessSystemUser } from "./bo-access-model";
const staff = "00000000-0000-4000-8000-000000000099";
const actor = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const roleId = "00000000-0000-4000-8000-000000000003";
const assignmentId = "00000000-0000-4000-8000-000000000004";
const host = "ho.staging.pinohouse.art";
const path = `/api/ho/staff/${staff}/role`;
const env = { APP_ENV: "staging" } as HoStaffRoleEnv;
function req(origin = `https://${host}`, body = JSON.stringify({action:"remove",assignmentId}), hostname = host) {
  return new Request(`https://${hostname}${path}`, { method:"POST",
    headers: {host:hostname,origin,"content-type":"application/json","idempotency-key":"pap1147-test-1"},body });
}
test("PAP-1147 exact HO staging POST boundary; all other hosts and verbs fail", () => {
  assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"next"});
  for (const method of ["GET","PATCH","DELETE"] as const)
    assert.deepEqual(decideHostBoundary(host,path,method),{action:"not_found"});
  for (const hostname of ["bo.staging.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art","localhost"])
    assert.deepEqual(decideHostBoundary(hostname,path,"POST"),{action:"not_found"});
});
test("Role command strictly validates scope and ID", () => {
  assert.deepEqual(parseStaffRoleCommand({action:"assign",roleId,scopeType:"GLOBAL",scopeId:null}),
    {action:"assign",roleId,scopeType:"GLOBAL",scopeId:null});
  assert.deepEqual(parseStaffRoleCommand({action:"remove",assignmentId}),{action:"remove",assignmentId});
  for (const bad of [{action:"assign",roleId,scopeType:"CENTER",scopeId:null},
    {action:"assign",roleId,scopeType:"GLOBAL",scopeId:staff},
    {action:"assign",roleId,scopeType:"CENTER",scopeId:"bogus"},
    {action:"remove",assignmentId,userId},
    {action:"assign",roleId,scopeType:"GLOBAL",scopeId:null,userId},null]) assert.equal(parseStaffRoleCommand(bad),null);
});
test("Target must be unique active Access account different from actor", () => {
  const rows = [{id:userId,staffMemberId:staff,status:"active",
    assignments:[{assignmentId,roleKey:"teacher"}]}];
  assert.deepEqual(linkedRoleUser(rows,staff,actor),{user:rows[0]});
  assert.deepEqual(linkedRoleUser(rows,staff,userId),{error:403});
  assert.deepEqual(linkedRoleUser([{...rows[0],status:"suspended"}],staff,actor),{error:409});
  assert.deepEqual(linkedRoleUser([],staff,actor),{error:404});
  assert.deepEqual(linkedRoleUser([...rows,...rows],staff,actor),{error:502});
  assert.equal(resolveStaffRoleAccount(rows as BoAccessSystemUser[],staff).ambiguous,false);
  assert.equal(resolveStaffRoleAccount([...rows,...rows] as BoAccessSystemUser[],staff).ambiguous,true);
});
test("Role facade fail closed on origin, payload, env, authentication", async () => {
  assert.equal((await handleHoStaffRole(req("https://evil.invalid"),env,staff)).status,403);
  assert.equal((await handleHoStaffRole(req(undefined,JSON.stringify({action:"remove",assignmentId,userId})),env,staff)).status,400);
  assert.equal((await handleHoStaffRole(req(),{...env,APP_ENV:"production"},staff)).status,404);
  assert.equal((await handleHoStaffRole(req(),env,"not-uuid")).status,404);
  assert.ok([401,403].includes((await handleHoStaffRole(req(),env,staff)).status));
});
test("PAP-1148 HO account footer binds authenticated Core displayName and neutral fallback", () => {
  const ho = readFileSync("app/ho/HoWorkspace.tsx","utf8");
  const shell = readFileSync("app/bo/components/registration/BoRegistrationWorkspace.tsx","utf8");
  const staffUi = readFileSync("app/ho/staff/StaffTdd.tsx","utf8");
  assert.match(ho,/fetch\("\/api\/bo\/context"/);
  assert.match(ho,/context\?\.displayName/);
  assert.match(shell,/data-testid="ho-signed-in-user"/);
  assert.match(staffUi,/StaffRoleAccess/);
  assert.doesNotMatch(ho,/localStorage|sessionStorage/);
});
