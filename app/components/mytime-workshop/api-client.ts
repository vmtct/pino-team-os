import {formatPinoDateTime} from "@/lib/pino-datetime";
// PAP-2164 / MT-WORKSHOP: real private facade contract, no fixtures or implicit scope.
import {isWorkshopId,type WorkshopReference} from "./reference-codec";
export type WorkshopDto={
 id:string;name:string;centerId:string;startAt:string;endAt:string;missionIds:string[];specialtyId:string|null;
 capacity:number|null;note:string|null;eventLeadStaffId:string|null;academicLeadStaffId:string|null;otherStaffIds:string[];
 facebookUrl:string|null;status:"SCHEDULED"|"CANCELLED";version:number;createdAt:string;updatedAt:string;
 createdByName:string|null;updatedByName:string|null;
 references:{center:WorkshopReference;missions:WorkshopReference[];specialty:WorkshopReference|null;eventLead:WorkshopReference|null;academicLead:WorkshopReference|null;otherStaff:WorkshopReference[]}
};
export type CoreWorkshopInput=Pick<WorkshopDto,"name"|"centerId"|"startAt"|"endAt"|"missionIds"|"specialtyId"|"capacity"|"note"|"eventLeadStaffId"|"academicLeadStaffId"|"otherStaffIds"|"facebookUrl">;
export type WorkshopScope={surface:"HO"}|{surface:"BO";centerId:string};
export type LookupKind="centers"|"missions"|"specialties"|"staff";
export class WorkshopApiError extends Error {constructor(public readonly status:number){super(status===409?"Dữ liệu đã thay đổi. Vui lòng tải lại.":status===403||status===401?"Bạn không có quyền truy cập Workshop.":status===400?"Thông tin Workshop không hợp lệ.":"Không thể kết nối Workshop.");}}
function invalid():never{throw new WorkshopApiError(502);}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))invalid();return v as Record<string,unknown>;}
function id(v:unknown):string{if(!isWorkshopId(v))invalid();return v;}
function str(v:unknown):string{if(typeof v!=="string")invalid();return v;}
function nullable(v:unknown):string|null{return v===null?null:str(v);}
function nullableId(v:unknown):string|null{return v===null?null:id(v);}
function ids(v:unknown):string[]{if(!Array.isArray(v))invalid();const out=v.map(id);if(new Set(out).size!==out.length)invalid();return out;}
function time(v:unknown){const s=str(v);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)||!Number.isFinite(Date.parse(s)))invalid();return s;}
function ref(v:unknown,expected?:string):WorkshopReference{const o=obj(v),r={id:id(o.id),label:nullable(o.label)};if(expected!==undefined&&r.id!==expected)invalid();return r;}
function optRef(v:unknown,expected:string|null){if(expected===null){if(v!==null)invalid();return null;}return ref(v,expected);}
function refs(v:unknown,expected:string[]){if(!Array.isArray(v)||v.length!==expected.length)invalid();return v.map((r,i)=>ref(r,expected[i]));}
export function parseWorkshopDto(raw:unknown,scope:WorkshopScope):WorkshopDto{
 const o=obj(raw),r=obj(o.references),centerId=id(o.centerId),missionIds=ids(o.missionIds),otherStaffIds=ids(o.otherStaffIds);
 if(scope.surface==="BO"&&centerId!==scope.centerId)invalid();
 const specialtyId=nullableId(o.specialtyId),eventLeadStaffId=nullableId(o.eventLeadStaffId),academicLeadStaffId=nullableId(o.academicLeadStaffId);
 const startAt=time(o.startAt),endAt=time(o.endAt),version=o.version,capacity=o.capacity,status=o.status;
 if(!missionIds.length||endAt<=startAt||typeof version!=="number"||!Number.isSafeInteger(version)||version<1||
  (capacity!==null&&(typeof capacity!=="number"||!Number.isSafeInteger(capacity)||capacity<1))||(status!=="SCHEDULED"&&status!=="CANCELLED"))invalid();
 return {id:id(o.id),name:str(o.name),centerId,startAt,endAt,missionIds,specialtyId,capacity,note:nullable(o.note),eventLeadStaffId,academicLeadStaffId,otherStaffIds,facebookUrl:nullable(o.facebookUrl),status,version,createdAt:time(o.createdAt),updatedAt:time(o.updatedAt),createdByName:nullable(o.createdByName),updatedByName:nullable(o.updatedByName),
  references:{center:ref(r.center,centerId),missions:refs(r.missions,missionIds),specialty:optRef(r.specialty,specialtyId),eventLead:optRef(r.eventLead,eventLeadStaffId),academicLead:optRef(r.academicLead,academicLeadStaffId),otherStaff:refs(r.otherStaff,otherStaffIds)}};
}
export function ictWorkshopInstant(value:string):string{
 // DSA datetime-local is Vietnamese wall clock, independent of browser timezone.
 const s=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)?value+":00":value;
 const t=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(s)?s+"+07:00":s;
 if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(t)||formatPinoDateTime(t)==="—")throw new WorkshopApiError(400);
 return new Date(t).toISOString();
}
export function workshopApi(scope:WorkshopScope,fetcher:typeof fetch=fetch){
 if(scope.surface==="BO"&&!isWorkshopId(scope.centerId))invalid();
 const base="/api/"+scope.surface.toLowerCase()+"/learning/mytime-workshops";
 async function request(tail:string,query:URLSearchParams,signal:AbortSignal,method="GET",body?:unknown,key?:string){
  if(scope.surface==="BO"){if(method!=="GET"||tail.startsWith("/lookup/"))throw new WorkshopApiError(403);query.set("centerId",scope.centerId);}
  let response:Response;
  try{response=await fetcher(base+tail+(query.size?"?"+query.toString():""),{method,signal,cache:"no-store",credentials:"same-origin",redirect:"error",...(body===undefined?{}:{headers:{"content-type":"application/json","idempotency-key":key??""},body:JSON.stringify(body)})});}
  catch(e){if(signal.aborted)throw e;throw new WorkshopApiError(503);}
  if(!response.ok)throw new WorkshopApiError(response.status);
  try{return obj(await response.json()).data;}catch{invalid();}
 }
 async function allRows(signal:AbortSignal){
  const out:WorkshopDto[]=[],seen=new Set<string>();let cursor:string|null=null;
  for(let page=0;page<100;page++){
   const q=new URLSearchParams({limit:"100"});if(cursor)q.set("beforeId",cursor);
   const data=obj(await request("",q,signal));
   if(data.scopeCenterId!==(scope.surface==="BO"?scope.centerId:null)||!Array.isArray(data.events))invalid();
   for(const raw of data.events){const e=parseWorkshopDto(raw,scope);if(seen.has(e.id))invalid();seen.add(e.id);out.push(e);}
   const next=nullableId(data.nextBeforeId);if(next===null)return out;if(next===cursor||!seen.has(next))invalid();cursor=next;
  }
  invalid();
 }
 async function choices(kind:LookupKind,signal:AbortSignal){
  if(scope.surface!=="HO")throw new WorkshopApiError(403);
  const out:WorkshopReference[]=[],seen=new Set<string>();
  for(let offset=0;offset<10000;offset+=100){
   const raw=await request("/lookup/"+kind,new URLSearchParams({limit:"100",offset:String(offset)}),signal);
   if(!Array.isArray(raw)||raw.length>100)invalid();
   for(const v of raw){const r=ref(v);if(seen.has(r.id))invalid();seen.add(r.id);out.push(r);}
   if(raw.length<100)return out;
  }invalid();
 }
 async function command(method:string,tail:string,body:unknown,key:string,signal:AbortSignal){
  if(scope.surface!=="HO")throw new WorkshopApiError(403);
  const data=obj(await request(tail,new URLSearchParams(),signal,method,body,key));
  const event=parseWorkshopDto(data.event,scope);
  if(typeof data.committedVersion!=="number"||!Number.isSafeInteger(data.committedVersion)||data.committedVersion<1||data.committedVersion>event.version||typeof data.replayed!=="boolean")invalid();
  return event;
 }
 return {allRows,choices,detail:async(idValue:string,signal:AbortSignal)=>parseWorkshopDto(await request("/"+id(idValue),new URLSearchParams(),signal),scope),
  create:(input:CoreWorkshopInput,key:string,signal:AbortSignal)=>command("POST","",input,key,signal),
  patch:(idValue:string,patch:Partial<CoreWorkshopInput>,version:number,key:string,signal:AbortSignal)=>command("PATCH","/"+id(idValue),{...patch,expectedVersion:version},key,signal),
  cancel:(idValue:string,version:number,key:string,signal:AbortSignal)=>command("POST","/"+id(idValue)+"/cancel",{expectedVersion:version},key,signal),
  history:(idValue:string,cursor:string|null,signal:AbortSignal)=>request("/"+id(idValue)+"/history",new URLSearchParams({limit:"50",...(cursor?{beforeId:id(cursor)}:{})}),signal)};
}
