import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {diaryComposerLocks,diaryDraftPhaseForScope,type DiaryComposerLockInput} from "./tos-diary-composer-state";

const clear:Omit<DiaryComposerLockInput,"permitted"|"draftPhase">={
 receiptPresent:false,busy:false,reloadBusy:false,completionBusy:false,recovering:false,closePending:false,
};

test("PAP-2289 · PAP-945 · empty Student scope never traps the picker in stale loading",()=>{
 assert.equal(diaryDraftPhaseForScope(false),"idle");
 const locks=diaryComposerLocks({...clear,permitted:false,draftPhase:"loading"});
 assert.equal(locks.studentPickerLocked,false);
 assert.equal(locks.formLocked,true);
});

test("PAP-2289 · PAP-945 · eligible Student stays locked while its Core draft read is pending",()=>{
 assert.equal(diaryDraftPhaseForScope(true),"loading");
 const locks=diaryComposerLocks({...clear,permitted:true,draftPhase:"loading"});
 assert.equal(locks.studentPickerLocked,true);
 assert.equal(locks.formLocked,true);
});

test("PAP-2289 · PAP-945 · completed eligible read enables picker and form",()=>{
 const locks=diaryComposerLocks({...clear,permitted:true,draftPhase:"ready"});
 assert.equal(locks.studentPickerLocked,false);
 assert.equal(locks.formLocked,false);
});

test("PAP-2289 · PAP-945 · operation and close locks still fail closed",()=>{
 for(const patch of [{receiptPresent:true},{busy:true},{reloadBusy:true},{completionBusy:true},{recovering:true},{closePending:true}]) {
  const locks=diaryComposerLocks({...clear,...patch,permitted:true,draftPhase:"ready"});
  assert.equal(locks.studentPickerLocked,true);
  assert.equal(locks.formLocked,true);
 }
 const closed=diaryComposerLocks({...clear,permitted:true,draftPhase:"closed"});
 assert.equal(closed.studentPickerLocked,false);
 assert.equal(closed.formLocked,true);
});

test("PAP-2289 · PAP-945 · mounted TOS Diary panel uses the guarded scope and lock state",()=>{
 const source=readFileSync(resolve(process.cwd(),"app/components/tos-vnext/DiaryCapturePanel.tsx"),"utf8");
 assert.match(source,/diaryComposerLocks\(\{/);
 assert.match(source,/diaryDraftPhaseForScope\(permitted\)/);
 assert.match(source,/disabled=\{locked\} onChange=\{e=>onStudent\(e\.target\.value\)\}/);
 assert.match(source,/disabled=\{formLocked\}/);
});
