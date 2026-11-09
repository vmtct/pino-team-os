/** PAP-1732 / PAP-1491 SPEC-UNLOCK S1L-A — strict redacted Specialty History client.
 * No faux audit, no raw event payloads or actor IDs pass the UI boundary.
 */
import {BoApiError} from "./bo-api-error";
import type {HistoryResult,HistorySubject} from "./workspace-schema";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const labels=new Set(["Tạo chuyên đề","Cập nhật chuyên đề","Cập nhật tổng quan",
 "Gắn nhiệm vụ","Gỡ nhiệm vụ","Xuất bản","Chuyển về bản nháp","Lưu trữ","Khôi phục"]);
const keys=new Set(["id","occurredAt","action","outcome","actorId","actorLabel",
 "before","after","description","redacted"]);
const isObj=(x:unknown):x is Record<string,unknown>=>Boolean(x&&typeof x==="object"&&!Array.isArray(x));
const invalid=()=>new BoApiError(502,"Lịch sử Chuyên đề từ Core không đúng hợp đồng bảo mật.",null);
const cursorValid=(s:string)=>/^[1-9][0-9]*$/.test(s)&&Number.isSafeInteger(Number(s));
export function projectSpecialtyHistoryPage(raw:unknown,subject:HistorySubject):HistoryResult{
 if(subject.type!=="learning_specialty_v2"||!uuid.test(subject.id)||!isObj(raw)||
    Object.keys(raw).some(k=>!["events","nextCursor"].includes(k))||Object.keys(raw).length!==2||
    !Array.isArray(raw.events)||raw.events.length>50||
    !(raw.nextCursor===null||(typeof raw.nextCursor==="string"&&cursorValid(raw.nextCursor))))
  throw invalid();
 const ids=new Set<string>();let previous:string|null=null;
 const events=raw.events.map((row:unknown)=>{
  if(!isObj(row)||Object.keys(row).length!==keys.size||
    Object.keys(row).some(k=>!keys.has(k))||
    typeof row.id!=="string"||!uuid.test(row.id)||ids.has(row.id)||
    typeof row.occurredAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(row.occurredAt)||
    !Number.isFinite(Date.parse(row.occurredAt))||
    typeof row.action!=="string"||!labels.has(row.action)||row.outcome!=="succeeded"||
    row.redacted!==true||row.actorId!==null||row.actorLabel!==null||
    row.before!==null||row.after!==null||row.description!==null)throw invalid();
  if(previous!==null&&row.occurredAt>previous)throw invalid();
  previous=row.occurredAt;ids.add(row.id);
  return {id:row.id,at:row.occurredAt,action:row.action,outcome:"succeeded" as const,
   actor:"Đã ẩn",source:"Core",subject:{type:subject.type,id:subject.id},redacted:true as const};
 });
 return {status:"authorized",events,nextCursor:raw.nextCursor as string|null};
}
export async function readSpecialtyHistory(fetcher:typeof fetch,subject:HistorySubject,
 cursor:string|null,signal:AbortSignal):Promise<HistoryResult>{
 if(subject.type!=="learning_specialty_v2"||!uuid.test(subject.id)||
    (cursor!==null&&!cursorValid(cursor)))throw invalid();
 const url="/api/ho/learning/specialties/"+encodeURIComponent(subject.id)+"/history?"+
  new URLSearchParams({limit:"20",...(cursor?{beforeVersion:cursor}:{})});
 const response=await fetcher(url,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!response.ok)throw new BoApiError(response.status,
  "Không đọc được lịch sử Chuyên đề từ Core.",response.headers.get("x-request-id"));
 const body:unknown=await response.json().catch(()=>null);
 signal.throwIfAborted();
 if(!isObj(body)||Object.keys(body).length!==1||!Object.hasOwn(body,"data"))
  throw invalid();
 return projectSpecialtyHistoryPage(body.data,subject);
}
