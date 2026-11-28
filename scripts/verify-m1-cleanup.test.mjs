import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { auditCleanup } from "./verify-m1-cleanup.mjs";
const revision="a".repeat(40);
const f=(name,phase,jiraTask)=>({jiraTask,phase,surface:"ho",sourceRoots:["app/ho/"+name],removedPaths:["app/ho/"+name+"/preview.tsx"],markers:[name.toUpperCase()+"-MOCK-001",name+"PreviewEnabled"]});
const registry={sourceRevision:revision,features:[f("staff","M4","PAP-2346"),f("other","M1","PAP-2345")]};
const file=(path,text)=>({path,bytes:Buffer.from(text)});
const pkgDigest=files=>{
  const hash=x=>createHash("sha256").update(x).digest("hex");
  return hash(JSON.stringify(files.map(x=>({path:x.path,size:x.bytes.length,sha256:hash(x.bytes)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)));
};
const make=(packageFiles=[file("assets/app.js","OTHER-MOCK-001")])=>({registry,mode:"M4",revision,sourceFiles:[file("app/ho/staff/page.tsx","real staff"),file("app/ho/other/preview.tsx","OTHER-MOCK-001")],packageFiles,packageDigest:pkgDigest(packageFiles)});
test("feature M4 does not block separate active M1; runtime remains unverified",()=>{
  const r=auditCleanup(make());assert.equal(r.staticEvidencePass,true);assert.deepEqual(r.selected,["PAP-2346"]);assert.equal(r.runtimeNegative,"NOT_RUN");assert.equal(r.founderGate2,"PENDING_MANUAL");
});
test("production scans all registered mock markers",()=>{
  const r=auditCleanup({...make(),mode:"production"});assert.equal(r.staticEvidencePass,false);assert.ok(r.errors.some(e=>e.jiraTask==="PAP-2345"&&e.kind==="PACKAGE_MARKER"));
});
test("reject lingering source and package marker/path",()=>{
  const m=make([file("assets/app.js","STAFF-MOCK-001")]);m.sourceFiles.push(file("app/ho/staff/preview.tsx","staffPreviewEnabled"));
  const r=auditCleanup(m);assert.equal(r.staticEvidencePass,false);for(const kind of ["REMOVED_PATH_PRESENT","SOURCE_MARKER","PACKAGE_MARKER"])assert.ok(r.errors.some(e=>e.kind===kind));
});
test("reject stale digest, SHA, mode and empty evidence",()=>{
  const m=make();assert.equal(auditCleanup({...m,packageDigest:"b".repeat(64)}).staticEvidencePass,false);
  for(const change of [{revision:"b".repeat(40)},{mode:"unknown"},{packageFiles:[]},{registry:{sourceRevision:revision,features:[]}}])assert.throws(()=>auditCleanup({...m,...change}));
});
test("ordinary business terms are not automatically mock markers",()=>{
  const m=make([file("assets/app.js","staff can review the mock training class")]);assert.equal(auditCleanup(m).staticEvidencePass,true);
});
