import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reportTddCoverage } from "./report-tdd-coverage.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),"pap1077-inventory-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for (const folder of ["config","app/bo/legacy","app/ho/staff","app/bo"]) {
    fs.mkdirSync(path.join(root,folder),{recursive:true});
  }
  const put=(file,value)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),value)};
  const baseline={sourceSha:"pinned-source",routes:[{surface:"BO",route:"/bo/legacy",file:"app/bo/legacy/page.tsx",owner:"PAP-1086",tddEligibility:"PENDING",profile:"EXISTING_GRANDFATHERED"}]};
  const manifest={version:1,modules:[{surface:"HO",route:"/ho/staff",key:"staff",file:"app/ho/staff/page.tsx",profile:"TDD_DEFAULT"}],approvals:[]};
  put("app/bo/legacy/page.tsx","export default function Page() {}");
  put("app/ho/staff/page.tsx","export default function Page() {}");
  put("config/tdd-inventory.json",JSON.stringify(baseline));
  put("config/tdd-admission.json",JSON.stringify(manifest));
  put("config/tdd-approved-special.json",JSON.stringify({version:1,approvals:[]}));
  return {root,put,manifest,baseline};
}
test("S9 reports distinct TDD-admitted and grandfathered source routes without inventing G4 acceptance",t=>{
  const f=fixture(t),r=reportTddCoverage(f.root);
  assert.deepEqual(r.errors,[]);
  assert.deepEqual(r.totals,{GRANDFATHERED_MIGRATION_PENDING:1,TDD_ADMITTED_FOUNDATION:1});
  assert.equal(r.bySurface.BO.GRANDFATHERED_MIGRATION_PENDING,1);
  assert.equal(r.bySurface.HO.TDD_ADMITTED_FOUNDATION,1);
  assert.ok(r.rows.every(x=>x.servingSha===null&&x.g4==="NOT_ATTESTED_BY_STATIC_INVENTORY"));
  assert.equal(r.rows.find(x=>x.category==="GRANDFATHERED_MIGRATION_PENDING").eligibility,"PENDING");
});
test("S9 independently blocks unadmitted new BO/HO routes, including JS pages",t=>{
  const f=fixture(t);
  f.put("app/ho/new-ad-hoc/page.jsx","export default function Page() {}");
  f.put("app/bo/hidden-route/page.ts","export default function Page() {}");
  const r=reportTddCoverage(f.root);
  assert.equal(r.totals.UNADMITTED_NEW_ROUTE,2);
  assert.equal(r.errors.length,2);
  assert.ok(r.errors.some(x=>x.includes("app/ho/new-ad-hoc/page.jsx")));
  assert.ok(r.errors.some(x=>x.includes("app/bo/hidden-route/page.ts")));
});
test("S9 rejects orphaned/duplicate admission and route identity drift",t=>{
  const f=fixture(t);
  f.manifest.modules.push({...f.manifest.modules[0]});
  f.put("config/tdd-admission.json",JSON.stringify(f.manifest));
  assert.ok(reportTddCoverage(f.root).errors.some(x=>x.includes("duplicate")));
  f.manifest.modules[1]={...f.manifest.modules[0],file:"app/ho/missing/page.tsx",route:"/ho/missing",key:"missing"};
  f.put("config/tdd-admission.json",JSON.stringify(f.manifest));
  assert.ok(reportTddCoverage(f.root).errors.some(x=>x.includes("missing admitted route")));
  f.manifest.modules.pop();
  f.manifest.modules[0].surface="BO";
  f.put("config/tdd-admission.json",JSON.stringify(f.manifest));
  assert.throws(()=>reportTddCoverage(f.root),/Admission identity mismatch/);
});
test("S9 Founder-approved special route needs distinct authoritative approval record",t=>{
  const f=fixture(t);f.manifest.modules[0].profile="FOUNDER_APPROVED_SPECIAL";f.manifest.modules[0].approval="PAP-1085-CASE";
  f.put("config/tdd-admission.json",JSON.stringify(f.manifest));
  assert.ok(reportTddCoverage(f.root).errors.some(x=>x.includes("missing exact approved exception")));
  f.put("config/tdd-approved-special.json",JSON.stringify({approvals:[{id:"PAP-1085-CASE",status:"approved"}]}));
  assert.deepEqual(reportTddCoverage(f.root).errors,[]);
  assert.equal(reportTddCoverage(f.root).totals.FOUNDER_APPROVED_SPECIAL,1);
});
