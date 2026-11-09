import { BoApiError } from "./bo-api-error";
import { assignmentUuid } from "./bo-mission-assignments";

/** PAP-1210 / Epic PAP-1676 MISSION-ASSIGNMENT.
 * Headless BO Completion reader and narrow Manager Reopen.
 * Deliberately UNMOUNTED until authorized Staging FSG + authenticated G4.
 * This never grants BO generic Assignment Create/Edit/Cancel, nor touches Diary/Result.
 */
type ExecutionStatus = "IN_PROGRESS" | "COMPLETED";
export type BoMissionExecution = {
  assignmentId:string; centerId:string; assignmentStatus:"ASSIGNED"|"CANCELLED";
  executionStatus:ExecutionStatus; executionVersion:number;
  updatedAt:string|null; updatedByUserId:string|null;
};
export type BoMissionCompletionEvent = {
  id:string; assignmentId:string; centerId:string; version:number;
  action:"COMPLETE"|"REOPEN"; source:"TOS"|"BO";
  statusBefore:ExecutionStatus; statusAfter:ExecutionStatus;
  actorUserId:string; reason:string|null; occurredAt:string;
};
export type BoMissionReopenCommand = {
  centerId:string; assignmentId:string; expectedVersion:number;
  reason:string; idempotencyKey:string;
};
export type BoMissionReopenOutcome =
 | {state:"verified"; execution:BoMissionExecution; event:BoMissionCompletionEvent}
 | {state:"invalid"|"denied"|"conflict"|"unverified"; status?:number; message:string};

const keyPattern=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,159}$/;
const invalid=():BoApiError=>new BoApiError(502,"Phản hồi trạng thái Nhiệm vụ không hợp lệ hoặc khác Center.",null);
const item=(value:unknown):Record<string,unknown>=>{
  if(!value||typeof value!=="object"||Array.isArray(value))throw invalid();
  return value as Record<string,unknown>;
};
const time=(value:unknown):value is string=>
  typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const id=(value:unknown):value is string=>typeof value==="string"&&assignmentUuid.test(value);
const exactIds=(centerId:string,assignmentId:string)=>{
  if(!id(centerId)||!id(assignmentId))throw invalid();
};
const state=(v:unknown):v is ExecutionStatus=>v==="IN_PROGRESS"||v==="COMPLETED";
const fail=(state:Exclude<BoMissionReopenOutcome["state"],"verified">,message:string,status?:number):BoMissionReopenOutcome=>
 ({state,message,...(status===undefined?{}:{status})});

