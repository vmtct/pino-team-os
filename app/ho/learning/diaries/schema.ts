/** PAP-1221 / Epic PAP-727: HO GLOBAL read-only Diary typed TDD.
 * All durable data is read from Core Founder GLOBAL; no fallback to BO Center list.
 */
import {TddRegistry,type FieldSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
import type {SurfaceDefinition,SurfaceProvider} from "@/lib/workspace-adapters/contracts";

const PERMISSION="team.bo.access"; // Only UI shell admission; Core independently checks learning.diary.global.view.
const READ={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const hoDiaryFields=[
 {key:"student",label:"Học viên",type:"text",icon:"Aa",width:225,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"mission",label:"Nhiệm vụ",type:"text",icon:"▣",width:240,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"center",label:"Center",type:"text",icon:"⌖",width:270,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"className",label:"Lớp / bối cảnh",type:"text",icon:"▣",width:240,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"date",label:"Ngày học",type:"text",icon:"⌁",width:140,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"submitter",label:"Người Submit",type:"text",icon:"Aa",width:235,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"diaryCode",label:"Diary ID",type:"text",icon:"#",width:300,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"notes",label:"Ghi chú",type:"textarea",icon:"Aa",width:340,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"interest",label:"Hứng thú (1–4)",type:"text",icon:"#",width:150,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"difficulty",label:"Khó khăn",type:"text",icon:"Aa",width:300,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"updatedAt",label:"Cập nhật lúc",type:"text",icon:"⌁",width:225,permission:PERMISSION,readOnly:true,capabilities:READ},
 {key:"missionCompleted",label:"Nhiệm vụ hoàn tất",type:"text",icon:"◉",width:170,permission:PERMISSION,readOnly:true,capabilities:READ},
] as const satisfies readonly FieldSchema[];
type F=typeof hoDiaryFields;
const identity={id:"identity",label:"Thông tin",fields:["student","mission","center","className","date","submitter","status","diaryCode"]} as const;
const observation={id:"observation",label:"Quan sát",fields:["notes","interest","difficulty","missionCompleted","updatedAt"]} as const;
export const hoDiaryQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"date",direction:"desc"},group:null,
 order:["student","mission","center","className","date","submitter","status","diaryCode","notes","interest","difficulty","updatedAt","missionCompleted"],
 visible:["student","mission","center","className","date","submitter","status","diaryCode"],
 page:1,pageSize:15,
};
export const hoDiaryDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"classroomDiaries",label:"Nhật ký lớp học",group:"School",
 fields:hoDiaryFields,capabilities:{read:PERMISSION},
 table:{
  identity:{field:"student",pinned:"left",hideable:false,reorderable:false},
  columns:hoDiaryQuery.order.map(field=>({field,visible:hoDiaryQuery.visible.includes(field)})),
  search:{fields:["student","mission","center","submitter","className","notes","diaryCode"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status","date","center","submitter"],mode:"flat",logic:"AND"},
  sort:{fields:["date","student","status"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["center","status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections:[identity,observation],actions:[]},
 detail:{overview:{sections:[identity,observation]},businessTabs:[],
  history:{kind:"unavailable",reason:"Core chưa cung cấp nguồn audit Diary GLOBAL có quyền; không tạo lịch sử giả."}},
} as const satisfies SurfaceDefinition<F>;
export type HoDiaryRow=ModuleRow<F>;
export type CoreHoDiary={
 id:string;centerId:string;studentId:string;teachingContextKey:string;pathKey:string;runningClassId:string|null;
 registeredByUserId:string;registeredAt:string;status:"REGISTERED"|"CLOSED";notes:string|null;interest:number|null;
 difficulty:string|null;updatedAt:string;version:number;
};
type CoreHoDiaryPage={centerId:string|null;localDate:string|null;diaries:CoreHoDiary[];hasMore:boolean;limit:number;offset:number};
export const diaryUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function validDiaryDay(v:string):boolean{
 return DAY.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
}
export function localDayToday(at=new Date()):string{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);
 return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value??"").join("-");
}
export function isCoreHoDiary(v:unknown):v is CoreHoDiary{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<CoreHoDiary>;
 return Boolean(diaryUuid.test(x.id??"")&&diaryUuid.test(x.centerId??"")&&diaryUuid.test(x.studentId??"")&&
   diaryUuid.test(x.registeredByUserId??"")&&typeof x.teachingContextKey==="string"&&x.teachingContextKey.length>0&&
   typeof x.pathKey==="string"&&(x.runningClassId===null||typeof x.runningClassId==="string")&&
   ["REGISTERED","CLOSED"].includes(x.status??"")&&typeof x.registeredAt==="string"&&
   Number.isFinite(Date.parse(x.registeredAt))&&typeof x.updatedAt==="string"&&Number.isFinite(Date.parse(x.updatedAt))&&
   (x.notes===null||typeof x.notes==="string")&&(x.difficulty===null||typeof x.difficulty==="string")&&
   (x.interest===null||(Number.isInteger(x.interest)&&x.interest!>=1&&x.interest!<=4))&&
   Number.isSafeInteger(x.version)&&x.version!>=1);
}
export function projectHoDiary(v:CoreHoDiary):HoDiaryRow{
 // PAP-1254 and MissionResult PAP-1204 not yet present in Core's canonical read projection.
 // UUID submitter is honest source identity; never infer teacher name or Mission completion.
 const day=v.teachingContextKey.slice(-10);
 return {id:v.id,student:v.studentId,mission:"Chưa liên kết nhiệm vụ",center:v.centerId,
  className:v.runningClassId??v.teachingContextKey,date:validDiaryDay(day)?day:v.registeredAt.slice(0,10),
  submitter:v.registeredByUserId,status:v.status==="CLOSED"?"Đã đóng":"Đã ghi nhận",
  diaryCode:v.id,notes:v.notes??"—",interest:v.interest===null?"Chưa xác nhận":String(v.interest),
  difficulty:v.difficulty??"—",updatedAt:v.updatedAt,missionCompleted:"Chưa xác nhận"};
}
async function readData(fetcher:typeof fetch,path:string,signal:AbortSignal):Promise<unknown>{
 const r=await fetcher(path,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!r.ok)throw Error("Global Diary read denied/unavailable ("+r.status+").");
 const json:unknown=await r.json();
 if(!json||typeof json!=="object"||!("data" in json))throw Error("Invalid GLOBAL Diary response");
 return json.data;
}
export function hoDiaryQueryForDay(day:string,centerId=""):TableQuery<F>{
 if(!validDiaryDay(day)||(centerId&&!diaryUuid.test(centerId)))throw Error("Valid local date and Center required");
 return {...hoDiaryQuery,filters:{logic:"AND",rules:[{field:"date",op:"eq",value:day},...(centerId?[{field:"center" as const,op:"eq" as const,value:centerId}]:[])]}};
}
function dayFromQuery(query:TableQuery<F>):string{
 const dates=query.filters.rules.filter(r=>r.field==="date");
 if(query.filters.logic!=="AND"||dates.length!==1||dates[0]?.op!=="eq"||typeof dates[0].value!=="string"||
   !validDiaryDay(dates[0].value))throw Error("Choose a valid Diary day via date filter");
 return dates[0].value;
}
export async function readGlobalDiaries(fetcher:typeof fetch,centerId:string,localDate:string,signal:AbortSignal):Promise<readonly CoreHoDiary[]>{
 if((centerId&&!diaryUuid.test(centerId))||!validDiaryDay(localDate))throw Error("Invalid GLOBAL Diary scope");
 const all:CoreHoDiary[]=[],seen=new Set<string>();
 for(let offset=0;offset<400;offset+=100){
  const q=new URLSearchParams({localDate,limit:"100",offset:String(offset)});
  if(centerId)q.set("centerId",centerId);
  const value=await readData(fetcher,"/api/ho/learning/path-diaries?"+q.toString(),signal);
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid GLOBAL Diary page");
  const p=value as Partial<CoreHoDiaryPage>;
  if(p.centerId!==(centerId||null)||p.localDate!==localDate||p.limit!==100||p.offset!==offset||
   !Array.isArray(p.diaries)||p.diaries.length>100||typeof p.hasMore!=="boolean"||
   p.diaries.some(v=>!isCoreHoDiary(v)||(centerId&&v.centerId!==centerId)))throw Error("Malformed GLOBAL Diary page");
  for(const diary of p.diaries){
   if(seen.has(diary.id))throw Error("Duplicate GLOBAL Diary ID");
   seen.add(diary.id);all.push(diary);
  }
  if(!p.hasMore)return all;
  if(p.diaries.length!==100)throw Error("Inconsistent GLOBAL Diary pagination");
 }
 throw Error("Hơn 400 nhật ký/ngày; không hiển thị danh sách thiếu. Vui lòng lọc theo Center.");
}
export async function readGlobalDiary(fetcher:typeof fetch,id:string,centerId:string,signal:AbortSignal):Promise<CoreHoDiary>{
 if(!diaryUuid.test(id)||(centerId&&!diaryUuid.test(centerId)))throw Error("Invalid Diary identity");
 const value=await readData(fetcher,"/api/ho/learning/path-diaries/"+id,signal);
 if(!isCoreHoDiary(value)||value.id!==id||(centerId&&value.centerId!==centerId))
  throw Error("GLOBAL Diary identity or Center mismatch");
 return value;
}
function centerFromQuery(query:TableQuery<F>):string{
 const centers=query.filters.rules.filter(r=>r.field==="center");
 if(centers.length>1||(centers.length===1&&(centers[0]?.op!=="eq"||typeof centers[0].value!=="string"||!diaryUuid.test(centers[0].value))))throw Error("Invalid Center filter");
 return centers.length===1?String(centers[0]!.value):"";
}
export const hoDiaryProvider:SurfaceProvider<F>={pagination:"local-ui",
  async list(query,scope,fetcher,signal){
   if(scope.surface!=="HO")throw Error("HO GLOBAL scope required");
   const rows=await readGlobalDiaries(fetcher,centerFromQuery(query),dayFromQuery(query),signal);
   return {records:rows.map(v=>({row:projectHoDiary(v),version:String(v.version)})),total:rows.length};
  },
  async detail(id,scope,fetcher,signal){
   if(scope.surface!=="HO")throw Error("HO GLOBAL scope required");
   const v=await readGlobalDiary(fetcher,id,"",signal);
   return {row:projectHoDiary(v),version:String(v.version)};
  },
};
const registry=new TddRegistry();
export const hoDiarySchema=registry.register({...hoDiaryDefinition,data:{
 id:"ho-classroom-diary-global-bound",
 list:async()=>{throw Error("Authenticated GLOBAL Diary adapter required");},
 detail:async()=>{throw Error("Authenticated GLOBAL Diary adapter required");},
}});