/** PAP-1594 / PAP-1592 / Epic PAP-223 — bounded HO Path adapter transport. */
import assert from "node:assert/strict";
import test from "node:test";
import { surfaceSession } from "./workspace-adapters/session";
import { HO_STAGING_HOSTNAME } from "./host-boundary";
import { BoApiError } from "./bo-api-error";

const base = "https://" + HO_STAGING_HOSTNAME;

test("PAP-1594: HO adapter admits only exact private GET Path read, no write or query", async () => {
  const calls: string[]=[];
  const fetcher: typeof fetch = async (request) => {
    calls.push(String(request));
    return Response.json({ data: { paths: [] } });
  };
  const s=surfaceSession("HO",base,fetcher);
  try {
    const ok=await s.transport("/api/ho/learning/paths");
    assert.equal(ok.status,200);
    assert.deepEqual(calls,[base+"/api/ho/learning/paths"]);
    for(const input of [
      "/api/ho/learning/paths?debug=1",
      "/api/ho/learning/paths/malicious",
      "/api/ho/learning/paths-copy",
      "/api/ho/learning/paths/",
      "/api/ho/learning/private",
    ]) await assert.rejects(s.transport(input), (error:unknown)=> error instanceof BoApiError && error.status===404);
    for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS","HEAD"])
      await assert.rejects(s.transport("/api/ho/learning/paths",{method}), (error:unknown)=>error instanceof BoApiError && error.status===404);
    assert.equal(calls.length,1,"bad routes never reach the fetcher");
  }finally{s.dispose()}
});
