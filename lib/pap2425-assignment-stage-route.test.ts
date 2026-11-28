import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {assignmentStageReviewEnabled,assignmentStageReviewUrl,assignmentStageSearchParams,hasAssignmentStageReviewPermissions} from "../app/bo/missions/assignment-stage-route";
const center="00000000-0000-4000-8000-000000000001";
const gate={APP_ENV:"staging",BO_UI_ONLY:"enabled",BO_MISSION_ASSIGNMENT_M1_REVIEW:"enabled"};
const host="bo.staging.pinohouse.art";
test("PAP-2425 explicit staging flag defaults off and never enables another host or environment",()=>{
 assert.equal(assignmentStageReviewEnabled(gate,host),true);
 for(const env of [{},{...gate,APP_ENV:"production"},{...gate,BO_UI_ONLY:"disabled"},{...gate,BO_MISSION_ASSIGNMENT_M1_REVIEW:undefined}])
  assert.equal(assignmentStageReviewEnabled(env,host),false);
 for(const h of ["bo.pinohouse.art","ho.staging.pinohouse.art","bo.staging.pinohouse.art.evil","bo.staging.pinohouse.art:443"])
  assert.equal(assignmentStageReviewEnabled(gate,h),false);
 assert.equal(hasAssignmentStageReviewPermissions(["team.bo.access","student.mission_assignment.view","student.mission_assignment.manage"]),true);
 assert.equal(hasAssignmentStageReviewPermissions(["team.bo.access","student.mission_assignment.view"]),false);
});
test("PAP-2425 legacy and canonical URLs share exact synthetic TDD grammar",()=>{
 assert.equal(assignmentStageReviewUrl(new URLSearchParams())?.pathname,"/bo/missions");
 assert.equal(assignmentStageReviewUrl(new URLSearchParams("module=missions"),true)?.pathname,"/bo/missions");
 const state="centerId="+center+"&record=ASSIGNMENT-MOCK-001&surface=detail&tab=history";
 const canonical=assignmentStageReviewUrl(new URLSearchParams(state));
 assert.ok(canonical);
 assert.equal(assignmentStageReviewUrl(new URLSearchParams("module=missions&"+state),true)?.href,canonical.href);
 for(const query of ["record=ASSIGNMENT-MOCK-001","centerId=bad","centerId="+center+"&centerId="+center,"centerId="+center+"&record=real","centerId="+center+"&tab=history","centerId="+center+"&m1Preview=1","module=missions"])
  assert.equal(assignmentStageReviewUrl(new URLSearchParams(query)),null,query);
 for(const query of ["module=students","module=missions&module=missions","module=missions&centerId=bad"])
  assert.equal(assignmentStageReviewUrl(new URLSearchParams(query),true),null,query);
 assert.equal(assignmentStageReviewUrl(assignmentStageSearchParams({centerId:[center,center]})),null);
});
test("PAP-2425 canonical server proof and shared workspace entry; live branch unchanged when disabled",()=>{
 const page=readFileSync("app/bo/missions/page.tsx","utf8");
 const legacy=readFileSync("app/bo/page.tsx","utf8");
 const workspace=readFileSync("app/bo/missions/BoMissionsTdd.tsx","utf8");
 const entry=readFileSync("app/bo/missions/MissionAssignmentStageReview.tsx","utf8");
 assert.match(page,/if\(!assignmentStageReviewEnabled[\s\S]*?return <BoMissionsTdd\/>/);
 assert.match(page,/authorizeBoShell\(incoming,env\)/);
 assert.match(page,/hasAssignmentStageReviewPermissions\(actor.permissionKeys\)/);
 assert.match(page,/authorizeAssignmentStageReview\(\{url,headers:incoming,env,featureEnabled:true\}\)/);
 assert.match(page,/admission.actorId!==actor.userId/);
 assert.match(page,/<BoMissionsTdd reviewContent=\{<MissionAssignmentStageEntry expectedActorId=\{actor.userId\} admission=\{admission\}/);
 assert.match(legacy,/if\(query.module==="missions"\)[\s\S]*?assignmentStageReviewUrl\(assignmentStageSearchParams\(query\),true\)[\s\S]*?redirect\(target.pathname\+target.search\)/);
 assert.match(workspace,/const content = reviewContent \?\? <section/);
 assert.match(workspace,/<BoRegistrationWorkspace source=\{unifiedBoWorkspaceSource\}/);
 assert.match(entry,/location.replace\(ASSIGNMENT_M1_ROUTE\+"\?"\+new URLSearchParams\(\{centerId:selected\}\)/);
 assert.match(entry,/if\(!scopeMatches\|\|!admission\)return <p role="status"/);
});

test("PAP-2425 legacy linked Diary selection resets before a new assignment Detail renders",()=>{
 const source=readFileSync("app/bo/missions/BoMissionsTdd.tsx","utf8");
 assert.match(source,/if\(diaryDetailId!==detailId\)\{\s*setDiaryDetailId\(detailId\);\s*setSelectedDiary\(null\);/);
 assert.doesNotMatch(source,/useEffect\(\(\) => setSelectedDiary\(null\)/);
 assert.match(source,/<ScopedMissionAssignment key=\{selected\+":"\+center.source\}/);
 assert.match(source,/onClose=\{\(\) => setSelectedDiary\(null\)\}/);
});
