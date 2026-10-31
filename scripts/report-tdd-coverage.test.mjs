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
  assert.equal(r.rows.find(x=>x.category==="GRANDFATHERED_MIGRATION_PENDING").baselineEligibility,"PENDING");
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
  assert.ok(reportTddCoverage(f.root).errors.length);
  assert.equal(reportTddCoverage(f.root).totals.FOUNDER_APPROVED_SPECIAL,undefined);
});


test("S9 keeps root hosts out of the migration denominator and source admission partial", t => {
  const f = fixture(t);
  for (const surface of ["bo", "ho"]) {
    f.put(`app/${surface}/page.tsx`, "export default function Page() {}");
    f.baseline.routes.push({ file: `app/${surface}/page.tsx`, route: `/${surface}`, surface: surface.toUpperCase(), classification: "OUT_OF_SCOPE" });
  }
  f.put("config/tdd-inventory.json", JSON.stringify(f.baseline));
  const r = reportTddCoverage(f.root);
  assert.equal(r.totals.ROOT_OR_OUT_OF_SCOPE, 2);
  assert.equal(r.totals.GRANDFATHERED_MIGRATION_PENDING, 1);
  assert.deepEqual(r.coverage.classifications, { TDD_COMPLIANT: 0, TDD_PARTIAL: 1, GRANDFATHERED: 1, FOUNDER_EXEMPT: 0, OUT_OF_SCOPE: 2, UNVERIFIED: 0 });
  assert.deepEqual(r.coverage.eligibility, { ELIGIBLE: 1, NOT_ELIGIBLE: 2, UNVERIFIED: 1 });
  assert.equal(r.rows.find(x => x.route === "/ho/staff").classification, "TDD_PARTIAL");
  assert.match(r.coverage.basis, /not.*live/i);
  assert.ok(r.rows.every(x => x.servingSha === null));
});

function approvedSpecial(f) {
  const e = f.manifest.modules[0];
  Object.assign(e, { profile: "FOUNDER_APPROVED_SPECIAL", approval: "PAP-1085-CASE", files: [e.file] });
  f.put("config/tdd-admission.json", JSON.stringify(f.manifest));
  return { id: e.approval, status: "approved", approvedBy: "Founder", reference: "https://vmtct97.atlassian.net/browse/PAP-1085?focusedCommentId=12345", approvedAt: "2026-10-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z", surface: e.surface, key: e.key, route: e.route, owner: "PAP-1085", justification: "Test alternative", designAuthority: "Test approved design", fallback: "Return to TDD", permissions: ["existing.read"], files: e.files, tests: { security: ["e2e/special.spec.ts"], authorization: ["e2e/special.spec.ts"], accessibility: ["e2e/special.spec.ts"], responsive: ["e2e/special.spec.ts"] } };
}
const reportNow = Date.parse("2026-10-31T00:00:00Z");
test("S9 reports exact validated exception owner, expiry, route and Founder receipt", t => {
  const f = fixture(t), a = approvedSpecial(f);
  f.put("config/tdd-approved-special.json", JSON.stringify({ approvals: [a] }));
  const r = reportTddCoverage(f.root, { now: reportNow });
  assert.deepEqual(r.errors, []);
  assert.equal(r.coverage.classifications.FOUNDER_EXEMPT, 1);
  const row = r.rows.find(x => x.route === a.route);
  assert.equal(row.owner, a.owner);
  assert.deepEqual(row.exceptionDetails, { id: a.id, valid: true, owner: a.owner, route: a.route, surface: a.surface, reference: a.reference, approvedAt: a.approvedAt, expiresAt: a.expiresAt });
});
for (const [label, mutate] of [
  ["expired", a => { a.expiresAt = "2026-10-30T00:00:00Z"; }],
  ["wrong route", a => { a.route = "/ho/other"; }],
  ["missing owner", a => { delete a.owner; }],
  ["missing Founder reference", a => { a.reference = "PAP-1085"; }],
  ["missing alternate accessibility", a => { a.tests.accessibility = []; }],
  ["wildcard", a => { a.files = ["app/**"]; }],
  ["revoked", a => { a.status = "revoked"; }],
]) test("S9 never counts invalid special as Founder-exempt: " + label, t => {
  const f = fixture(t), a = approvedSpecial(f); mutate(a);
  f.put("config/tdd-approved-special.json", JSON.stringify({ approvals: [a] }));
  const r = reportTddCoverage(f.root, { now: reportNow });
  assert.ok(r.errors.length);
  assert.equal(r.coverage.classifications.FOUNDER_EXEMPT, 0);
  assert.equal(r.coverage.classifications.UNVERIFIED, 1);
  assert.equal(r.rows.find(x => x.route === "/ho/staff").exceptionDetails.valid, false);
});
test("S9 duplicate approval cannot hide a revocation", t => {
  const f = fixture(t), a = approvedSpecial(f);
  f.put("config/tdd-approved-special.json", JSON.stringify({ approvals: [a, { ...a, status: "revoked" }] }));
  const r = reportTddCoverage(f.root, { now: reportNow });
  assert.ok(r.errors.length);
  assert.equal(r.coverage.classifications.FOUNDER_EXEMPT, 0);
});


test("S9 unknown admission profile cannot inherit grandfathering", t => {
  const f = fixture(t), e = { surface: "BO", route: "/bo/legacy", file: "app/bo/legacy/page.tsx", profile: "UNKNOWN" };
  f.manifest.modules.push(e);
  f.put("config/tdd-admission.json", JSON.stringify(f.manifest));
  const r = reportTddCoverage(f.root);
  assert.equal(r.coverage.classifications.UNVERIFIED, 1);
  assert.ok(r.errors.some(error => error.includes(e.file)));
});
