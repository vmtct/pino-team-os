import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary, HO_STAGING_HOSTNAME } from "./host-boundary";
import { PROTOTYPE_KEYS, PROTOTYPE_SECTIONS, prototypeModules, prototypeRows, prototypeRoute,prototypeCounts } from "./ho-prototype-fixtures";

test("Prototype route exists only on exact HO staging hostname and GET",()=>{
 assert.deepEqual(decideHostBoundary(HO_STAGING_HOSTNAME,"/prototype","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(HO_STAGING_HOSTNAME,"/prototype","HEAD"),{action:"next"});
 for(const method of ["POST","PUT","PATCH","DELETE"]){
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,"/prototype",method).action,"not_found",method);
 }
 for(const host of ["ho.pinohouse.art","bo.staging.pinohouse.art","tos.staging.pinohouse.art","pino-team-os-staging.minhtri-van42.workers.dev","localhost","bo.pinohouse.art"]){
  assert.equal(decideHostBoundary(host,"/prototype","GET").action,"not_found",host);
 }
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,"/prototype/mutate","GET").action,"not_found");
 assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME,"/api/founder/pinoria/wish/catalog","GET").action,"not_found");
});
test("All 14 prototype modules have record-rich, visibly labeled, view-only fields",()=>{
 assert.equal(PROTOTYPE_KEYS.length,14);
 assert.equal(new Set(PROTOTYPE_KEYS).size,14);
 for(const k of PROTOTYPE_KEYS){
  const definition=prototypeModules[k],rows=prototypeRows(k);
  assert.ok(definition.fields.length>=3,k);
  assert.ok(definition.fields.every(f=>f.readonly===true),k);
  assert.ok(rows.length>0,k);
  assert.ok(rows.every(r=>typeof r.id==="string"&&typeof r.name==="string"),k);
  assert.ok(rows.every(r=>["Mô phỏng","Staging · QA"].includes(String(r.dataset))),k);
  assert.equal(prototypeCounts(k).shown,rows.length,k);
  assert.ok(prototypeRoute(k).startsWith("/prototype?module="));
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,k);
 }
});
test("A2 DEFAULT and Center overrides are distinguishable and all three sites are populated",()=>{
 const p=prototypeRows("tvPolicy");
 assert.equal(p.filter(r=>r.scope==="DEFAULT").length,1);
 assert.equal(p.filter(r=>r.scope==="CENTER").length,5);
 assert.equal(prototypeRows("tvPolicy","default").length,1);
 assert.equal(prototypeRows("tvPolicy","center").length,5);
 assert.ok(p.some(r=>r.resolution==="Inherited"));
 assert.ok(p.some(r=>r.resolution==="Override"));
 const cms=prototypeRows("cms");
 assert.ok(cms.length>=9);
 for(const site of ["PINOHOUSE","TOPPI","AFTERWORK"]){
  const rows=prototypeRows("cms",site);
  assert.ok(rows.length>=2,site);
  assert.ok(rows.every(r=>r.site===site),site);
 }
});
test("A3 Wish exposes four read-only data sections and Activity scope is honest",()=>{
 const expected=PROTOTYPE_SECTIONS.wish?.map(v=>v.value);
 assert.deepEqual(expected,["catalog","banners","rules","phases"]);
 for(const section of expected||[]){
  const rows=prototypeRows("wish",section);
  assert.ok(rows.length>0,section);
  assert.ok(rows.every(r=>r.section===section),section);
 }
 const a=prototypeRows("activities");
 assert.ok(a.some(r=>r.scope==="GLOBAL"));
 assert.ok(a.some(r=>r.scope==="CENTER"));
 assert.ok(a.some(r=>r.dataset==="Staging · QA"));
 assert.ok(prototypeRows("activities","global").every(r=>r.scope==="GLOBAL"));
 assert.ok(prototypeRows("activities","center").every(r=>r.scope==="CENTER"));
});
test("Pseudonymized personnel preview has no real user emails or IDs",()=>{
 for(const k of ["users","roles","audits"] as const){
  const rows=prototypeRows(k);
  assert.ok(rows.every(r=>r.dataset==="Mô phỏng"));
  assert.ok(rows.every(r=>!/@/.test(JSON.stringify(r))),k);
 }
});
