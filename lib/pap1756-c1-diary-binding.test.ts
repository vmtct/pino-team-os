/** PAP-1756 / Epic PAP-1676 — regression guards for the Founder-approved Diary C1 checkbox, no duplicate writer. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const file=readFileSync(join(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");

test("PAP-1756 retains the exact existing TOS checkbox, wired to independent C1",()=>{
 assert.match(file,/Nhiệm vụ hoàn tất/);
 assert.match(file,/setCompletionIntent/);
 assert.match(file,/submitVerifiedC1Completion\(/);
 assert.match(file,/readTosMissionCompletion\(/);
 assert.match(file,/completionStatus\[m\.missionId\]==="VERIFIED"/);
 assert.doesNotMatch(file,/checked=\{false\}\s+disabled\s+readOnly/);
});

test("PAP-1756 must not write C1 until independent Diary and Assignment linkage verified",()=>{
 const read=file.indexOf("const outcome=await createDiaryObservationWithLinks");
 const gate=file.indexOf('if(outcome.state==="LINK_VERIFIED"&&completionIntent.length)');
 const command=file.indexOf("const result=await submitVerifiedC1Completion",gate);
 assert.ok(read>=0&&read<gate&&gate<command);
 assert.match(file,/prepared\.selected\.some\(item=>item\.missionId===missionId&&item\.assignmentId===latest\.assignmentId\)/);
 assert.match(file,/completionStatus\[missionId\]!=="IN_PROGRESS"/);
 assert.match(file,/assignment\.missionId!==missionId/);
 assert.match(file,/const idempotencyKey="pap1756:"\+prepared\.submissionKey\+":"\+assignment\.id/);
 assert.match(file,/result\.state==="VERIFIED"/);
});

test("PAP-1756 preserves PAP-945/PAP-1429 source writer and fail-closed host gate",()=>{
 assert.match(file,/isDiaryStagingWriterHost/);
 assert.match(file,/const writeAdmitted=stagingHostAdmitted&&skipEntryConfirmed/);
 assert.match(file,/stageDiaryTicket\(/);
 assert.match(file,/createDiaryObservationWithLinks/);
 assert.match(file,/resumeDiaryMissionLinks/);
 assert.match(file,/diaryWriteView/);
 assert.match(file,/requiresSpecialtySelectionGuard/);
 assert.match(file,/TosSpecialtyMissionChoiceList/);
 assert.doesNotMatch(file,/(createMissionResult|saveMissionResult|postMissionResult)\(/);
});
