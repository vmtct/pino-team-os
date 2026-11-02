/** PAP-1220 / Epic PAP-727: actual Core Diary, BO Center read-only, shared TDD. */
import {TddRegistry,type FieldSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
import type {SurfaceDefinition,SurfaceProvider} from "@/lib/workspace-adapters/contracts";

const P="session.roster.view";
const READ={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const diaryFields=[
 {key:"student",label:"Học viên",type:"text",icon:"Aa",width:225,permission:P,readOnly:true,capabilities:READ},
 {key:"mission",label:"Nhiệm vụ",type:"text",icon:"▣",width:240,permission:P,readOnly:true,capabilities:READ},
 {key:"date",label:"Ngày học",type:"text",icon:"⌁",width:140,permission:P,readOnly:true,capabilities:READ},
 {key:"className",label:"Lớp / bối cảnh",type:"text",icon:"▣",width:240,permission:P,readOnly:true,capabilities:READ},
 {key:"submitter",label:"Người Submit",type:"text",icon:"Aa",width:235,permission:P,readOnly:true,capabilities:READ},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140,permission:P,readOnly:true,capabilities:READ},
 {key:"diaryCode",label:"Diary ID",type:"text",icon:"#",width:300,permission:P,readOnly:true,capabilities:READ},
 {key:"center",label:"Center",type:"text",icon:"⌖",width:290,permission:P,readOnly:true,capabilities:READ},
 {key:"notes",label:"Ghi chú",type:"textarea",icon:"Aa",width:340,permission:P,readOnly:true,capabilities:READ},
 {key:"interest",label:"Hứng thú (1–4)",type:"text",icon:"#",width:145,permission:P,readOnly:true,capabilities:READ},
 {key:"difficulty",label:"Khó khăn",type:"text",icon:"Aa",width:300,permission:P,readOnly:true,capabilities:READ},
 {key:"updatedAt",label:"Cập nhật lúc",type:"text",icon:"⌁",width:225,permission:P,readOnly:true,capabilities:READ},
 {key:"missionCompleted",label:"Nhiệm vụ hoàn tất",type:"text",icon:"◉",width:170,permission:P,readOnly:true,capabilities:READ},
] as const satisfies readonly FieldSchema[];
type F=typeof diaryFields;
const identitySection={id:"identity",label:"Thông tin",fields:["student","mission","date","className","submitter","status","diaryCode"]} as const;
const observationSection={id:"observation",label:"Quan sát",fields:["notes","interest","difficulty","missionCompleted","center","updatedAt"]} as const;
export const diaryQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"date",direction:"desc"},group:null,
 order:["student","mission","date","className","submitter","status","diaryCode","notes","interest","difficulty","center","updatedAt","missionCompleted"],
 visible:["student","mission","date","className","submitter","status","diaryCode"],
 page:1,pageSize:15,
};
export const diaryDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"classroom-diaries",label:"Nhật ký lớp học",group:"School",
 fields:diaryFields,capabilities:{read:P},
 table:{
  identity:{field:"student",pinned:"left",hideable:false,reorderable:false},
  columns:diaryQuery.order.map(field=>({field,visible:diaryQuery.visible.includes(field)})),
  search:{fields:["student","mission","submitter","className","notes","diaryCode"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status","date","submitter"],mode:"flat",logic:"AND"},
  sort:{fields:["date","student","status"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections:[identitySection,observationSection],actions:[]},
 detail:{overview:{sections:[identitySection,observationSection]},businessTabs:[],
  history:{kind:"unavailable",reason:"Lịch sử chỉ hiện khi Core cung cấp nguồn audit có quyền; không tạo sự kiện giả."}},
} as const satisfies SurfaceDefinition<F>;
export type DiaryViewRow=ModuleRow<F>;
type CoreDiary={
 id:string;centerId:string;studentId:string;teachingContextKey:string;pathKey:string;runningClassId:string|null;
 registeredByUserId:string;registeredAt:string;status:"REGISTERED"|"CLOSED";notes:string|null;interest:number|null;
 difficulty:string|null;updatedAt:string;version:number;
};
type CoreDiaryPage={centerId:string;localDate:string;diaries:CoreDiary[];hasMore:boolean;limit:number;offset:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^\d{4}-\d{2}-\d{2}$/;
export function validDiaryDay(value:string):boolean{return day.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value}
export function localDayToday(at=new Date()):string{
 const values=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);
 const part=(type:string)=>values.find(v=>v.type===type)?.value??"";
 return [part("year"),part("month"),part("day")].join("-");
}
function isDiary(v:unknown,centerId:string):v is CoreDiary{
 if(!v||typeof v!=="object"||Array.isArray(v))return false;
 const x=v as Partial<CoreDiary>;
 return Boolean(uuid.test(x.id??"")&&x.centerId===centerId&&uuid.test(x.studentId??"")&&
  uuid.test(x.registeredByUserId??"")&&typeof x.teachingContextKey==="string"&&
  x.teachingContextKey.length>0&&typeof x.pathKey==="string"&&
  (x.runningClassId===null||typeof x.runningClassId==="string")&&
  ["REGISTERED","CLOSED"].includes(x.status??"")&&
  typeof x.registeredAt==="string"&&Number.isFinite(Date.parse(x.registeredAt))&&
  typeof x.updatedAt==="string"&&Number.isFinite(Date.parse(x.updatedAt))&&
  (x.notes===null||typeof x.notes==="string")&&
  (x.difficulty===null||typeof x.difficulty==="string")&&
  (x.interest===null||(Number.isInteger(x.interest)&&x.interest!>=1&&x.interest!<=4))&&
  Number.isSafeInteger(x.version)&&x.version!>=1);
}
async function get(fetcher:typeof fetch,url:string,signal:AbortSignal):Promise<unknown>{
 const response=await fetcher(url,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!response.ok)throw Error("Core Diary read denied/unavailable ("+response.status+").");
 const body:unknown=await response.json();
 signal.throwIfAborted();
 if(!body||typeof body!=="object"||!("data" in body))throw Error("Diary response invalid");
 return body.data;
}
export function projectDiary(value:CoreDiary):DiaryViewRow{
 // Current Core intentionally has no PAP-1254 Mission association and no PAP-1204 Result in this read model.
 // Never infer links from Student/date/path/legacy mission children or Diary CLOSED.
 const d=value.teachingContextKey.slice(-10);
 return {id:value.id,student:value.studentId,mission:"Chưa liên kết nhiệm vụ",
  date:validDiaryDay(d)?d:value.registeredAt.slice(0,10),
  className:value.runningClassId??value.teachingContextKey,
  submitter:value.registeredByUserId,status:value.status==="CLOSED"?"Đã đóng":"Đã ghi nhận",
  diaryCode:value.id,center:value.centerId,notes:value.notes??"—",interest:value.interest===null?"Chưa xác nhận":String(value.interest),
  difficulty:value.difficulty??"—",updatedAt:value.updatedAt,missionCompleted:"Chưa xác nhận"};
}
async function readPage(fetcher:typeof fetch,centerId:string,localDate:string,offset:number,signal:AbortSignal):Promise<CoreDiaryPage>{
 if(!uuid.test(centerId)||!validDiaryDay(localDate))throw Error("Invalid Center/day scope");
 const query=new URLSearchParams({centerId,localDate,limit:"100",offset:String(offset)});
 const value=await get(fetcher,"/api/bo/learning/path-diaries?"+query,signal);
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Diary page");
 const v=value as Partial<CoreDiaryPage>;
 if(v.centerId!==centerId||v.localDate!==localDate||v.limit!==100||v.offset!==offset||
   !Array.isArray(v.diaries)||v.diaries.length>100||typeof v.hasMore!=="boolean"||
   v.diaries.some(x=>!isDiary(x,centerId)))throw Error("Invalid Center Diary projection");
 return v as CoreDiaryPage;
}
/** 100-row backend pages; hard error for >400 daily results rather than silently truncate. */
export async function readCenterDay(fetcher:typeof fetch,centerId:string,localDate:string,signal:AbortSignal):Promise<readonly CoreDiary[]>{
 const records:CoreDiary[]=[],ids=new Set<string>();
 for(let offset=0;offset<400;offset+=100){
  const page=await readPage(fetcher,centerId,localDate,offset,signal);
  for(const row of page.diaries){
   if(ids.has(row.id))throw Error("Duplicate Diary id");
   ids.add(row.id);records.push(row);
  }
  if(!page.hasMore)return records;
  if(page.diaries.length!==100)throw Error("Inconsistent Core Diary pagination");
 }
 throw Error("Hơn 400 nhật ký/ngày; không hiển thị danh sách thiếu. Cần giới hạn phạm vi hoặc phân trang server.");
}
export async function readCenterDiary(fetcher:typeof fetch,centerId:string,id:string,signal:AbortSignal):Promise<CoreDiary|null>{
 if(!uuid.test(id)||!uuid.test(centerId))throw Error("Invalid Diary identity");
 const v=await get(fetcher,"/api/bo/learning/path-diaries/"+encodeURIComponent(id)+"?centerId="+encodeURIComponent(centerId),signal);
 if(!isDiary(v,centerId)||v.id!==id)throw Error("Wrong Center/invalid Diary detail");
 return v;
}
/** The Calendar day is an explicit typed TDD filter, not hidden mutable module-wide state. */
export function diaryQueryForDay(localDate:string):TableQuery<F>{
 if(!validDiaryDay(localDate))throw Error("Diary day required");
 return {...diaryQuery,filters:{logic:"AND",rules:[{field:"date",op:"eq",value:localDate}]}};
}
function requestedDay(query:TableQuery<F>):string{
 const dates=query.filters.rules.filter(r=>r.field==="date");
 if(query.filters.logic!=="AND"||dates.length!==1||dates[0]?.op!=="eq"||typeof dates[0].value!=="string"||
   !validDiaryDay(dates[0].value))throw Error("Choose one authorized Diary day via the date filter");
 return dates[0].value;
}
export const diaryProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(query,scope,fetcher,signal){
  if(scope.surface!=="BO")throw Error("CENTER scope required");
  const day=requestedDay(query);
  const rows=await readCenterDay(fetcher,scope.centerId,day,signal);
  return {records:rows.map(v=>({row:projectDiary(v),centerId:scope.centerId,version:String(v.version)})),total:rows.length};
 },
 async detail(id,scope,fetcher,signal){
  if(scope.surface!=="BO")throw Error("CENTER scope required");
  const row=await readCenterDiary(fetcher,scope.centerId,id,signal);
  return row?{row:projectDiary(row),centerId:scope.centerId,version:String(row.version)}:null;
 },
};

const registry=new TddRegistry();
export const diarySchema=registry.register({...diaryDefinition,data:{
 id:"bo-classroom-diary-center-bound",
 list:async()=>{throw Error("Authenticated Center-scoped Diary adapter required");},
 detail:async()=>{throw Error("Authenticated Center-scoped Diary adapter required");},
}});
