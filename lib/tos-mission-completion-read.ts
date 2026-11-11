/**
 * PAP-1488 / Epic PAP-1676 MISSION-ASSIGNMENT.
 * Read-only, independently sourced Core Completion projection for an
 * authenticated V18b CANDIDATE + existing persisted Assignment.
 *
 * Not a TOS writer. Do NOT infer completion from Diary/Result or activate
 * the currently fail-closed Assignment writer / mutate approved prototype.
 */
import {TosMissionAssignmentApiError, tosMissionAssignmentApi, type TosMissionAssignmentRecord, type TosMissionAssignmentScope} from "./tos-mission-assignment-api";
import {tosClassroomV18bApi} from "./tos-classroom-v18b-api";
import {assignmentScopeForCandidate,loadAssignmentsInOccurrence, type AssignmentV18bOccurrence, type AssignmentV18bToday} from "./tos-mission-assignment-workflow";

export type TosMissionExecutionRead = Readonly<{
  assignmentId:string;
  centerId:string;
  assignmentStatus:"ASSIGNED"|"CANCELLED";
  executionStatus:"IN_PROGRESS"|"COMPLETED";
  executionVersion:number;
  updatedAt:string|null;
  updatedByUserId:string|null;
}>;

const canonical=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const utc=(value:unknown):value is string=>
  typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)&&
  Number.isFinite(Date.parse(value));
const fail=(code:string,message:string,status=502):never=>{
  throw new TosMissionAssignmentApiError(status,code,message);
};
function parse(
  value:unknown,centerId:string,assignmentId:string,
):TosMissionExecutionRead{
  if(!value||typeof value!=="object"||Array.isArray(value))
    return fail("MISSION_COMPLETION_READ_INVALID","Trạng thái nhiệm vụ không hợp lệ.");
  const p=value as Record<string,unknown>;
  if(p.assignmentId!==assignmentId||p.centerId!==centerId||
    p.assignmentStatus!=="ASSIGNED"||
    (p.executionStatus!=="IN_PROGRESS"&&p.executionStatus!=="COMPLETED")||
    !Number.isSafeInteger(p.executionVersion)||Number(p.executionVersion)<0||
    (p.executionVersion===0&&
      (p.executionStatus!=="IN_PROGRESS"||p.updatedAt!==null||p.updatedByUserId!==null))||
    (Number(p.executionVersion)>0&&
      (!utc(p.updatedAt)||typeof p.updatedByUserId!=="string"||
       !canonical.test(p.updatedByUserId))))
    return fail("MISSION_COMPLETION_READ_INVALID","Trạng thái nhiệm vụ không khớp nguồn Core.");
  return {
    assignmentId,centerId,assignmentStatus:"ASSIGNED",
    executionStatus:p.executionStatus,executionVersion:p.executionVersion as number,
    updatedAt:p.updatedAt as string|null,updatedByUserId:p.updatedByUserId as string|null,
  };
}

/** Never GET without real V18b roster/occurrence/Assignment proof. */
export async function readTosMissionCompletion(
  day:AssignmentV18bToday,
  occurrence:AssignmentV18bOccurrence,
  studentId:string,
  assignment:TosMissionAssignmentRecord,
  transport:typeof fetch=(...args)=>fetch(...args),
  signal:AbortSignal=new AbortController().signal,
):Promise<TosMissionExecutionRead>{
  const scope=assignmentScopeForCandidate(day,occurrence,studentId);
  if(!assignment||!canonical.test(assignment.id)||
    assignment.centerId!==scope.centerId||assignment.studentId!==scope.studentId||
    assignment.contextKey!==scope.teachingContextKey||assignment.status!=="ASSIGNED"||
    !Number.isSafeInteger(assignment.version)||assignment.version<1)
    return fail("MISSION_COMPLETION_ASSIGNMENT_SCOPE_DENIED",
      "Nhiệm vụ không thuộc học viên và lớp đang được cấp quyền.",403);
  signal.throwIfAborted();
  const query=new URLSearchParams({
    centerId:scope.centerId,studentId:scope.studentId,runningClassId:scope.runningClassId,
    localDate:scope.localDate,teachingContextKey:scope.teachingContextKey,
  });
  const url="/api/tos-learning/learning/mission-assignments/"+
    encodeURIComponent(assignment.id)+"/completion?"+query;
  let response:Response;
  try{
    response=await transport(url,{
      method:"GET",cache:"no-store",credentials:"same-origin",redirect:"error",signal,
    });
  }catch(error){
    if(signal.aborted)throw error;
    return fail("MISSION_COMPLETION_READ_UNAVAILABLE","Không đọc được trạng thái nhiệm vụ từ Core.",503);
  }
  signal.throwIfAborted();
  if(!response.ok)return fail("MISSION_COMPLETION_READ_DENIED",
    response.status===401?"Phiên làm việc đã hết hạn.":response.status===403?
    "Bạn không có quyền xem trạng thái nhiệm vụ.":"Core chưa trả trạng thái nhiệm vụ.",
    response.status);
  let body:unknown;
  try{body=await response.json()}catch{
    return fail("MISSION_COMPLETION_READ_INVALID","Core trả dữ liệu nhiệm vụ không hợp lệ.");
  }
  signal.throwIfAborted();
  if(!body||typeof body!=="object"||Array.isArray(body)||!("data" in body))
    return fail("MISSION_COMPLETION_READ_INVALID","Core thiếu trạng thái nhiệm vụ.");
  return parse((body as {data:unknown}).data,scope.centerId,assignment.id);
}


