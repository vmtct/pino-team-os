import type { BoRunningClass } from "./bo-model";
/** Fail-closed projection of canonical Running Classes, not synthetic Sessions. */
export function eligibleShiftRunningClasses(classes: readonly BoRunningClass[], input: {centerId:string;workDate:string;startLocalTime:string;endLocalTime:string}): BoRunningClass[] {
  const day = new Date(input.workDate+"T00:00:00Z").getUTCDay() || 7;
  if (!input.centerId || !input.workDate || !input.startLocalTime || !input.endLocalTime) return [];
  return classes.filter((item)=>item.centerId===input.centerId && item.status.toUpperCase()==="ACTIVE" && item.recurrenceWeekdays.includes(day) && item.startLocalTime>=input.startLocalTime && item.endLocalTime<=input.endLocalTime);
}


export type IndependentRoleInput = {
  frontDesk:boolean;
  shiftLeader:boolean;
  teacherSelected:boolean;
  assistantSelected:boolean;
  teacherRunningClassIds:readonly string[];
  assistantRunningClassIds:readonly string[];
};
export type IndependentRoleCommand =
  | {roleType:"FRONT_DESK"|"SHIFT_LEADER"}
  | {roleType:"TEACHER"|"TEACHING_ASSISTANT";runningClassId:string};

/** Exactly one atomic Core operational-assignment; all 15 role subsets are legal. */
export function buildIndependentRoleCommands(input:IndependentRoleInput):IndependentRoleCommand[] {
  return [
    ...(input.frontDesk ? [{roleType:"FRONT_DESK" as const}] : []),
    ...(input.shiftLeader ? [{roleType:"SHIFT_LEADER" as const}] : []),
    ...(input.teacherSelected ? [...new Set(input.teacherRunningClassIds)].map((runningClassId)=>({roleType:"TEACHER" as const,runningClassId})) : []),
    ...(input.assistantSelected ? [...new Set(input.assistantRunningClassIds)].map((runningClassId)=>({roleType:"TEACHING_ASSISTANT" as const,runningClassId})) : []),
  ];
}
