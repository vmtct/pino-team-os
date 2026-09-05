import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path:string)=>readFile(path,"utf8");

test("School Students uses descending keyset canonical reads and no review snapshot",async()=>{const [view,api]=await Promise.all([read("app/bo/learners/BoLearnersView.tsx"),read("lib/bo-api.ts")]);assert.match(view,/collectPagedDirectory/);assert.match(view,/boApi\.learners\("", limit, beforeStudentId\)/);assert.match(view,/boApi\.learnerLifecycle/);assert.doesNotMatch(view,/student-snapshot|Production D1 snapshot|school-students-review/);assert.match(api,/beforeStudentId=/);assert.doesNotMatch(api,/offset=/);});

test("School Students is read-only and links to independently governed owner surfaces",async()=>{const view=await read("app/bo/learners/BoLearnersView.tsx");for(const command of ["createSubscription","renewSubscription","cancelSubscription","placeEnrollment","endEnrollment","transferEnrollment","resetParentPin","replayContext"])assert.doesNotMatch(view,new RegExp(`boApi\.${command}|${command}`));assert.match(view,/href="\/bo\/running-classes"/);assert.match(view,/Read-only/);});

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