export type TosNewMissionGuard = "CLEAR" | "UNFINISHED";
export type TosNewMissionGuardDeps = {
  today: typeof tosClassroomV18bApi.today;
  assignments: typeof tosMissionAssignmentApi;
  completion: (
    day: AssignmentV18bToday, occurrence: AssignmentV18bOccurrence,
    studentId: string, assignment: TosMissionAssignmentRecord, signal: AbortSignal,
  ) => Promise<TosMissionExecutionRead>;
};
const liveNewMissionGuard: TosNewMissionGuardDeps = {
  today: tosClassroomV18bApi.today,
  assignments: tosMissionAssignmentApi,
  completion: (day,occurrence,studentId,assignment,signal) =>
    readTosMissionCompletion(day,occurrence,studentId,assignment,undefined,signal),
};

/**
 * Guard applies ONLY to new Create, not Replace.
 * A fresh Core day + CANDIDATE roster and a complete active assignment page set
 * are required before querying independent C1 status for EVERY active assignment.
 * Any error is thrown (UI shows unavailable, NEVER a catalog or false warning).
 * Only selected current occurrence is in scope; historical unrelated occurrences
 * are not claimed to have been checked.
 */
export async function readTosNewMissionGuard(
  scope: TosMissionAssignmentScope,
  deps: TosNewMissionGuardDeps=liveNewMissionGuard,
  signal: AbortSignal=new AbortController().signal,
): Promise<TosNewMissionGuard> {
  signal.throwIfAborted();
  const day=await deps.today(scope.centerId,scope.localDate);
  signal.throwIfAborted();
  if(!day||day.centerId!==scope.centerId||day.localDate!==scope.localDate||
     !Array.isArray(day.occurrences)) {
    return fail("MISSION_CREATE_GUARD_DAY_SCOPE","Chưa xác minh được lớp học.",403);
  }
  const found=day.occurrences.filter(o=>
    o.runningClassId===scope.runningClassId&&o.teachingContextKey===scope.teachingContextKey);
  if(found.length!==1) {
    return fail("MISSION_CREATE_GUARD_OCCURRENCE","Chưa xác minh được ca học.",403);
  }
  const occurrence=found[0]!;
  const trusted=assignmentScopeForCandidate(day,occurrence,scope.studentId);
  if(trusted.centerId!==scope.centerId||trusted.teachingContextKey!==scope.teachingContextKey) {
    return fail("MISSION_CREATE_GUARD_SCOPE","Chưa xác minh được học viên.",403);
  }
  const active=await loadAssignmentsInOccurrence(deps.assignments,trusted);
  signal.throwIfAborted();
  if(active.length===0)return "CLEAR";
  const statuses=await Promise.all(active.map(record=>
    deps.completion(day,occurrence,scope.studentId,record,signal)));
  signal.throwIfAborted();
  if(statuses.some(item=>item.executionStatus==="IN_PROGRESS"))return "UNFINISHED";
  if(statuses.every(item=>item.executionStatus==="COMPLETED"))return "CLEAR";
  return fail("MISSION_CREATE_GUARD_INVALID_STATE","Trạng thái nhiệm vụ chưa được xác minh.");
}
