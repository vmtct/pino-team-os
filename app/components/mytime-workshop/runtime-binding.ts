// PAP-2164 / MT-WORKSHOP. Presentation tokens never become persisted IDs.
import {workshopReferenceCodec,type WorkshopReference} from "./reference-codec";
import {workshopApi,ictWorkshopInstant,WorkshopApiError,type WorkshopDto,type CoreWorkshopInput,type WorkshopScope} from "./api-client";
import type {WorkshopInput,WorkshopPort,VersionedWorkshop} from "./WorkshopWorkspace";
import type {WorkshopChoices,WorkshopFields} from "./schema";
import type {EditablePatch,HistoryResult,HistorySubject} from "@/lib/workspace-schema";
const present=(x:WorkshopReference|null):x is WorkshopReference=>x!==null;
type Api=ReturnType<typeof workshopApi>;
const commandKey=()=>globalThis.crypto.randomUUID();
export async function loadWorkshopRuntime(scope:WorkshopScope,signal:AbortSignal,fetcher:typeof fetch=fetch){
 const api=workshopApi(scope,fetcher),events=await api.allRows(signal);
 const [centers,missions,specialties,staff]=scope.surface==="HO"?await Promise.all([api.choices("centers",signal),api.choices("missions",signal),api.choices("specialties",signal),api.choices("staff",signal)]):[[],[],[],[]];
 const c=workshopReferenceCodec(centers,events.map(e=>e.references.center));
 const m=workshopReferenceCodec(missions,events.flatMap(e=>e.references.missions));
 const s=workshopReferenceCodec(specialties,events.map(e=>e.references.specialty).filter(present));
 const w=workshopReferenceCodec(staff,events.flatMap(e=>[e.references.eventLead,e.references.academicLead,...e.references.otherStaff]).filter(present));
 const choices:WorkshopChoices={centers:c.options,missions:m.options,specialties:s.options,staff:w.options};
 const current=new Map(events.map(e=>[e.id,e]));
 const row=(e:WorkshopDto):VersionedWorkshop=>({version:String(e.version),row:{id:e.id,name:e.name,center:c.display(e.centerId),startAt:e.startAt,endAt:e.endAt,missions:e.missionIds.map(m.display),specialty:e.specialtyId?s.display(e.specialtyId):null,capacity:e.capacity,status:e.status==="SCHEDULED"?"Đã lên lịch":"Đã hủy",note:e.note,eventLead:e.eventLeadStaffId?w.display(e.eventLeadStaffId):null,academicLead:e.academicLeadStaffId?w.display(e.academicLeadStaffId):null,otherStaff:e.otherStaffIds.map(w.display),facebookUrl:e.facebookUrl,createdAt:e.createdAt,createdBy:e.createdByName,updatedAt:e.updatedAt,updatedBy:e.updatedByName}});
 const remember=(e:WorkshopDto)=>{c.addHistorical([e.references.center]);m.addHistorical(e.references.missions);s.addHistorical([e.references.specialty].filter(present));w.addHistorical([e.references.eventLead,e.references.academicLead,...e.references.otherStaff].filter(present));const result=row(e);current.set(e.id,e);return result;};
 const read=async(id:string)=>remember(await api.detail(id,signal));
 const nullable=(v:string|null|undefined)=>v?.trim()||null;
 function createBody(input:WorkshopInput):CoreWorkshopInput{
  return {name:input.name,centerId:c.resolve(input.center),startAt:ictWorkshopInstant(input.startAt),endAt:ictWorkshopInstant(input.endAt),missionIds:m.resolveMany(input.missions),specialtyId:input.specialty?s.resolve(input.specialty):null,capacity:input.capacity,note:nullable(input.note),eventLeadStaffId:input.eventLead?w.resolve(input.eventLead):null,academicLeadStaffId:input.academicLead?w.resolve(input.academicLead):null,otherStaffIds:w.resolveMany(input.otherStaff),facebookUrl:nullable(input.facebookUrl)};
 }
 function patchBody(p:EditablePatch<WorkshopFields>,old:WorkshopDto):Partial<CoreWorkshopInput>{
  const result:Partial<CoreWorkshopInput>={};
  for(const key of Object.keys(p) as (keyof typeof p)[]){
   const v=p[key];
   switch(key){
    case "name":if(typeof v!=="string")throw new WorkshopApiError(400);result.name=v;break;
    case "center":if(typeof v!=="string")throw new WorkshopApiError(400);result.centerId=c.resolve(v,old.centerId);break;
    case "startAt":if(typeof v!=="string")throw new WorkshopApiError(400);result.startAt=ictWorkshopInstant(v);break;
    case "endAt":if(typeof v!=="string")throw new WorkshopApiError(400);result.endAt=ictWorkshopInstant(v);break;
    case "missions":if(!Array.isArray(v))throw new WorkshopApiError(400);result.missionIds=m.resolveMany(v as string[],old.missionIds);break;
    case "otherStaff":if(!Array.isArray(v))throw new WorkshopApiError(400);result.otherStaffIds=w.resolveMany(v as string[],old.otherStaffIds);break;
    case "specialty":result.specialtyId=v?s.resolve(String(v),old.specialtyId??undefined):null;break;
    case "eventLead":result.eventLeadStaffId=v?w.resolve(String(v),old.eventLeadStaffId??undefined):null;break;
    case "academicLead":result.academicLeadStaffId=v?w.resolve(String(v),old.academicLeadStaffId??undefined):null;break;
    case "capacity":if(v!=null&&typeof v!=="number")throw new WorkshopApiError(400);result.capacity=v??null;break;
    case "note":result.note=nullable(typeof v==="string"?v:null);break;
    case "facebookUrl":result.facebookUrl=nullable(typeof v==="string"?v:null);break;
    default:throw new WorkshopApiError(400);
   }
  }
  return result;
 }
 // Retain the same key for uncertain retry of the exact canonical command during this mounted scope.
 const pending=new Map<string,string>();
 const port:WorkshopPort|undefined=scope.surface==="HO"?{
  read,create:async(input,key)=>remember(await api.create(createBody(input),key,signal)),
  update:{update:async(id,patch,expectedVersion,context,updateSignal)=>{
   if(context.surface!=="HO"||!context.authorize("learning.mytime_workshop.ho_manage"))return {status:"denied"};
   const old=current.get(id);if(!old||String(old.version)!==expectedVersion||old.status==="CANCELLED")return {status:"conflict"};
   try{
    const body=patchBody(patch,old),fingerprint=JSON.stringify([id,old.version,body]);
    const key=pending.get(fingerprint)??commandKey();pending.set(fingerprint,key);
    const saved=remember(await api.patch(id,body,old.version,key,updateSignal));pending.delete(fingerprint);
    return {status:"saved",...saved};
   }catch(e){if(e instanceof WorkshopApiError){if(e.status===409)return {status:"conflict"};if(e.status===401||e.status===403)return {status:"denied"};if(e.status===400)return {status:"invalid",fields:Object.keys(patch) as (keyof typeof patch)[]};}throw e;}
  }},
  cancel:async(id,version)=>{const old=current.get(id);if(!old||String(old.version)!==version)throw new WorkshopApiError(409);
   const fingerprint=JSON.stringify(["cancel",id,version]),key=pending.get(fingerprint)??commandKey();pending.set(fingerprint,key);
   const saved=remember(await api.cancel(id,old.version,key,signal));pending.delete(fingerprint);return saved;}
 }:undefined;
 return {api,choices,rows:events.map(row),port,read};
}
const actions:Record<string,string>={"learning.mytime_workshop_create":"Tạo Workshop","learning.mytime_workshop_patch":"Cập nhật Workshop","learning.mytime_workshop_cancel":"Hủy Workshop"};
export async function workshopHistory(api:Api,subject:HistorySubject,cursor:string|null,signal:AbortSignal):Promise<HistoryResult>{
 if(subject.type!=="mytime_workshop")return {status:"denied"};
 try{
  const raw=await api.history(subject.id,cursor,signal) as {events?:unknown;nextBeforeId?:unknown};
  if(!Array.isArray(raw?.events)||raw.events.length>50||!(raw.nextBeforeId===null||typeof raw.nextBeforeId==="string"))throw new Error("Invalid history");
  return {status:"authorized",nextCursor:raw.nextBeforeId,events:raw.events.map((v:unknown)=>{
   const e=v as {id?:unknown;occurredAt?:unknown;action?:unknown;actorName?:unknown};
   if(typeof e.id!=="string"||typeof e.occurredAt!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||typeof e.action!=="string"||!Object.hasOwn(actions,e.action)||!(e.actorName===null||typeof e.actorName==="string"))throw new Error("Invalid history event");
   return {id:e.id,at:e.occurredAt,actor:e.actorName??"Không xác định",action:actions[e.action]!,source:"Core",outcome:"succeeded" as const,subject,redacted:true as const};
  })};
 }catch(e){if(e instanceof WorkshopApiError&&(e.status===401||e.status===403||e.status===404))return {status:"denied"};if(signal.aborted)throw e;return {status:"unavailable",reason:"Không thể đọc lịch sử Workshop từ Core."};}
}
