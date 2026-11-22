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
 const submit=file.slice(file.indexOf("async function submitDiary(){"),file.indexOf("async function retryClose(){"));
 const close=submit.indexOf("const outcome=await resumeDiaryClose(writerApi,plan)");
 const closeGate=submit.indexOf('if(outcome.state==="CLOSED_VERIFIED"&&outcome.diary)');
 const c1=submit.indexOf("await runC1AfterClose(outcome.plan)",closeGate);
 assert.ok(close>=0&&close<closeGate&&closeGate<c1,"C1 follows verified Diary close");

 const completion=file.slice(file.indexOf("async function runC1AfterClose(plan"),file.indexOf("async function submitDiary(){"));
 const linkRead=completion.indexOf("await resumeDiaryMissionLinks(writerApi,");
 const linkGate=completion.indexOf('if(diaryReceipt.state!=="LINK_VERIFIED")');
 const assignmentMatch=completion.indexOf("if(!selected?.assignmentId||latest?.assignmentId!==selected.assignmentId||");
 const assignmentRead=completion.indexOf("const assignment=await assignments.get(scope,selected.assignmentId)");
 const assignmentGate=completion.indexOf('if(assignment.missionId!==missionId||assignment.status!=="ASSIGNED")');
 const command=completion.indexOf("const result=await submitVerifiedC1Completion({");
 assert.ok(linkRead>=0&&linkRead<linkGate&&linkGate<assignmentMatch&&assignmentMatch<assignmentRead&&
  assignmentRead<assignmentGate&&assignmentGate<command,"C1 requires verified Diary link and matching live Assignment");
 assert.match(completion,/if\(!completionIntent\.length\)return;/);
 assert.match(completion,/const selected=plan\.selected\.find\(item=>item\.missionId===missionId\)/);
 assert.match(completion,/const latest=fresh\.items\.find\(item=>item\.missionId===missionId\)/);
 assert.match(completion,/!selected\?\.assignmentId\|\|latest\?\.assignmentId!==selected\.assignmentId\|\|/);
 assert.match(completion,/completionStatus\[missionId\]!=="IN_PROGRESS"/);
 assert.match(completion,/assignment\.missionId!==missionId\|\|assignment\.status!=="ASSIGNED"/);
 assert.ok(completion.includes('idempotencyKey:"pap1756:"+plan.closeKey+":"+assignment.id'));
 assert.match(completion,/result\.state==="VERIFIED"/);
});

test("PAP-1756 preserves the PAP-945 writer path and fail-closed host gate",()=>{
 assert.match(file,/isDiaryStagingWriterHost/);
 assert.match(file,/const writeAdmitted=stagingHostAdmitted&&skipEntryConfirmed/);
 assert.match(file,/stageDiaryTicket\(/);
 assert.match(file,/beginDiaryDraftWithLinks\(writerApi,/);
 assert.match(file,/resumeDiaryPartialDraft\(writerApi,plan\)/);
 assert.match(file,/resumeDiaryClose\(writerApi,plan\)/);
 assert.match(file,/resumeDiaryMissionLinks\(writerApi,/);
 assert.match(file,/diaryWriteView/);
 assert.match(file,/prepareSpecialtyDiarySubmission/);
 assert.match(file,/availableIds.has\(item.missionId\)/);
 assert.match(file,/TosSpecialtyMissionChoiceList/);
 assert.doesNotMatch(file,/(createMissionResult|saveMissionResult|postMissionResult)\(/);
});
