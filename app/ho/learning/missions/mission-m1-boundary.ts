/** PAP-2394 / HO-MISSION-CRUD — isolated in-memory M1 data/command boundary only.
 * No network, browser storage, live session, real Mission IDs or Core authorization.
 * The existing HoMissionsContent + SurfaceWorkspace render every stage. */
import { TddRegistry, type AuthorizationContext, type ModuleRow } from "@/lib/workspace-schema";
import type { AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import type { AdapterLocation, AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import type { MissionBoundary } from "./HoMissionsTdd";
import type { MissionInput } from "./command";
import { emptyMission, validateMissionCreate } from "./MissionCreateFields";
import { isMissionCategory } from "./mission-category";
import { missionCategoryDefinition, missionCategoryQuery, missionInlineFields, type missionFields } from "./schema";
import { validateMissionSelectedPath, type MissionPathChoice } from "./mission-path-options";
type F = typeof missionFields;
type Draft = MissionInput & {readonly category: NonNullable<MissionInput["category"]>};
type Record = {readonly id:string; readonly version:number; readonly draft:Draft};
import {MISSION_M1_ID,MISSION_M1_READ as READ,MISSION_M1_EDIT as EDIT,hasMissionM1Permissions} from "./mission-m1-query";
export {MISSION_M1_ROUTE,MISSION_M1_ID} from "./mission-m1-query";
type Admission = Readonly<{userId:string;permissionKeys:readonly string[]}>;
const paths: readonly MissionPathChoice[]=[
 {id:"01900000-0000-7000-8000-000000000011",code:"artchitect",label:"Artchitect"},
 {id:"01900000-0000-7000-8000-000000000012",code:"pianohouse",label:"PianoHouse"},
 {id:"01900000-0000-7000-8000-000000000013",code:"little-piner-art",label:"Little Piner Art"},
 {id:"01900000-0000-7000-8000-000000000014",code:"little-piner-piano",label:"Little Piner Piano"},
];
const seed=():Record=>({id:MISSION_M1_ID,version:1,draft:{...emptyMission,code:"MISSION-MOCK-001",name:"Hướng dẫn phối màu · mẫu",category:"Staff Training",level:2,plsValue:30,pathProgramId:paths[0].id,pathKeySnapshot:paths[0].code,description:"Thực hành hướng dẫn phối màu cơ bản.",guideline:"Hướng dẫn từng bước, có minh họa."}});
function project(r:Record):ModuleRow<F>{
 const d=r.draft;
 return {id:r.id,name:d.name,code:d.code,category:d.category,level:d.level,status:d.status,plsValue:d.plsValue,
  paperSize:d.paperSize,path:paths.find(p=>p.id===d.pathProgramId)?.label??"—",prerequisite:d.prerequisiteCodeSnapshot,
  description:d.description,guideline:d.guideline,createdAt:"—",createdBy:"—",updatedAt:"—",updatedBy:"—"};
}
export function createMissionM1Boundary(initialRecord?:string,admission?:Admission):MissionBoundary{
 if(initialRecord!==undefined&&initialRecord!==MISSION_M1_ID)throw Error("Unknown Mission M1 fixture");
 if(admission&&(!admission.userId.trim()||!hasMissionM1Permissions(admission.permissionKeys)))throw Error("Mission M1 admission denied");
 const permissions=new Set(admission?.permissionKeys??[READ,EDIT]);
 let records:Record[]=[seed()], serial=1, keySerial=0;
 let loc:AdapterLocation<F>={kind:initialRecord?"detail":"table",...(initialRecord?{recordId:initialRecord}:{}),tab:"overview",query:missionCategoryQuery};
 const listeners=new Set<()=>void>();
 let focus:HTMLElement|null=null;
 const navigation:AdapterNavigation<F>={read:()=>loc,change:next=>{loc=next;listeners.forEach(fn=>fn());},subscribe:fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
  capture:()=>{focus=typeof document!=="undefined"&&document.activeElement instanceof HTMLElement?document.activeElement:null;},
  restore:()=>{if(focus?.isConnected)focus.focus({preventScroll:true});}};
 const context:AuthorizationContext=Object.freeze({surface:"HO",authorize:(key:string)=>(key===READ||key===EDIT)&&permissions.has(key)});
 const registry=new TddRegistry();
 const list=async (_query:typeof missionCategoryQuery,signal:AbortSignal)=>{signal.throwIfAborted();return {rows:records.map(project),total:records.length,versions:Object.fromEntries(records.map(r=>[r.id,String(r.version)]))};};
 const detail=async (id:string,signal:AbortSignal)=>{signal.throwIfAborted();const r=records.find(v=>v.id===id);return r?{row:project(r),version:String(r.version)}:null;};
 const schema=registry.register<F>({...missionCategoryDefinition,data:{id:"pap2394-m1-synthetic-only",list:async (q,c,s)=>{if(c!==context)throw Error("Preview context mismatch");return list(q,s);},detail:async(id,c,s)=>{if(c!==context)throw Error("Preview context mismatch");return (await detail(id,s))?.row??null;}}});
 const replace=(next:Record)=>{records=records.map(r=>r.id===next.id?next:r);};
 const adapter:AuthenticatedSurfaceAdapter<F>={
   registry,schema,scope:{surface:"HO"},userId:admission?.userId??"PAP2394_SYNTHETIC_ONLY",context,
   capabilities:{read:true,edit:true,create:false,delete:false,reveal:false,audit:false},list,detail,
   mutation:{update:async(id,patch,version,authorization,signal)=>{
    signal.throwIfAborted();
    if(authorization!==context)return {status:"denied"};
    const current=records.find(r=>r.id===id);
    if(!current||current.draft.status!=="ACTIVE")return {status:"denied"};
    if(String(current.version)!==version)return {status:"conflict"};
    const entries=Object.entries(patch);
    if(entries.length!==1)return {status:"invalid",fields:[]};
    const [key,value]=entries[0]!;
    if(!missionInlineFields.some(k=>k===key))return {status:"invalid",fields:[]};
    const invalid=()=>({status:"invalid" as const,fields:[key] as (typeof missionInlineFields)[number][]});
    let draft:Draft=current.draft;
    switch(key){
     case "name":case "code":
      if(typeof value!=="string")return invalid();
      draft={...draft,[key]:key==="code"?value.trim().toUpperCase():value.trim()};break;
     case "category":
      if(!isMissionCategory(value))return invalid();
      draft={...draft,category:value};break;
     case "level":case "plsValue":
      if(typeof value!=="number"||!Number.isSafeInteger(value))return invalid();
      draft={...draft,[key]:value};break;
     case "path":{
      const choice=paths.find(p=>p.label===value);
      if(!choice)return invalid();
      draft={...draft,pathProgramId:choice.id,pathKeySnapshot:choice.code};break;
     }
     case "description":case "guideline":
      if(value!==null&&typeof value!=="string")return invalid();
      draft={...draft,[key]:value||null};break;
     default:return invalid();
    }
    if(validateMissionCreate(draft,true)||validateMissionSelectedPath(draft,paths))return invalid();
    if(records.some(r=>r.id!==id&&r.draft.code===draft.code))return {status:"conflict"};
    const next={...current,version:current.version+1,draft};
    replace(next);return {status:"saved",row:project(next),version:String(next.version)};
   }},
   views:async()=>({unavailable:[]}),subject:id=>({type:"learning_mission",id}),history:async()=>({status:"unavailable",reason:"M1 · Chưa kết nối lịch sử thật."}),dispose:()=>{},
 };
 return {preview:true,query:missionCategoryQuery,open:async signal=>{signal.throwIfAborted();return {adapter,navigation};},
  key:prefix=>prefix+"M1-"+(++keySerial),paths:async signal=>{signal?.throwIfAborted();return paths;},
  load:async id=>{const r=records.find(v=>v.id===id);return r?{state:"ready",id:r.id,version:r.version,data:{...r.draft}}:{state:"unavailable",message:"Không tìm thấy Mission mẫu."};},
  submit:async command=>{
   const old=command.kind==="create"?null:records.find(r=>r.id===command.id);
   if(command.kind!=="create"&&(!old||old.version!==command.expectedVersion))return {state:"conflict",message:"Mission mẫu đã thay đổi."};
   if(command.kind==="archive"&&old){
    const next:Record={...old,version:old.version+1,draft:{...old.draft,status:"INACTIVE"}};
    replace(next);return {state:"verified",record:{id:next.id,code:next.draft.code,version:next.version,status:next.draft.status}};
   }
   const d=command.data;
   if(validateMissionCreate(d,true)||validateMissionSelectedPath(d,paths)||!isMissionCategory(d.category))return {state:"invalid",message:"Thông tin Mission mẫu chưa hợp lệ."};
   const code=d.code.trim().toUpperCase();
   if(records.some(r=>r.id!==old?.id&&r.draft.code===code))return {state:"conflict",message:"Mã Mission mẫu đã tồn tại."};
   const next:Record={id:old?.id??("MISSION-MOCK-"+String(++serial).padStart(3,"0")),version:(old?.version??0)+1,draft:{...d,code,name:d.name.trim(),category:d.category}};
   if(old)replace(next);else records=[...records,next];
   return {state:"verified",record:{id:next.id,code:next.draft.code,version:next.version,status:next.draft.status}};
  }
 };
}
