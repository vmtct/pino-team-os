/**
 * PAP-1488 / Epic PAP-1676 MISSION-ASSIGNMENT.
 * Independent Core Assignment commands used ONLY by approved TOS Mission tab.
 * Never writes Diary, Result, Student profile or any other resource.
 * This is a staged UI integration candidate; deployment and authenticated G4
 * remain separately guarded by Founder FSG7/PAP-1195.
 */
import {tosClassroomV18bApi} from "./tos-classroom-v18b-api";
import {
  createTosMissionAssignmentApiTransport, TosMissionAssignmentApiError,
  type TosMissionAssignmentScope, type TosMissionAssignmentRecord,
} from "./tos-mission-assignment-api";
import {readTosEligibleMissions,assignmentDefinitionReadyChoices,
  type TosEligibleMissionChoice} from "./tos-mission-assignment-choices";
import {
  assignmentScopeForCandidate,loadAssignmentsInOccurrence,
  createMissionAssignment,replaceMissionAssignment,
  type AssignmentReplacement,
  type AssignmentV18bToday, type AssignmentV18bOccurrence,
} from "./tos-mission-assignment-workflow";

export type MissionCommandDeps={
  today:(centerId:string,localDate:string)=>Promise<AssignmentV18bToday>;
  eligible:(scope:TosMissionAssignmentScope)=>Promise<readonly TosEligibleMissionChoice[]>;
  assignments:ReturnType<typeof createTosMissionAssignmentApiTransport>;
};
const live:MissionCommandDeps={
  today:tosClassroomV18bApi.today,
  eligible:readTosEligibleMissions,
  // Only this explicitly scoped interactive command adapter can write.
  // The global read singleton remains fail-closed. Core independently
  // enforces Staff/TOS/Center/TEACHER/roster/CAS/idempotency for each request.
  assignments:createTosMissionAssignmentApiTransport(true),
};
const invalid=(code:string,status=409):never=>{
  throw new TosMissionAssignmentApiError(status,code,
    "Không xác minh được điều kiện giao Nhiệm Vụ; vui lòng tải lại.");
};
function findCandidate(day:AssignmentV18bToday,scope:TosMissionAssignmentScope):AssignmentV18bOccurrence{
  if(day.centerId!==scope.centerId||day.localDate!==scope.localDate||
    !Array.isArray(day.occurrences))return invalid("MISSION_COMMAND_DAY_INVALID",403);
  const rows=day.occurrences.filter(row=>row.runningClassId===scope.runningClassId&&
    row.teachingContextKey===scope.teachingContextKey);
  if(rows.length!==1)return invalid("MISSION_COMMAND_OCCURRENCE_INVALID",403);
  const occurrence=rows[0]!;
  assignmentScopeForCandidate(day,occurrence,scope.studentId);
  return occurrence;
}
async function fresh(
  scope:TosMissionAssignmentScope,api:MissionCommandDeps,
):Promise<{scope:TosMissionAssignmentScope;available:readonly TosEligibleMissionChoice[];
  active:readonly TosMissionAssignmentRecord[]}>{
  const day=await api.today(scope.centerId,scope.localDate);
  const occurrence=findCandidate(day,scope);
  const trusted=assignmentScopeForCandidate(day,occurrence,scope.studentId);
  const [choices,active]=await Promise.all([
    api.eligible(trusted),loadAssignmentsInOccurrence(api.assignments,trusted),
  ]);
  const available=assignmentDefinitionReadyChoices(choices);
  return {scope:trusted,available,active};
}
function ready(available:readonly TosEligibleMissionChoice[],missionId:string):void{
  if(!available.some(x=>x.missionId===missionId&&x.assignmentId===null))
    invalid("MISSION_COMMAND_CHOICE_UNAVAILABLE",409);
}
function verified(result:TosMissionAssignmentRecord,records:readonly TosMissionAssignmentRecord[]):void{
  const actual=records.find(x=>x.id===result.id);
  if(!actual||actual.status!=="ASSIGNED"||actual.missionId!==result.missionId||
    actual.version!==result.version)return invalid("MISSION_COMMAND_READBACK_UNVERIFIED",502);
}
export async function getTosMissionCommandChoices(
  scope:TosMissionAssignmentScope,api:MissionCommandDeps=live,
):Promise<readonly TosEligibleMissionChoice[]>{
  const checked=await fresh(scope,api);
  return checked.available.filter(x=>x.assignmentId===null);
}
/** A user click uses one unique key, never automatically replays an ambiguous POST. */
export async function createTosMissionAssignmentVerified(
  scope:TosMissionAssignmentScope,missionId:string,key:string,
  api:MissionCommandDeps=live,
):Promise<TosMissionAssignmentRecord>{
  const checked=await fresh(scope,api);
  ready(checked.available,missionId);
  if(checked.active.some(x=>x.missionId===missionId))
    return invalid("MISSION_COMMAND_ALREADY_ASSIGNED",409);
  const created=await createMissionAssignment(api.assignments,checked.scope,missionId,key);
  const actual=await loadAssignmentsInOccurrence(api.assignments,checked.scope);
  verified(created,actual);
  return created;
}
export type MissionReplaceResult=
  | {state:"verified";cancelled:TosMissionAssignmentRecord;created:TosMissionAssignmentRecord}
  | Extract<AssignmentReplacement,{state:"PENDING_CREATE"}>;
/** Do not automatically retry a partial CANCEL/CREATE. Keep the independent createKey. */
export async function replaceTosMissionAssignmentVerified(
  scope:TosMissionAssignmentScope,oldId:string,expectedVersion:number,
  nextMissionId:string,reason:string,cancelKey:string,createKey:string,
  api:MissionCommandDeps=live,
):Promise<MissionReplaceResult>{
  const checked=await fresh(scope,api);
  ready(checked.available,nextMissionId);
  const old=checked.active.find(x=>x.id===oldId);
  if(!old||old.version!==expectedVersion||!reason.trim())
    return invalid("MISSION_COMMAND_REPLACE_STALE",409);
  const result=await replaceMissionAssignment(api.assignments,checked.scope,old,
    nextMissionId,reason,cancelKey,createKey);
  if(result.state==="PENDING_CREATE")return result;
  const [active,cancelled]=await Promise.all([
    loadAssignmentsInOccurrence(api.assignments,checked.scope),
    api.assignments.get(checked.scope,oldId),
  ]);
  verified(result.created,active);
  if(cancelled.status!=="CANCELLED"||
    cancelled.version!==old.version+1||cancelled.id!==oldId)
    return invalid("MISSION_COMMAND_CANCEL_READBACK_UNVERIFIED",502);
  return {state:"verified",cancelled,created:result.created};
}
