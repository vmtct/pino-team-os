/** PAP-2147 / MT-GUEST — native BO scoped Core projection. No fixture/network fallback. */
import {BoApiError} from "@/lib/bo-api-error";
import {readData} from "@/lib/workspace-adapters/providers";
import type {SurfaceProvider,SurfaceScope,ProviderRecord} from "@/lib/workspace-adapters";
import type {ModuleRow} from "@/lib/workspace-schema";
import type {GuestFields} from "./schema";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BASE="identity/mytime-guests";
const READ="identity.mytime_guest.view",EDIT="identity.mytime_guest.edit";
const keys=["name","gender","phone","birthDate","email","note"] as const;
type Json=Record<string,unknown>;
type Row=ModuleRow<GuestFields>;
type SavedRow=Row&{mutationCenterId:string};
function failure(status=502):never{throw new BoApiError(status,"Dữ liệu Khách MyTime hoặc phạm vi cơ sở không hợp lệ.",null);}
function object(v:unknown):Json{if(!v||typeof v!=="object"||Array.isArray(v))return failure();return v as Json;}
function center(scope:SurfaceScope){if(scope.surface!=="BO"||!UUID.test(scope.centerId))return failure(403);return scope.centerId;}
function uid(v:unknown):string{if(typeof v!=="string"||!UUID.test(v))return failure();return v;}
function text(v:unknown):string|null{if(v===null||typeof v==="string")return v;return failure();}
function stamp(v:unknown):string{if(typeof v!=="string"||!Number.isFinite(Date.parse(v)))return failure();return v;}
function url(centerId:string,id?:string,history=false){return BASE+(id?"/"+uid(id):"")+(history?"/history":"")+"?"+new URLSearchParams({centerId});}
export function mapGuest(value:unknown,centerId:string):ProviderRecord<GuestFields>{
 const v=object(value),id=uid(v.id);uid(v.personId);
 if(v.centerId!==centerId)return failure(403);
 if(typeof v.centerName!=="string"||!v.centerName.trim()||!Number.isSafeInteger(v.version)||Number(v.version)<1)return failure();
 if(v.gender!==null&&v.gender!=="MALE"&&v.gender!=="FEMALE")return failure();
 const birthDate=text(v.birthDate);if(birthDate!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))return failure();
 const row:Row={id,name:text(v.name),gender:v.gender==="MALE"?"Nam":v.gender==="FEMALE"?"Nữ":null,phone:text(v.phone),birthDate,email:text(v.email),note:text(v.note),center:v.centerName,createdAt:stamp(v.createdAt),createdBy:text(v.createdBy),updatedAt:stamp(v.updatedAt),updatedBy:text(v.updatedBy)};
 return {row,centerId,version:String(v.version)};
}
function encodeFields(input:Json):Json{
 if(!Object.keys(input).length||Object.keys(input).some(k=>!keys.includes(k as typeof keys[number])))return failure(400);
 const v:Json={};
 for(const k of keys){if(!Object.hasOwn(input,k))continue;const raw=input[k];if(raw!==null&&typeof raw!=="string")return failure(400);const str=typeof raw==="string"?raw.trim():null;
  if(k==="gender"){if(str!=="Nam"&&str!=="Nữ"&&str!==null&&str!=="")return failure(400);v[k]=str==="Nam"?"MALE":str==="Nữ"?"FEMALE":null;}else v[k]=str||null;}
 return v;
}
async function command(fetcher:typeof fetch,path:string,method:"POST"|"PATCH",body:Json,key:string,signal:AbortSignal){
 const response=await fetcher("/api/bo/"+path,{method,credentials:"same-origin",cache:"no-store",redirect:"error",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body),signal});
 if(!response.ok)throw new BoApiError(response.status,"Không thể lưu khách.",response.headers.get("x-request-id"),response.status>=400&&response.status<500);
 const envelope=object(await response.json());signal.throwIfAborted();return object(envelope.data);
}
export async function createGuest(centerId:string,input:Json,key:string,fetcher:typeof fetch,signal:AbortSignal){
 uid(centerId);const body=encodeFields(input);
 if(!body.name||!body.gender||!body.phone||!key.trim())return failure(400);
 const result=await command(fetcher,url(centerId),"POST",body,key,signal);
 if(result.committedVersion!==1||typeof result.replayed!=="boolean")return failure();
 const row=mapGuest(result.guest,centerId);
 return {row:row.row,version:row.version!};
}
export function guestProvider():SurfaceProvider<GuestFields>{
 // Keep an ambiguous command's key for the same scoped request; never issue fresh key on transport retry.
 const attempts=new Map<string,string>();
 return {
  pagination:"local-ui",
  list:async(_query,scope,fetcher,signal)=>{
   const c=center(scope),records:ProviderRecord<GuestFields>[]=[],seen=new Set<string>();let before:string|null=null;
   for(let page=0;page<100;page++){
    const data=object(await readData(fetcher,url(c)+"&limit=100"+(before?"&beforeId="+encodeURIComponent(before):""),signal));
    if(data.scopeCenterId!==c)return failure(403);
    if(!Array.isArray(data.guests)||data.guests.length>100)return failure();
    for(const raw of data.guests){const record=mapGuest(raw,c);if(seen.has(record.row.id))return failure();seen.add(record.row.id);records.push(record);}
    if(data.nextBeforeId===null)return {records,total:records.length};
    const next=uid(data.nextBeforeId);if(data.guests.length!==100||next!==records.at(-1)?.row.id||(before&&next>=before))return failure();before=next;
   }return failure();
  },
  detail:async(id,scope,fetcher,signal)=>{const c=center(scope);try{const row=mapGuest(await readData(fetcher,url(c,id),signal),c);if(row.row.id!==id)return failure();return row;}catch(e){if(e instanceof BoApiError&&e.status===404)return null;throw e;}},
  mutationCenter:row=>(row as SavedRow).mutationCenterId??"",
  mutation:(fetcher,scope)=>({update:async(id,patch,version,context,signal)=>{
   if(!context.authorize(READ)||!context.authorize(EDIT))return {status:"denied"};
   const c=center(scope),expectedVersion=Number(version);
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1||String(expectedVersion)!==version)return {status:"conflict"};
   const body={...encodeFields(patch),expectedVersion},fingerprint=JSON.stringify([c,id,body]);
   const key=attempts.get(fingerprint)??crypto.randomUUID();attempts.set(fingerprint,key);
   try{
    const result=await command(fetcher,url(c,id),"PATCH",body,key,signal);
    const mapped=mapGuest(result.guest,c);
    if(mapped.row.id!==id||result.committedVersion!==expectedVersion+1||mapped.version!==String(expectedVersion+1))return {status:"conflict"};
    attempts.delete(fingerprint);
    return {status:"saved",row:{...mapped.row,mutationCenterId:c},version:mapped.version};
   }catch(e){
    if(e instanceof BoApiError&&e.structuredResponse){
     attempts.delete(fingerprint);
     if(e.status===409)return {status:"conflict"};
     if(e.status===401||e.status===403)return {status:"denied"};
     if(e.status===400||e.status===422)return {status:"invalid",fields:keys.filter(k=>Object.hasOwn(patch,k))};
    }throw e;
   }
  }}),
  history:{subjectType:"mytime_guest",bind:(fetcher,scope)=>({kind:"provider",source:{adapter:"bo-mytime-guest-history",permission:"access.audit.view"},load:async(subject,context,cursor,signal)=>{
   if(subject.type!=="mytime_guest"||cursor!==null||!context.authorize(READ)||!context.authorize("access.audit.view"))return {status:"denied"};
   const c=center(scope);
   try{const data=object(await readData(fetcher,url(c,subject.id,true),signal));if(data.scopeCenterId!==c)return failure(403);if(!Array.isArray(data.events)||data.events.length>100)return failure();
    const events=data.events.map(raw=>{const v=object(raw),action=text(v.action);if(!action||!["identity.mytime_guest_created","identity.mytime_guest_updated"].includes(action))return failure();return {id:uid(v.id),at:stamp(v.occurredAt),actor:text(v.actorName)??"—",action,outcome:"succeeded" as const,source:"Core",subject,redacted:true as const};});
    if(new Set(events.map(e=>e.id)).size!==events.length)return failure();return {status:"authorized",events,nextCursor:null};
   }catch(e){if(e instanceof BoApiError&&[401,403].includes(e.status))return {status:"denied"};throw e;}
  }})}
 };
}
