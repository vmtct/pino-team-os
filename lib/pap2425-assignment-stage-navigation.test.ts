import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {assignmentStageHref,assignmentStageState} from "../app/bo/missions/assignment-stage-navigation";
import {expandedAssignmentQuery} from "../app/bo/missions/assignment-expanded-schema";
const center="00000000-0000-4000-8000-000000000001",foreign="00000000-0000-4000-8000-000000000002";
const origin="https://bo.staging.pinohouse.art";
const table={kind:"table",tab:"overview",query:expandedAssignmentQuery} as const;
const detail={kind:"detail",recordId:"ASSIGNMENT-MOCK-001",tab:"history",query:expandedAssignmentQuery} as const;
test("PAP-2425 staging navigation retains exact Center and canonical synthetic state",()=>{
 for(const state of [table,detail]){
  const url=new URL(assignmentStageHref(center,state),origin);
  assert.equal(url.pathname,"/bo/missions");assert.equal(url.searchParams.get("centerId"),center);
  assert.deepEqual(assignmentStageState(url,center),state);
  assert.throws(()=>assignmentStageState(url,foreign));
 }
 assert.throws(()=>assignmentStageHref("bad",table));
 assert.throws(()=>assignmentStageHref(center,{...detail,recordId:"real"}));
});
test("PAP-2425 URL authority and local guard preserved; staged wrapper shares same fixture content",()=>{
 const url=new URL(assignmentStageHref(center,table),origin);
 assert.deepEqual(assignmentStageState(url,center,detail),table);
 const shared=readFileSync("app/bo/missions/MissionAssignmentM1.tsx","utf8");
 const wrapper=readFileSync("app/bo/missions/MissionAssignmentStageReview.tsx","utf8");
 const local=readFileSync("app/bo/missions/assignment-m1-navigation.ts","utf8");
 assert.match(shared,/createAssignmentM1Navigation\(initialRecord\)/);
 assert.match(shared,/<MissionAssignmentM1Content navigation=\{navigation\}/);
 assert.match(wrapper,/verifyAssignmentStageReview/);assert.match(wrapper,/center\.selected===admission\.centerId/);
 assert.match(wrapper,/<MissionAssignmentM1Content key=\{key\} navigation=\{ready\.navigation\}/);
 assert.match(wrapper,/value="ephemeral"/);assert.match(local,/self\.origin!=="null"/);
 assert.doesNotMatch(readFileSync("app/bo/missions/page.tsx","utf8"),/MissionAssignmentStageReview/);
});

test("PAP-2425 scope loss unmounts the verified child; returning scope must start from fresh proof",()=>{
 const source=readFileSync("app/bo/missions/MissionAssignmentStageReview.tsx","utf8");
 const boundary=source.slice(source.indexOf("export function MissionAssignmentStageReview"),source.indexOf("function AdmittedAssignmentStageReview"));
 const child=source.slice(source.indexOf("function AdmittedAssignmentStageReview"));
 assert.match(boundary,/if\(!allowed\)return <p role="alert"/);
 assert.match(boundary,/<AdmittedAssignmentStageReview key=\{key\} admission=\{admission\} scopeKey=\{key\}/);
 assert.doesNotMatch(boundary,/useState|useEffect|MissionAssignmentM1Content/);
 assert.match(child,/useState<Ready\|null>\(null\)/);
 assert.match(child,/verifyAssignmentStageReview/);
 assert.match(child,/if\(ctl.signal.aborted\)return/);
 assert.match(child,/return\(\)=>ctl.abort\(\)/);
 assert.match(child,/if\(ready\?\.key!==key\)return <p role="status"/);
});
