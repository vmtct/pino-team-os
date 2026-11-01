import test from "node:test";
import assert from "node:assert/strict";
import { BO_HOSTNAME, TOS_HOSTNAME } from "./host-boundary";
import { checkApiContract, checkPageContract, collectNavHrefs, verifyReleaseRouteContracts } from "./release-confidence-contract";

test("PAP-867: every advertised BO route and contracted API has a valid page/host/dispatch path", () => {
  assert.deepEqual(verifyReleaseRouteContracts(process.cwd()), []);
});
test("PAP-867: missing navigation page fails without any browser session", () => {
  assert.ok(checkPageContract(process.cwd(), BO_HOSTNAME, "/bo/not-a-real-menu").includes("missing_page"));
});
test("PAP-867: BO UI and API cannot leak through TOS", () => {
  assert.ok(checkPageContract(process.cwd(), TOS_HOSTNAME, "/bo/missions").includes("host_denied"));
  assert.ok(checkApiContract(process.cwd(), "/api/bo/missions/nonexistent", "lib/missing.ts", "fake").includes("missing_dispatch_target"));
});
test("PAP-867: nested navigation additions are automatically collected", () => {
  assert.deepEqual(collectNavHrefs([{href:"/bo",children:[{href:"/bo/new"},{href:"/bo/new"}]}]), ["/bo", "/bo/new"]);
});

test("PAP-1220 staged-only Classroom Diary stays in navigation coverage, not Production",()=>{
 const bo="bo.staging.pinohouse.art",route="/bo/classroom-diaries";
 assert.deepEqual(checkPageContract(process.cwd(),bo,route),[]);
 assert.ok(checkPageContract(process.cwd(),BO_HOSTNAME,route).includes("host_denied"));
});
