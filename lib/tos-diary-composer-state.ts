/** PAP-2289 · PAP-945 · Resolve TOS Diary read/write eligibility gate.
 * Keep student selection reachable before an eligible scope exists, while failing
 * closed for form entry until the selected Student's Core reads finish.
 */
export type DiaryComposerDraftPhase="idle"|"loading"|"ready"|"closed"|"error";

export type DiaryComposerLockInput={
 permitted:boolean;
 draftPhase:DiaryComposerDraftPhase;
 receiptPresent:boolean;
 busy:boolean;
 reloadBusy:boolean;
 completionBusy:boolean;
 recovering:boolean;
 closePending:boolean;
};

export function diaryDraftPhaseForScope(permitted:boolean):"idle"|"loading" {
 return permitted?"loading":"idle";
}

export function diaryComposerLocks(input:DiaryComposerLockInput):{
 studentPickerLocked:boolean;
 formLocked:boolean;
} {
 const operationLocked=input.receiptPresent||input.busy||input.reloadBusy||input.completionBusy||
  input.recovering||input.closePending;
 const selectedStudentReadLocked=input.permitted&&input.draftPhase==="loading";
 const studentPickerLocked=operationLocked||selectedStudentReadLocked;
 return {
  studentPickerLocked,
  formLocked:studentPickerLocked||!input.permitted||input.draftPhase==="closed",
 };
}
