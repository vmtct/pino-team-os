import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BO_TARGET_ROUTES, BO_LEGACY_QUERY_MODULES, buildBoTargetUrl, parseBoTargetUrl } from "./bo-url-contract";
import { BO_HOSTNAME, TOS_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { isBoStagingRouteAdmitted } from "../app/bo/architecture/bo-staging-route-policy";

const staging="bo.staging.pinohouse.art";

test("PAP-1460 / PAP-650: BO TVs route and URL contract retired, source preserved",()=>{
  assert.equal(BO_TARGET_ROUTES.some(x=>x.key==="tvs"),false);
  assert.equal(BO_LEGACY_QUERY_MODULES.includes("tvs" as never),false);
  for(const path of ["/bo/tvs","/bo/tvs/","/bo/tvs/tv_123"]){
    assert.equal(parseBoTargetUrl(path),null);
    assert.equal(isBoStagingRouteAdmitted(path),false);
    for(const host of [staging, BO_HOSTNAME, "ho.staging.pinohouse.art", TOS_STAGING_HOSTNAME])
      assert.deepEqual(decideHostBoundary(host,path,"GET"),{action:"not_found"},host+path);
  }
  assert.throws(()=>buildBoTargetUrl({moduleKey:"tvs" as never,surface:"table"}),/Unknown BO URL module/);
  assert.throws(()=>buildBoTargetUrl({moduleKey:"tvs" as never,surface:"detail",recordId:"tv_123",tab:"space"}),/Unknown BO URL module/);
  // The historical TV TDD source/schema and audit remain in Git; no active page references it.
  const page=readFileSync(new URL("../app/bo/tvs/page.tsx",import.meta.url),"utf8");
  const source=readFileSync(new URL("../app/bo/tvs/TvsTdd.tsx",import.meta.url),"utf8");
  assert.match(page,/notFound\(\)/);
  const middleware=readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");
  assert.match(middleware,/retired BO TV route/);
  assert.doesNotMatch(page,/import \{\s*TvsTdd\s*\}/);
  assert.match(source,/SurfaceWorkspace/);
});
test("PAP-1460 retired BO TV link never advertises Founder HO access",()=>{
  const nav=readFileSync(new URL("../app/bo/navigation.ts",import.meta.url),"utf8");
  const operator=readFileSync(new URL("../app/bo/pinoria-tv-operator/page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(nav,/href:\s*["']\/bo\/tvs/);
  assert.doesNotMatch(operator,/href=["']\/bo\/tvs/);
  assert.deepEqual(decideHostBoundary(staging,"/bo/missions","GET"),{action:"next"});
});