export function parseBoMissionExecution(value:unknown,centerId:string,assignmentId:string):BoMissionExecution{
  exactIds(centerId,assignmentId);
  const p=item(value);
  if(p.centerId!==centerId||p.assignmentId!==assignmentId||
    !["ASSIGNED","CANCELLED"].includes(String(p.assignmentStatus))||
    !state(p.executionStatus)||!Number.isSafeInteger(p.executionVersion)||
    Number(p.executionVersion)<0||
    (p.executionVersion===0&&(p.executionStatus!=="IN_PROGRESS"||p.updatedAt!==null||p.updatedByUserId!==null))||
    (Number(p.executionVersion)>0&&(!time(p.updatedAt)||!id(p.updatedByUserId))))throw invalid();
  return {assignmentId,centerId,assignmentStatus:p.assignmentStatus as BoMissionExecution["assignmentStatus"],
    executionStatus:p.executionStatus,executionVersion:p.executionVersion as number,
    updatedAt:p.updatedAt as string|null,updatedByUserId:p.updatedByUserId as string|null};
}
export function parseBoMissionCompletionEvent(value:unknown,centerId:string,assignmentId:string):BoMissionCompletionEvent{
  exactIds(centerId,assignmentId);
  const p=item(value);
  const complete=p.action==="COMPLETE"&&p.source==="TOS"&&
    p.statusBefore==="IN_PROGRESS"&&p.statusAfter==="COMPLETED"&&p.reason===null;
  const reopen=p.action==="REOPEN"&&p.source==="BO"&&
    p.statusBefore==="COMPLETED"&&p.statusAfter==="IN_PROGRESS"&&
    typeof p.reason==="string"&&p.reason.trim()===p.reason&&p.reason.length>=10&&p.reason.length<=500;
  if(p.centerId!==centerId||p.assignmentId!==assignmentId||
    !id(p.id)||!id(p.actorUserId)||!time(p.occurredAt)||
    !Number.isSafeInteger(p.version)||Number(p.version)<1||(!complete&&!reopen))throw invalid();
  return {id:p.id as string,assignmentId,centerId,version:p.version as number,
    action:p.action as BoMissionCompletionEvent["action"],source:p.source as BoMissionCompletionEvent["source"],
    statusBefore:p.statusBefore as ExecutionStatus,statusAfter:p.statusAfter as ExecutionStatus,
    actorUserId:p.actorUserId as string,reason:p.reason as string|null,occurredAt:p.occurredAt as string};
}
const base=(assignmentId:string)=>"/api/bo/learning/mission-assignments/"+encodeURIComponent(assignmentId);
async function read(fetcher:typeof fetch,url:string,signal:AbortSignal):Promise<unknown>{
  const response=await fetcher(url,{method:"GET",cache:"no-store",credentials:"same-origin",
    redirect:"error",signal});
  signal.throwIfAborted();
  if(!response.ok)throw new BoApiError(response.status,"Không thể đọc trạng thái Nhiệm vụ.",response.headers.get("x-request-id"));
  let envelope:unknown;try{envelope=await response.json()}catch{throw invalid()}
  signal.throwIfAborted();
  const data=item(envelope).data;
  if(data===undefined)throw invalid();
  return data;
}
export async function readBoMissionExecution(
  fetcher:typeof fetch,centerId:string,assignmentId:string,signal:AbortSignal,
):Promise<BoMissionExecution>{
  exactIds(centerId,assignmentId);
  const url=base(assignmentId)+"/execution?"+new URLSearchParams({centerId});
  return parseBoMissionExecution(await read(fetcher,url,signal),centerId,assignmentId);
}
export async function readBoMissionCompletionHistory(
  fetcher:typeof fetch,centerId:string,assignmentId:string,signal:AbortSignal,
):Promise<readonly BoMissionCompletionEvent[]>{
  exactIds(centerId,assignmentId);
  const rows:BoMissionCompletionEvent[]=[],seen=new Set<string>();
  let previousVersion:number|null=null;
  for(let offset=0;offset<=10000;offset+=100){
    const url=base(assignmentId)+"/completion-history?"+
      new URLSearchParams({centerId,limit:"100",offset:String(offset)});
    const response=await read(fetcher,url,signal);
    if(!Array.isArray(response)||response.length>100||rows.length+response.length>10000)throw invalid();
    for(const raw of response){
      const event=parseBoMissionCompletionEvent(raw,centerId,assignmentId);
      if(seen.has(event.id)||previousVersion!==null&&event.version>=previousVersion)throw invalid();
      seen.add(event.id);rows.push(event);previousVersion=event.version;
    }
    if(response.length<100)return rows;
  }
  throw invalid(); // Never present a partial History as complete.
}
export async function reopenBoMissionCompletion(
  command:BoMissionReopenCommand,fetcher:typeof fetch=fetch,signal=new AbortController().signal,
):Promise<BoMissionReopenOutcome>{
  if(!id(command.centerId)||!id(command.assignmentId)||
    !Number.isSafeInteger(command.expectedVersion)||command.expectedVersion<1||
    typeof command.reason!=="string"||command.reason.trim().length<10||
    command.reason.trim().length>500||!keyPattern.test(command.idempotencyKey))
    return fail("invalid","Center, phiên bản, lý do hoặc khóa chống trùng không hợp lệ.");
  const reason=command.reason.trim();
  let response:Response;
  try {
    response=await fetcher(base(command.assignmentId)+"/reopen",{
      method:"POST",cache:"no-store",credentials:"same-origin",redirect:"error",signal,
      headers:{"content-type":"application/json","idempotency-key":command.idempotencyKey},
      body:JSON.stringify({centerId:command.centerId,expectedVersion:command.expectedVersion,reason}),
    });
  }catch{return fail("unverified","Chưa xác minh kết quả ghi; không tự gửi lại.");}
  if([401,403,404].includes(response.status))return fail("denied","Không có quyền mở lại Nhiệm vụ.",response.status);
  if(response.status===409)return fail("conflict","Phiên bản Nhiệm vụ đã thay đổi.",409);
  if(response.status===400)return fail("invalid","Lệnh mở lại bị Core từ chối.",400);
  if(!response.ok)return fail("unverified","Chưa xác minh kết quả mở lại.",response.status);
  try {
    const body=item(await response.json()).data;
    const receipt=parseBoMissionExecution(body,command.centerId,command.assignmentId);
    if(receipt.executionStatus!=="IN_PROGRESS"||receipt.executionVersion!==command.expectedVersion+1||
      receipt.assignmentStatus!=="ASSIGNED")throw invalid();
    const execution=await readBoMissionExecution(fetcher,command.centerId,command.assignmentId,signal);
    if(execution.executionStatus!=="IN_PROGRESS"||execution.executionVersion!==receipt.executionVersion||
      execution.assignmentStatus!=="ASSIGNED")throw invalid();
    const history=await readBoMissionCompletionHistory(fetcher,command.centerId,command.assignmentId,signal);
    const event=history.find(x=>x.version===receipt.executionVersion);
    if(!event||event.action!=="REOPEN"||event.source!=="BO"||event.reason!==reason||
      event.statusBefore!=="COMPLETED"||event.statusAfter!=="IN_PROGRESS"||
      event.actorUserId!==execution.updatedByUserId||event.occurredAt!==execution.updatedAt)throw invalid();
    return {state:"verified",execution,event};
  }catch{return fail("unverified","Không xác minh được trạng thái và audit sau lệnh; không gửi lại.");}
}
