// PAP-1536 / Epic PAP-220 — exact Core Center scope and narrow projection.
import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const center = "01912345-6789-7abc-8def-0123456789ab";
const phantom = "00000000-0000-4000-8000-000000000000";
const path = "workforce/staff-records";
const cookie = "pino_staff_password_session=synthetic-staff-session";
const makeRequest = (query: string, auth = true) => new Request(
  "https://bo.staging.pinohouse.art/api/bo/" + path + query,
  { headers: auth ? { cookie } : {} },
);
const env = (binding: BoAccessCoreBinding): BoReadEnv => ({ PINO_BO_CORE: binding });

test("PAP-1536 forwards one explicit Center and preserves Core denial without fallback", async () => {
  const forwarded: BoAccessRequest[] = [];
  const row = {id:"01912345-6789-7abc-8def-0123456789ac", displayLabel:"Synthetic Staff", status:"inactive", department:null, roleLabel:null};
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return request.resource?.centerId === center
        ? {status:200,body:{data:[row]},requestId:"scoped"}
        : {status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"denied"};
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest("?centerId="+center),env(binding),path);
  assert.equal(response.status,200); assert.deepEqual(await response.json(),{data:[row]});
  assert.equal(response.headers.get("x-request-id"),"scoped");
  const denied = await handleBoOperationalReadRequest(makeRequest("?centerId="+phantom),env(binding),path);
  assert.equal(denied.status,403); assert.equal((await denied.json()).error.code,"ACCESS_PERMISSION_DENIED");
  assert.deepEqual(forwarded,[{method:"GET",path,resource:{centerId:center}},{method:"GET",path,resource:{centerId:phantom}}]);
});

test("PAP-1536 rejects unexpected scoped projections without leaking fields", async () => {
  const valid = {id:"01912345-6789-7abc-8def-0123456789ac",displayLabel:"Synthetic",status:"active",department:null,roleLabel:null};
  for (const row of [{id:"GLOBAL_STAFF_ROW"},{...valid,email:"private@example.invalid"},{...valid,status:"unknown"}]) {
    const binding: BoAccessCoreBinding = {async executeWithStaffPassword(){return {status:200,body:{data:[row]},requestId:"invalid"};}};
    const response=await handleBoOperationalReadRequest(makeRequest("?centerId="+center),env(binding),path);
    assert.equal(response.status,502);assert.equal((await response.json()).error.code,"PLATFORM_INTERNAL_ERROR");
  }
});

test("PAP-1536 preserves legacy no-Center request shape and Core 403", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "legacy-denied" };
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest(""), env(binding), path);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "legacy-denied");
  assert.deepEqual(forwarded, [{ method: "GET", path }]);
});

test("PAP-1536 rejects duplicate, malformed and identity query overrides before Core", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 200, body: { data: [] }, requestId: "unexpected-core" };
    },
  };
  for (const query of [
    "?centerId=",
    "?centerId=forged",
    "?centerId=" + center + "&centerId=" + center,
    "?centerId=" + center + "&userId=forged",
    "?centerId=" + center + "&email=forged",
    "?centerId=" + center + "&limit=0",
    "?staffMemberId=" + center,
    "?centerId=%00",
  ]) {
    const response = await handleBoOperationalReadRequest(makeRequest(query), env(binding), path);
    assert.equal(response.status, 400, query);
  }
  assert.equal(forwarded.length, 0);
});

test("PAP-1536 unauthenticated scoped request fails 401 before Core", async () => {
  let coreCalled = false;
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword() {
      coreCalled = true;
      return { status: 200, body: { data: [] }, requestId: "unexpected" };
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest("?centerId=" + center, false), env(binding), path);
  assert.equal(response.status, 401);
  assert.equal(coreCalled, false);
});
