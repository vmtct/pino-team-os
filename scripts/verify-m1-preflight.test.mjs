import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { verifyManifest, verifyGeometry, widths } from "./verify-m1-preflight.mjs";

const bytes = Buffer.from("test source bytes");
const hash = createHash("sha256").update(bytes).digest("hex");
const revision = "a".repeat(40);
const make = () => ({
  schemaVersion:1, jiraTask:"PAP-2343", epicCode:"PLT-M1-DELIVERY", surface:"ho",
  reviewUrl:"http://192.168.1.6:8800/ho?module=staffs", sourceRevision:revision, servedRevision:revision,
  fixtureIds:["STAFF-MOCK-001"], auditColumns:["Created Time","Created By","Last Modified Time","Last Modified By"],
  auditValues:"unavailable",
  sourceFiles:Object.fromEntries(["route","renderer","schema","fixture"].map(role => [role,{path:"app/ho/"+role+".tsx",sha256:hash}])),
  createRenderer:"app/ho/renderer.tsx", viewRenderer:"app/ho/renderer.tsx",
  checks:Object.fromEntries(["navigation","deepLink","reload","back","createViewRenderer","overviewHistory","keyboardFocus","mockIsolation","noWrites"].map(key=>[key,{status:"PASS",observation:"test-only observation"}])),
  css:[{url:"/ho/_next/style.css",status:200,mime:"text/css; charset=utf-8"}], unexpectedErrors:0,realWriteRequests:0,
});
const readSource = () => bytes;
test("complete synthetic test manifest passes structural checks",()=>{
  assert.deepEqual(verifyManifest(make(),readSource),[]);
});
test("reject stale SHA, wrong host, duplicate seeds, fake audit and real writes",()=>{
  for(const change of [{servedRevision:"b".repeat(40)},{reviewUrl:"http://192.168.1.6:8810/ho"},{reviewUrl:"https://ho.staging.pinohouse.art/ho"},{fixtureIds:["STAFF-MOCK-001","STAFF-MOCK-002"]},{auditValues:"invented"},{realWriteRequests:1},{unexpectedErrors:1}]) {
    assert.ok(verifyManifest({...make(),...change},readSource).length);
  }
});
test("reject mismatched source bytes, renderer, missing check and unsafe paths",()=>{
  assert.ok(verifyManifest(make(),()=>Buffer.from("wrong")).some(e=>e.includes("hash mismatch")));
  const m=make();m.viewRenderer="app/ho/other.tsx";delete m.checks.back;m.sourceFiles.route.path="app/../lib/source.ts";
  const errors=verifyManifest(m,readSource);
  assert.ok(errors.some(e=>e.includes("renderer identity")));
  assert.ok(errors.some(e=>e.includes("back")));
  assert.ok(errors.some(e=>e.includes("source identity")));
});
test("CSS MIME, origin, HTTP code and audit columns must be evidenced",()=>{
  for(const change of [{css:[]},{css:[{url:"https://example.com/a.css",status:200,mime:"text/css"}]},{css:[{url:"/a.css",status:404,mime:"text/css"}]},{css:[{url:"/a.css",status:200,mime:"text/html"}]},{auditColumns:[]}]) {
    assert.ok(verifyManifest({...make(),...change},readSource).length);
  }
});
test("five viewport geometry checks reject missing PNG, overflow and mixed identity",()=>{
  assert.deepEqual(widths,[320,390,768,1024,1440]);
  // Test bytes only, never actual screenshot evidence.
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(1024)]);
  for(const width of widths){
    const metrics={width,stages:Object.fromEntries(["table","drawer","detail"].map(s=>[s,{width,shellWidth:width,documentOverflow:0,recordId:"STAFF-MOCK-001"}]))};
    assert.deepEqual(verifyGeometry(width,metrics,()=>png,"STAFF-MOCK-001"),[]);
    metrics.stages.drawer.documentOverflow=2;metrics.stages.detail.recordId="OTHER-MOCK-001";
    assert.equal(verifyGeometry(width,metrics,s=>s==="table"?Buffer.alloc(4):png,"STAFF-MOCK-001").length,3);
  }
});
