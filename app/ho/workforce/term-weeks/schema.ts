import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";

const read={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const termWeekFields=[
  {key:"name",label:"Tuần",type:"text",icon:"Aa",width:260,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"code",label:"Mã tuần",type:"text",icon:"#",width:130,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"startDate",label:"Bắt đầu",type:"date",icon:"◷",width:140,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"endDate",label:"Kết thúc",type:"date",icon:"◷",width:140,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"rhythmKey",label:"Nhịp",type:"text",icon:"Aa",width:150,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"ordinal",label:"Thứ tự",type:"number",icon:"#",width:100,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
  {key:"termId",label:"Term",type:"text",icon:"⌘",width:240,permission:"operating_cycle.global_week.lock",readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof termWeekFields;
const sections=[{id:"term-week-info",label:"Thông tin TermWeek",fields:["name","code","startDate","endDate","rhythmKey","ordinal","termId"]}] as const;
export const termWeekQuery:TableQuery<F>={
  search:"",filters:{logic:"AND",rules:[]},sort:{field:"startDate",direction:"desc"},group:null,
  order:["name","code","startDate","endDate","rhythmKey","ordinal","termId"],
  visible:["name","startDate","endDate","rhythmKey","code"],
  page:1,pageSize:15,
};
export const termWeekDefinition={
  version:1,classification:"TDD_DEFAULT",surface:"HO",key:"termWeeks",label:"TermWeek",group:"Workforce",
  fields:termWeekFields,capabilities:{read:"operating_cycle.global_week.lock"},
  table:{
    identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
    columns:[
      {field:"name",visible:true},{field:"code",visible:true},
      {field:"startDate",visible:true},{field:"endDate",visible:true},
      {field:"rhythmKey",visible:true},{field:"ordinal",visible:false},{field:"termId",visible:false},
    ],
    search:{fields:["name","code","termId"],normalization:"vi-diacritic-insensitive"},
    filters:{fields:["name","startDate","endDate","rhythmKey"],mode:"flat",logic:"AND"},
    sort:{fields:["name","startDate","endDate","code"],mode:"single",nulls:"last",tieBreak:"record-id"},
    group:{fields:["rhythmKey"],mode:"single"},
    views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
    pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
    inlineEdit:{fields:[],enabled:false},
    interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
  },
  drawer:{density:"one-column",sections,actions:[]},
  detail:{
    overview:{sections},
    businessTabs:[{
      id:"registration-lock",label:"Khóa đăng ký",kind:"approved-extension",
      source:{adapter:"ho-global-week-lock",permission:"operating_cycle.global_week.lock"},
      extensionId:"ho.workforce.global-week-lock",
      approval:{
        jira:"PAP-1198",owner:"HO Runtime",designAuthority:"Founder",
        files:["app/ho/workforce/term-weeks/HoGlobalWeekLockEditor.tsx","app/ho/workforce/term-weeks/HoTermWeeksTdd.tsx"],
        tests:["lib/pap1198-ho-global-week-lock.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00",
      },
    },{
      id:"metadata-edit",label:"Chỉnh sửa",kind:"approved-extension",
      source:{adapter:"ho-global-week-update",permission:"operating_cycle.global_week.manage"},
      extensionId:"ho.workforce.global-week-update",
      approval:{
        jira:"PAP-1198",owner:"HO Runtime",designAuthority:"Founder",
        files:["app/ho/workforce/term-weeks/HoGlobalWeekUpdateEditor.tsx","app/ho/workforce/term-weeks/HoTermWeeksTdd.tsx"],
        tests:["lib/pap1198-ho-global-termweeks-update.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00",
      },
    }],
    history:{kind:"unavailable",reason:"Lịch sử TermWeek cần nguồn audit được phân quyền; không dùng dữ liệu giả."},
  },
} as const satisfies SurfaceDefinition<F>;

type Row=ModuleRow<F>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ApiWeek={id:string;name:string;code:string;startDate:string;endDate:string;rhythmKey:string;ordinal:number;termId:string};
async function globalWeeks(fetcher:typeof fetch,signal:AbortSignal):Promise<readonly Row[]>{
  const response=await fetcher("/api/ho/workforce/global-termweeks",{method:"GET",signal,cache:"no-store"});
  signal.throwIfAborted();
  if(!response.ok)throw Error("Không tải được Global TermWeek.");
  const body:unknown=await response.json();signal.throwIfAborted();
  const data=(body as {data?:unknown}|null)?.data;
  if(!Array.isArray(data))throw Error("Global TermWeek response không hợp lệ.");
  if(data.some(w=>!w||typeof w!=="object"||!uuid.test(w.id)||!uuid.test(w.termId)||
    typeof w.name!=="string"||typeof w.code!=="string"||typeof w.startDate!=="string"||
    typeof w.endDate!=="string"||typeof w.rhythmKey!=="string"||!Number.isSafeInteger(w.ordinal)))
    throw Error("Global TermWeek record không hợp lệ.");
  return (data as ApiWeek[]).map(w=>({
    id:w.id,name:w.name,code:w.code,startDate:w.startDate,endDate:w.endDate,
    rhythmKey:w.rhythmKey,ordinal:w.ordinal,termId:w.termId,
  }));
}
export const termWeekProvider:SurfaceProvider<F>={
  pagination:"local-ui",
  async list(_query,scope,fetcher,signal){
    if(scope.surface!=="HO")throw Error("HO only");
    const all=await globalWeeks(fetcher,signal);
    return {records:all.map(row=>({row})),total:all.length};
  },
  async detail(id,scope,fetcher,signal){
    if(scope.surface!=="HO")throw Error("HO only");
    const all=await globalWeeks(fetcher,signal);
    const row=all.find(r=>r.id===id);
    return row?{row}:null;
  },
};
export const verifyGlobalWeekExtensionApproval:ApprovalVerifier=(approval,scope)=>
  scope.surface==="HO"&&scope.key==="termWeeks"&&
  ["ho.workforce.global-week-lock","ho.workforce.global-week-update"].includes(scope.extensionId??"")&&
  approval.jira==="PAP-1198"&&approval.owner==="HO Runtime"&&
  approval.designAuthority==="Founder"&&
  approval.files.includes(scope.extensionId==="ho.workforce.global-week-update"
    ?"app/ho/workforce/term-weeks/HoGlobalWeekUpdateEditor.tsx"
    :"app/ho/workforce/term-weeks/HoGlobalWeekLockEditor.tsx");
export const termWeekRegistry=new TddRegistry(verifyGlobalWeekExtensionApproval);

export const termWeekSchema=termWeekRegistry.register({...termWeekDefinition,data:{
  id:"ho-global-termweeks-read",
  list:async(_query:TableQuery<F>,_context,signal)=>{
    const rows=await globalWeeks(fetch,signal);
    return {rows,total:rows.length};
  },
  detail:async(id:string,_context,signal)=>
    (await globalWeeks(fetch,signal)).find(w=>w.id===id)??null,
}});
