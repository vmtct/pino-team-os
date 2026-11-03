/** PAP-1400 / platform Epic PAP-938, business Epic PAP-727.
 * Founder 2026-11-03: TOS Diary may use explicit "Vào lớp không mở ca".
 * This is an entry-mode check, NOT Core authorization or a class-opening record.
 * Server must still authorize Staff, Center, student roster and Mission.
 */
import type {ClassroomV4ViewModel,ScheduledClass} from "./tos-classroom-v4-view-model";

export function isConfirmedSkipDiaryEntry(
 model:ClassroomV4ViewModel,classroom:ScheduledClass,confirmedClassId:string,
):boolean{
 if(!confirmedClassId||confirmedClassId!==classroom.id||!model?.centerId||
  !model?.today||classroom.id!==classroom.runningClassId+":"+model.today)return false;
 const actual=model.classes.find(c=>c.id===classroom.id);
 if(!actual||actual.runningClassId!==classroom.runningClassId||
  !model.data.participants[classroom.id]||!Array.isArray(actual.eligibleStudentIds)||
  actual.eligibleStudentIds.length===0)return false;
 return actual.eligibleStudentIds.every(id=>model.data.participants[classroom.id].includes(id)&&
  model.data.students.some(s=>s.id===id)&&!model.conflictStudentIds.includes(id));
}
