/** PAP-945 / PAP-727 — fail-closed *client* preflight, never an authorization boundary.
 * All source permissions, roster membership and Mission links are rechecked by Core.
 * The output feeds createDiaryWithMissionLinks; it never permits a legacy Diary child/result writer.
 */
import {V18bCoreError,type V18bEligibleMissionsRead,type createV18bApiTransport} from "./tos-classroom-v18b-api";
import {validateMissionLinkChoices,type MissionChoice} from "./tos-diary-mission-link-workflow";
import type {ClassroomV4ViewModel,ScheduledClass} from "./tos-classroom-v4-view-model";

type Registration=Parameters<ReturnType<typeof createV18bApiTransport>["register"]>[0];
export type DiarySubmissionInput={
 model:ClassroomV4ViewModel;classroom:ScheduledClass;studentId:string;
 eligibility:V18bEligibleMissionsRead|null;selected:readonly MissionChoice[];submissionKey:string;
};
export type PreparedDiarySubmission={
 registration:Registration;selected:MissionChoice[];eligibleMissionIds:string[];submissionKey:string;
};
const scopeError=()=>new V18bCoreError(409,"DIARY_SCOPE_MISMATCH","Center, lớp, ngày học hoặc danh sách Mission đã thay đổi. Tải lại trước khi ghi.");
const rosterError=()=>new V18bCoreError(403,"DIARY_ROSTER_NOT_ELIGIBLE","Học viên không thuộc roster hợp lệ của lớp hoặc có xung đột.");
const assignmentError=()=>new V18bCoreError(409,"DIARY_ASSIGNMENT_MISMATCH","Assignment đã thay đổi. Tải lại Nhiệm vụ trước khi ghi.");
const nonEmpty=(v:unknown)=>typeof v==="string"&&v.trim().length>0;

/** Prepare an immutable, scoped input for the existing resumable Diary->Mission-link coordinator.
 * Does not call network and cannot bypass V18B_WRITE_ADMITTED. A submitted form must re-read
 * eligibility and retain the stable submissionKey across retry/reload; never generate keys here.
 */
export function prepareDiarySubmission(input:DiarySubmissionInput):PreparedDiarySubmission {
 const {model,classroom,studentId,eligibility,selected}=input;
 const actual=model?.classes?.find(c=>c.id===classroom?.id);
 if(!nonEmpty(model?.centerId)||!nonEmpty(model?.today)||!nonEmpty(classroom?.id)||
    !nonEmpty(classroom?.runningClassId)||
    classroom.id!==classroom.runningClassId+":"+model.today||
    !actual||actual.runningClassId!==classroom.runningClassId||
    !Array.isArray(classroom.eligibleStudentIds)||
    !Array.isArray(actual.eligibleStudentIds)||
    classroom.eligibleStudentIds.length!==actual.eligibleStudentIds.length||
    classroom.eligibleStudentIds.some(id=>!actual.eligibleStudentIds.includes(id)))
  throw scopeError();
 if(!nonEmpty(studentId)||!classroom.eligibleStudentIds.includes(studentId)||
    !model.data.participants[classroom.id]?.includes(studentId)||
    !model.data.students.some(s=>s.id===studentId)||
    model.conflictStudentIds.includes(studentId))
  throw rosterError();
 if(!eligibility)throw new V18bCoreError(503,"DIARY_MISSION_CATALOG_UNAVAILABLE","Chưa tải Nhiệm vụ hợp lệ từ Core.");
 if(eligibility.centerId!==model.centerId||
    eligibility.runningClassId!==classroom.runningClassId||
    eligibility.studentId!==studentId||
    eligibility.localDate!==model.today||
    eligibility.teachingContextKey!==classroom.id||
    !nonEmpty(eligibility.pathProgramId)||
    !Array.isArray(eligibility.items))
  throw scopeError();
 if(!nonEmpty(input.submissionKey)||input.submissionKey.trim().length>160)
  throw new V18bCoreError(400,"DIARY_SUBMISSION_KEY_INVALID","Thiếu mã gửi Nhật ký ổn định.");
 const eligibleMissionIds=eligibility.items.map(m=>m.missionId);
 const safeSelected=validateMissionLinkChoices(selected,eligibleMissionIds);
 for(const choice of safeSelected){
  const found=eligibility.items.find(m=>m.missionId===choice.missionId);
  if(!found||found.assignmentId!==(choice.assignmentId??null))throw assignmentError();
 }
 return {
  registration:{centerId:model.centerId,runningClassId:classroom.runningClassId,
   studentId,pathKey:eligibility.pathProgramId,teachingContextKey:classroom.id},
  selected:safeSelected,eligibleMissionIds,submissionKey:input.submissionKey.trim(),
 };
}
