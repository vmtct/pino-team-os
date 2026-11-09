/**
 * PAP-1756 / Epic PAP-1676 MISSION-ASSIGNMENT — headless C1 Completion adapter.
 * No Diary writer, no UI mutation, no C2 MissionResult, no automatic retry.
 * The existing Founder-approved checkbox is bound only after PAP-1429/PAP-1488
 * upstream ownership and protected gates resolve.
 */
import {TosMissionAssignmentApiError,type TosMissionAssignmentRecord} from "./tos-mission-assignment-api";
import {
  assignmentScopeForCandidate,type AssignmentV18bToday,type AssignmentV18bOccurrence,
} from "./tos-mission-assignment-workflow";
import {readTosMissionCompletion,type TosMissionExecutionRead} from "./tos-mission-completion-read";
import type {ObservationOutcome} from "./tos-diary-observation-workflow";

export type C1CompletionOutcome =
 | {state:"NOOP_UNCHECKED"}
 | {state:"VERIFIED";execution:TosMissionExecutionRead;diaryId:string}
 | {state:"UNVERIFIED";assignmentId:string;idempotencyKey:string;message:string};

export type C1CompletionInput={
 day:AssignmentV18bToday;occurrence:AssignmentV18bOccurrence;studentId:string;
 assignment:TosMissionAssignmentRecord;diaryReceipt:ObservationOutcome|null;
 checked:boolean;writeAdmitted:boolean;idempotencyKey:string;
};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keyPattern=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const fail=(code:string,message:string,status=403):never=>{
 throw new TosMissionAssignmentApiError(status,code,message);
};

function diaryProof(input:C1CompletionInput,scope:ReturnType<typeof assignmentScopeForCandidate>):string{
 const receipt=input.diaryReceipt;
 if(!receipt||receipt.state!=="LINK_VERIFIED"||!receipt.plan)
  return fail("MISSION_C1_DIARY_NOT_VERIFIED","Nhật ký và liên kết Nhiệm vụ chưa được Core xác nhận.");
 const plan=receipt.plan;
 if(!uuid.test(plan.diaryId)||plan.centerId!==scope.centerId||
    !keyPattern.test(plan.submissionKey)||
    receipt.pendingMissionIds.length!==0||
    !receipt.verifiedMissionIds.includes(input.assignment.missionId)||
    !plan.selected.some(item=>item.missionId===input.assignment.missionId&&
      item.assignmentId===input.assignment.id))
  return fail("MISSION_C1_DIARY_SCOPE_MISMATCH","Nhật ký không liên kết đúng Assignment đã giao.");
 return plan.diaryId;
}
function assertPost(value:unknown,before:TosMissionExecutionRead):boolean{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 return row.assignmentId===before.assignmentId&&row.centerId===before.centerId&&
  row.assignmentStatus==="ASSIGNED"&&row.executionStatus==="COMPLETED"&&
  row.executionVersion===before.executionVersion+1&&
  typeof row.updatedAt==="string"&&Number.isFinite(Date.parse(row.updatedAt))&&
  typeof row.updatedByUserId==="string"&&uuid.test(row.updatedByUserId);
}

/**
 * Execute exactly one deliberate checked C1 signal. The caller must persist
 * the key before network and preserve it after uncertain ACK; no generated
 * retry key and no inferred "complete" from a Diary checkbox.
 */
export async function submitVerifiedC1Completion(
 input:C1CompletionInput,
 transport:typeof fetch=(...args)=>fetch(...args),
):Promise<C1CompletionOutcome>{
 if(!input.checked)return {state:"NOOP_UNCHECKED"};
 if(!input.writeAdmitted)return fail("MISSION_C1_WRITE_NOT_ADMITTED",
   "Lệnh hoàn tất chưa được mở tại môi trường này.",503);
 const scope=assignmentScopeForCandidate(input.day,input.occurrence,input.studentId);
 if(!input.assignment||!uuid.test(input.assignment.id)||
    input.assignment.centerId!==scope.centerId||
    input.assignment.studentId!==scope.studentId||
    input.assignment.contextKey!==scope.teachingContextKey||
    input.assignment.status!=="ASSIGNED"||
    !Number.isSafeInteger(input.assignment.version)||input.assignment.version<1)
  return fail("MISSION_C1_ASSIGNMENT_SCOPE_DENIED","Assignment không thuộc lớp học hiện tại.");
 const diaryId=diaryProof(input,scope);
 if(!keyPattern.test(input.idempotencyKey))
  return fail("MISSION_C1_IDEMPOTENCY_KEY_INVALID","Thiếu mã gửi an toàn.",400);

 const before=await readTosMissionCompletion(input.day,input.occurrence,
   input.studentId,input.assignment,transport);
 if(before.executionStatus!=="IN_PROGRESS")
  return fail("MISSION_C1_ALREADY_COMPLETED","Nhiệm vụ đã được hoàn tất. Không gửi lệnh trùng.",409);
 const uncertain=():C1CompletionOutcome=>({
  state:"UNVERIFIED",assignmentId:input.assignment.id,idempotencyKey:input.idempotencyKey,
  message:"Không xác minh được biên nhận Core. Chỉ đối soát GET; không tạo khóa gửi mới.",
 });
 const url="/api/tos-learning/learning/mission-assignments/"+
   encodeURIComponent(input.assignment.id)+"/completion";
 let response:Response;
 try{
  response=await transport(url,{
   method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
   headers:{"content-type":"application/json","idempotency-key":input.idempotencyKey},
   body:JSON.stringify({...scope,completed:true,expectedVersion:before.executionVersion}),
  });
 }catch{return uncertain();}
 if(!response.ok){
  if(response.status===401||response.status===403||response.status===409){
   let errorCode="MISSION_C1_CORE_REJECTED";
   try{
    const payload=await response.json() as {error?:{code?:string}};
    if(typeof payload.error?.code==="string")errorCode=payload.error.code;
   }catch{/* preserve server HTTP status */}
   return fail(errorCode,"Core đã từ chối thao tác hoàn tất.",response.status);
  }
  return uncertain();
 }
 let data:unknown;
 try{
  const payload=await response.json() as {data?:unknown};
  data=payload?.data;
 }catch{return uncertain();}
 if(!assertPost(data,before))return uncertain();
 try{
  const after=await readTosMissionCompletion(input.day,input.occurrence,
   input.studentId,input.assignment,transport);
  if(after.executionStatus!=="COMPLETED"||
     after.executionVersion!==before.executionVersion+1||
     after.assignmentId!==before.assignmentId||after.centerId!==before.centerId)
   return uncertain();
  return {state:"VERIFIED",execution:after,diaryId};
 }catch{return uncertain();}
}
