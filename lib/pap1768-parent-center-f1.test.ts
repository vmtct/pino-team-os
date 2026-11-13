/** PAP-1768 — BO Parent Center multi-select F1 G3 negative controls (Epic PAP-1384). */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planParentDirectCenters,safeParentCenterLabels,validateParentCenterRead} from
  "../app/bo/parents/parent-center-multiselect-model";

const a="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const b="01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const foreign="01a0b29a-3acd-7a18-a0f2-cf6016548ab7";
const parent="01a1be6d-b06c-7868-be08-bbed0d3a9a8f";
const source={parentId:parent,selectedCenterId:a,centers:[
  {centerId:a,centerName:"Cần Thơ",direct:true,inherited:false,selected:true},
  {centerId:b,centerName:"An Giang",direct:false,inherited:true,selected:true},
]};

test("F1 verified source-only Center model keeps direct/inherited distinct",()=>{
  assert.equal(validateParentCenterRead(source).centers[1].inherited,true);
  assert.deepEqual(planParentDirectCenters(source,[a]),[a]);
  assert.deepEqual(planParentDirectCenters(source,[a,b]),[a,b]);
  assert.deepEqual(safeParentCenterLabels(["Cần Thơ","An Giang","Cần Thơ"]),["Cần Thơ","An Giang"]);
});
test("F1 fail closed on foreign/duplicate/malformed Center, untrusted provenance or selected Center loss",()=>{
  assert.throws(()=>planParentDirectCenters(source,[a,foreign]),/FOREIGN_OR_DUPLICATE/);
  assert.throws(()=>planParentDirectCenters(source,[a,a]),/FOREIGN_OR_DUPLICATE/);
  assert.throws(()=>planParentDirectCenters(source,[]),/SELECTED_CENTER_WOULD_BE_REMOVED/);
  assert.throws(()=>validateParentCenterRead({...source,selectedCenterId:foreign}),/SELECTED_CENTER_NOT_VISIBLE/);
  assert.throws(()=>validateParentCenterRead({...source,centers:[source.centers[0],source.centers[0]]}),/DUPLICATE_CENTER/);
  assert.throws(()=>validateParentCenterRead({...source,centers:[{...source.centers[0],selected:false}]}),/INVALID_PROVENANCE/);
  assert.throws(()=>validateParentCenterRead({...source,centers:[]}),/UNBOUNDED_CENTERS/);
  assert.throws(()=>safeParentCenterLabels([""]),/INVALID_FALLBACK/);
  const directInherited={...source,centers:[{...source.centers[0],inherited:true}]};
  assert.throws(()=>planParentDirectCenters(directInherited,[]),/INHERITED_DIRECT_CANNOT_REMOVE/);
});
test("BO Full Detail has one Center field authority and no unverified write, preserves native DSA",()=>{
  const tabs=readFileSync("app/bo/components/registration/BoParentReadTabs.tsx","utf8");
  const view=readFileSync("app/bo/parents/ParentDirectoryDsa.tsx","utf8");
  const component=readFileSync("app/bo/parents/ParentCenterMultiSelect.tsx","utf8");
  const native=readFileSync("app/bo/parents/parent-native-data.ts","utf8");
  assert.match(tabs,/ParentCenterMultiSelect/);
  assert.match(tabs,/field\.key!=="centers"/);
  assert.match(view,/centerNames=\{detail\.centerNames\}/);
  assert.match(native,/centerNames: \[\.\.\.\(row\.centers as string\[\]\)\]/);
  assert.match(component,/!!source&&canEdit&&typeof onSaveDirect==="function"/);
  assert.match(component,/option\.inherited\|\|selection\.includes/);
  assert.doesNotMatch(component,/fetch\(|PATCH|ensurePermissionRegistry|localStorage/);
  assert.match(tabs,/role="tablist"/);
  assert.match(tabs,/role="tabpanel"/);
  assert.doesNotMatch(view,/TddRegistry|createBoTddAdapter|SurfaceWorkspace/);
});
