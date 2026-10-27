import test from "node:test";
import assert from "node:assert/strict";
import { BO_STAGING_HOSTNAME, BO_HOSTNAME, HO_STAGING_HOSTNAME, decideHostBoundary, isBoStagingRunningClassEnrollmentReadPath } from "./host-boundary";
import { handleHoStagingRequest } from "./ho-worker-routing";

const id = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const canonical = "/api/bo/delivery/running-classes/" + id + "/enrollments";

test("PAP-1037 admission: strict class Enrollment GET/HEAD on BO staging only", () => {
  assert.equal(isBoStagingRunningClassEnrollmentReadPath(canonical), true);
  for (const method of ["GET", "HEAD"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, canonical, method), {action:"next"});
    assert.deepEqual(decideHostBoundary(BO_HOSTNAME, canonical, method), {action:"not_found"});
    assert.deepEqual(decideHostBoundary(HO_STAGING_HOSTNAME, canonical, method), {action:"not_found"});
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, canonical, method), {action:"not_found"});
  }
});

test("PAP-1037 admission rejects malformed, unbounded and suspicious URL patterns", () => {
  const invalid = [
    "/api/bo/delivery/running-classes/not-a-id/enrollments",
    "/api/bo/delivery/running-classes/" + id + "/enrollments/extra",
    "/api/bo/delivery/running-classes/" + id + "/create",
    "/api/bo/delivery/running-classes/" + id + "/enrollments/",
    "/api/bo/delivery/running-classes/" + id.toUpperCase() + "/enrollments",
    "/api/bo/delivery/running-classes/" + id + "/enrollments%2Fdelete"
  ];
  for (const pathname of invalid) {
    assert.equal(isBoStagingRunningClassEnrollmentReadPath(pathname), false, pathname);
    assert.deepEqual(decideHostBoundary(BO_STAGING_HOSTNAME, pathname, "GET"), {action:"not_found"}, pathname);
  }
});

test("PAP-1037 Worker-first host-boundary lets canonical Enrollment reach Next and keeps denial closed", async () => {
  let reached = 0;
  const env = {ASSETS:{fetch: async () => new Response("STATIC")}};
  const source = new Request("https://" + BO_STAGING_HOSTNAME + canonical + "?limit=50");
  const response = await handleHoStagingRequest(source, env, async () => {
    reached++;
    return new Response(JSON.stringify({data:{items:[],limit:50,asOfLocalDate:"2026-10-27",nextCursor:null}}),{status:200,headers:{"content-type":"application/json"}});
  });
  assert.equal(reached,1);
  assert.equal(response.status,200);
  assert.equal((await response.json()).data.items.length,0);
  const denied = await handleHoStagingRequest(new Request("https://"+BO_STAGING_HOSTNAME+canonical,{method:"POST"}),env,async()=>{ reached++;return new Response("unsafe");});
  assert.equal(denied.status,404);
  assert.equal(await denied.text(),"Not Found");
  assert.equal(reached,1);
});
