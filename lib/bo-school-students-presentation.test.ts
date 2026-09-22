import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path:string)=>readFile(path,"utf8");

test("School Students uses descending keyset canonical reads and no review snapshot",async()=>{const [view,api]=await Promise.all([read("app/bo/learners/BoLearnersView.tsx"),read("lib/bo-api.ts")]);assert.match(view,/collectPagedDirectory/);assert.match(view,/boApi\.learners\("", limit, beforeStudentId\)/);assert.match(view,/boApi\.learnerLifecycle/);assert.doesNotMatch(view,/student-snapshot|Production D1 snapshot|school-students-review/);assert.match(api,/beforeStudentId=/);assert.doesNotMatch(api,/offset=/);});

test("School Students F5 permits bounded identity intake while owner commercial operations stay delegated",async()=>{const [view,api,writeHandler]=await Promise.all([read("app/bo/learners/BoLearnersView.tsx"),read("lib/bo-api.ts"),read("lib/bo-write-handler.ts")]);assert.match(view,/boApi\.createStudentIntake/);assert.match(view,/Tạo học viên \+ Parent/);assert.match(api,/createStudentIntake/);assert.match(api,/student-intakes/);assert.match(api,/idempotencyKey: string/);assert.doesNotMatch(api,/student-intakes[^\n]*crypto\.randomUUID/);assert.match(view,/const \[attempt, setAttempt\]/);assert.match(view,/currentAttempt = attempt/);assert.match(view,/createStudentIntake\(currentAttempt\.body, currentAttempt\.idempotencyKey\)/);assert.match(view,/Thử lại cùng yêu cầu/);assert.match(view,/canResetAttempt/);assert.match(view,/cause instanceof BoApiError && cause\.structuredResponse && cause\.status >= 400 && cause\.status < 500/);assert.match(view,/uncertainAttempt = attemptLocked && Boolean\(error\) && !canResetAttempt/);assert.match(view,/closeIfSafe/);assert.match(view,/disabled=\{busy \|\| uncertainAttempt\}/);assert.match(view,/attemptLocked && error && canResetAttempt/);assert.match(view,/Sửa dữ liệu/);assert.match(api,/new BoApiError\(response\.status[^;]*false\)/);assert.match(api,/canonicalMessage/);assert.match(api,/canonicalId/);assert.match(api,/Student intake returned an invalid response/);assert.match(writeHandler,/STUDENT_INTAKE_PATH/);for(const command of ["createSubscription","renewSubscription","cancelSubscription","placeEnrollment","endEnrollment","transferEnrollment","resetParentPin","replayContext"])assert.doesNotMatch(view,new RegExp("boApi\\\\."+command+"|"+command));assert.match(view,/\/bo\/subscriptions\?studentId=/);assert.match(view,/href="\/bo\/running-classes"/);});

test("School Students keeps selected-Student request fencing",async()=>{const view=await read("app/bo/learners/BoLearnersView.tsx");assert.match(view,/LatestRequestFence/);assert.match(view,/selectedIdRef/);assert.doesNotMatch(view,/window\.sessionStorage|ActionSheet|Manager command/);});

test("School Student Pinoria composes canonical readiness and only the governed F4a Feed command", async () => {
  const [view, panel, api, readHandler, writeHandler] = await Promise.all([
    read("app/bo/learners/BoLearnersView.tsx"), read("app/bo/learners/StudentPinoriaPanel.tsx"), read("lib/bo-api.ts"), read("lib/bo-read-handler.ts"), read("lib/bo-write-handler.ts"),
  ]);
  assert.match(view, /<StudentPinoriaPanel studentId=/);
  assert.match(panel, /boApi\.learnerPinoria/);
  assert.match(panel, /boApi\.feedLearnerCompanion/);
  assert.match(panel, /F4a .* routine/);
  assert.match(panel, /OPEN Visit/);
  assert.match(panel, /idempotency/);
  assert.doesNotMatch(panel, /boApi\.(awardWaterSigil|grantFruit|executeCompanionRitual|createEgg)/);
  assert.match(api, /pinoria\/companions\/\$\{encodeURIComponent\(companionId\)\}\/feed/);
  assert.match(readHandler, /students\\\/\[0-9a-f-\]\{36\}\\\/pinoria/);
  assert.match(writeHandler, /STUDENT_COMPANION_FEED_PATH/);
});


test("School Students fails visibly when canonical scope catalog cannot load",async()=>{const view=await read("app/bo/learners/BoLearnersView.tsx");assert.match(view,/setCatalog\(\{ state: "error", message: message\(error\) \}\)/);assert.match(view,/catalog\.state === "error"/);assert.match(view,/catalog\.message/);assert.match(view,/error\.requestId/);assert.doesNotMatch(view,/scopeCatalog\(\)[\s\S]{0,220}catch\(\(\) => undefined\)/);});

test("School Student Pinoria fences Feed completion to the initiating student and request generation",async()=>{const panel=await read("app/bo/learners/StudentPinoriaPanel.tsx");assert.match(panel,/studentGeneration/);assert.match(panel,/feedGeneration/);assert.match(panel,/initiatingStudentId=studentId/);assert.match(panel,/const current=\(\)=>studentGeneration\.current===studentTicket&&feedGeneration\.current===requestTicket/);assert.match(panel,/if\(!current\(\)\)return/);assert.match(panel,/await refresh\(current\)/);});
