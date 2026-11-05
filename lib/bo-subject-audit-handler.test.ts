import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest } from "./bo-read-handler";
import type { BoAccessRequest, BoAccessCoreBinding } from "./bo-core";
const id = "01912345-6789-7abc-8def-0123456789ab";
function request(query: string, authenticated = true, method = "GET") {
  return new Request("https://bo.pinohouse.art/api/bo/audit/subject?" + query, { method, headers: authenticated ? { cookie: "pino_staff_password_session=local-session" } : {} });
}
test("PAP-979: bounded subject read uses canonical authenticated BO transport without caller scope", async () => {
  const calls: Array<{ request: BoAccessRequest; token: string }> = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, token) { calls.push({ request, token }); return { status: 200, body: { data: { events: [], nextCursor: null } }, requestId: "audit" }; } };
  const response = await handleBoOperationalReadRequest(request(`subject_type=student_profile&subject_id=${id}&query=Mai&limit=20&cursor=opaque`), { PINO_BO_CORE: binding }, "audit/subject");
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [{ request: { method: "GET", path: "audit/subject", body: { subject_type: "student_profile", subject_id: id, query: "Mai", cursor: "opaque", limit: 20 } }, token: "local-session" }]);
});
test("PAP-1102: BFF permits only authenticated exact Subscription subject, and propagates Core denial", async () => {
  const calls: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request) {
    calls.push(request);
    return {status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"deny"};
  }};
  const query = `subject_type=subscription&subject_id=${id}&limit=20`;
  assert.equal((await handleBoOperationalReadRequest(request(query,false),{PINO_BO_CORE:binding},"audit/subject")).status,401);
  const result=await handleBoOperationalReadRequest(request(query),{PINO_BO_CORE:binding},"audit/subject");
  assert.equal(result.status,403);
  assert.deepEqual(await result.json(),{error:{code:"ACCESS_PERMISSION_DENIED"}});
  assert.deepEqual(calls,[{method:"GET",path:"audit/subject",body:{subject_type:"subscription",subject_id:id,query:"",cursor:null,limit:20}}]);
});
test("PAP-979: rejects unauthenticated, global, malformed, unbounded and spoofed scope requests before Core", async () => {
  let calls = 0;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { calls++; throw Error("unexpected"); } };
  const invoke = (query: string, auth = true, path = "audit/subject", method = "GET") => handleBoOperationalReadRequest(request(query, auth, method), { PINO_BO_CORE: binding }, path);
  const base = `subject_type=running_class&subject_id=${id}`;
  assert.equal((await invoke(base, false)).status, 401);
  assert.equal((await invoke(base, true, "audit")).status, 404);
  assert.equal((await invoke(base, true, "audit/subject", "POST")).status, 405);
  for (const query of ["", base + "&limit=51", base + "&limit=1.5", base + "&limit=", base + "&limit=1&limit=2", base + "&centerId=forged", base + "&tenantId=forged", base + "&userId=forged", base + "&cursor=", base + "&query=" + "x".repeat(121), "subject_type=student&subject_id=" + id]) assert.equal((await invoke(query)).status, 400);
  assert.equal(calls, 0);
});
test("PAP-979: preserves Core denials and conflicts without mock substitution", async () => {
  for (const status of [401, 403, 409, 500]) {
    const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { return { status, body: { error: { code: "DENIED" } }, requestId: "denial" }; } };
    const response = await handleBoOperationalReadRequest(request(`subject_type=running_class&subject_id=${id}`), { PINO_BO_CORE: binding }, "audit/subject");
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: { code: "DENIED" } });
  }
});
