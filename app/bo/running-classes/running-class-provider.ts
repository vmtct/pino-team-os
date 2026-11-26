/** PLT-DELIVERY / PAP-1037 / PAP-1043 / PAP-2225 — native Center-scoped provider, not yet mounted. */
import type {BoContext} from "@/lib/bo-model";
import {scopedClassesFetcher} from "../components/registration/BoScopedClassRead";
import {CLASS_TOPOLOGIES,validateClassDraft,type ClassCatalog,type ClassCreate} from "./running-class-draft";
import {CLASS_STATUSES,CLASS_EDIT_KEYS,projectClassRow,projectClassProperties,validateClassEdit,type ClassRecord,type ClassEditCommand} from "./running-class-presentation";
import {createRunningClassCommandClient} from "./running-class-command-client";
import {createRunningClassRecovery,runningClassJournalScope} from "./running-class-recovery";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(message:string):never{throw Error(message);}
function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))return fail("Invalid Running Class data.");
 return value as Record<string,unknown>;
}
function id(value:unknown):string{if(typeof value!=="string"||!uuid.test(value))return fail("Invalid canonical Running Class ID.");return value;}
function text(value:unknown):string{if(typeof value!=="string"||!value.trim())return fail("Invalid Running Class text.");return value;}
function positive(value:unknown):number{if(typeof value!=="number"||!Number.isSafeInteger(value)||value<1)return fail("Invalid Running Class number.");return value;}
const nullable=(v:unknown)=>v===null?null:positive(v);
function list<T extends {id:string}>(v:unknown,parse:(r:Record<string,unknown>)=>T):T[]{
 if(!Array.isArray(v))return fail("Invalid Running Class list.");
 const rows=v.map(r=>parse(object(r)));
 if(new Set(rows.map(r=>r.id)).size!==rows.length)return fail("Duplicate Running Class data.");
 return rows;
}
function choice<T extends string>(v:unknown,values:readonly T[]):T{
 if(typeof v!=="string"||!values.some(x=>x===v))return fail("Invalid Running Class choice.");return v as T;
}
function record(r:Record<string,unknown>,centerId:string):ClassRecord{
 const center=id(r.centerId);if(center!==centerId)return fail("Foreign Running Class Center.");
 const weekday=positive(r.weekdayIso),start=text(r.windowStartsLocal),end=text(r.windowEndsLocal);
 const time=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
 if(weekday>7||!time.test(start)||!time.test(end)||end<=start)return fail("Invalid Running Class schedule.");
 return {id:id(r.id),centerId:center,pathProgramId:id(r.pathProgramId),learningSpaceId:id(r.learningSpaceId),operationalName:text(r.operationalName),weekdayIso:weekday,windowStartsLocal:start,windowEndsLocal:end,
 deliveryTopology:choice(r.deliveryTopology,CLASS_TOPOLOGIES),optimalConcurrentCapacity:positive(r.optimalConcurrentCapacity),hardConcurrentCapacity:nullable(r.hardConcurrentCapacity),defaultParticipationMinutes:nullable(r.defaultParticipationMinutes),status:choice(r.status,CLASS_STATUSES),version:positive(r.version)};
}
type Scope=Pick<BoContext,"userId"|"surface"|"entitled"|"permissionKeys">;
type StoragePort=Pick<Storage,"getItem"|"setItem"|"removeItem">;
export function parseRunningClassBootstrap(value:unknown,centerId:string){
 id(centerId);
 const b=object(value);
 const common=(r:Record<string,unknown>)=>({id:id(r.id),status:text(r.status),displayName:text(r.displayName)});
 const centers=list(b.centers,r=>({...common(r),timeZone:text(r.timeZone)}));
 if(centers.length!==1||centers[0]?.id!==centerId)return fail("Selected Running Class Center unavailable.");
 const paths=list(b.paths,common),spaces=list(b.learningSpaces,r=>({...common(r),centerId:id(r.centerId)}));
 if(spaces.some(s=>s.centerId!==centerId))return fail("Foreign Running Class space.");
 const records=list(b.runningClasses,r=>record(r,centerId));
 if(records.some(r=>!paths.some(p=>p.id===r.pathProgramId)||!spaces.some(s=>s.id===r.learningSpaceId)))return fail("Running Class catalog reference unavailable.");
 const catalog:ClassCatalog={centers,paths,spaces};
 return {catalog,records,timeZone:centers[0].timeZone};
}
export async function openRunningClassProvider(options:{centerId:string;context:()=>Promise<Scope>;selectedCenter:()=>string;fetcher:typeof fetch;storage:StoragePort;newKey?:()=>string}){
 const centerId=id(options.centerId);
 const initial=await options.context();
 const actorId=id(initial.userId);
 let disposed=false;
 const verify=async()=>{
  if(disposed||options.selectedCenter()!==centerId)fail("Running Class scope changed.");
  const current=await options.context();
  if(disposed||options.selectedCenter()!==centerId||current.userId!==actorId||current.surface!=="BO"||current.entitled!==true||!current.permissionKeys?.includes("delivery.schedule.manage"))fail("Running Class scope denied.");
 };
 await verify();
 const guardedFetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{await verify();const headers=new Headers(init?.headers);if(init?.method==="POST"||init?.method==="PATCH")headers.set("x-pino-expected-principal",actorId);const response=await options.fetcher(input,{...init,headers});await verify();return response;}) as typeof fetch;
 const scope=await runningClassJournalScope(actorId,centerId);
 const recovery=createRunningClassRecovery({centerId,scope,storage:options.storage,verify,client:createRunningClassCommandClient(centerId,guardedFetch),newKey:options.newKey});
 let state:ReturnType<typeof parseRunningClassBootstrap>|undefined,busy=false;
 const current=()=>{if(disposed||!state||options.selectedCenter()!==centerId)return fail("Reload Running Class data.");return state;};
 const run=async<T>(fn:()=>Promise<T>):Promise<T>=>{
  if(busy||disposed)return fail("Running Class provider busy.");
  busy=true;try{await verify();return await fn();}catch(e){state=undefined;throw e;}finally{busy=false;}
 };
 async function load(){
  const response=await scopedClassesFetcher(guardedFetch,centerId)("/api/bo/delivery/bootstrap-state",{method:"GET",cache:"no-store"});
  const body=object(await response.json());
  const next=parseRunningClassBootstrap(body.data,centerId);await verify();state=next;
  return next.records.map(r=>projectClassRow(r,next.catalog));
 }
 function accept(row:ClassRecord){
  const s=current(),confirmed=record(object(row),centerId);
  if(!s.catalog.paths.some(p=>p.id===confirmed.pathProgramId)||!s.catalog.spaces.some(p=>p.id===confirmed.learningSpaceId))return fail("Running Class catalog changed.");
  s.records=[...s.records.filter(r=>r.id!==confirmed.id),confirmed];
  return projectClassRow(confirmed,s.catalog);
 }
 return {
  load:()=>run(load),
  state:()=>{const r=recovery.state();return {...r,busy:busy||r.busy,loaded:!!state&&!disposed&&options.selectedCenter()===centerId};},
  catalog:()=>structuredClone(current().catalog),
  centerToday:()=>new Intl.DateTimeFormat("sv-SE",{timeZone:current().timeZone}).format(new Date()),
  list:()=>current().records.map(r=>projectClassRow(r,current().catalog)),
  find:(recordId:string)=>{const r=current().records.find(r=>r.id===recordId);return r?{...r}:undefined;},
  properties:(recordId:string)=>{const s=current(),r=s.records.find(r=>r.id===recordId);return r?projectClassProperties(r,s.catalog):undefined;},
  create:(input:ClassCreate)=>{const command={...input};return run(async()=>{
   if(Object.keys(command).some(k=>![...CLASS_EDIT_KEYS,"centerId","deliveryTopology"].includes(k)))return fail("Invalid Running Class create fields.");
   const s=current(),validated=validateClassDraft(command,s.catalog);
   if(!validated.ok||command.centerId!==centerId||command.status!=="INACTIVE")return fail("Invalid Running Class create.");
   return accept(await recovery.create(validated.value));
  });},
  edit:(input:ClassEditCommand)=>{const command={...input,changes:{...input.changes}};return run(async()=>{
   const s=current(),original=s.records.find(r=>r.id===command.id);
   if(!original||original.version!==command.expectedVersion)return fail("Stale Running Class edit.");
   if(Object.keys(command.changes).some(k=>!CLASS_EDIT_KEYS.some(f=>f===k)))return fail("Invalid Running Class edit fields.");
   const candidate=validateClassEdit(original,{...original,...command.changes},s.catalog);
   if(!candidate.ok)return fail(candidate.message);
   if(Object.keys(command.changes).some(k=>!Object.hasOwn(candidate.command.changes,k)))return fail("Invalid Running Class edit fields.");
   return accept(await recovery.edit(original,candidate.command));
  });},
  retry:()=>run(async()=>{if(!state)await load();return accept(await recovery.retry());}),
  dispose:()=>{disposed=true;state=undefined;recovery.dispose();}
 };
}

export type RunningClassProvider=Awaited<ReturnType<typeof openRunningClassProvider>>;
