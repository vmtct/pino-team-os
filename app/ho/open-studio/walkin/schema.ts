import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
export const passFields = [
 {key:"code",label:"Mã Pass",type:"text",icon:"#",width:260,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:145,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
 {key:"path",label:"Path",type:"text",icon:"▣",width:115,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
 {key:"parent",label:"Parent ID",type:"text",icon:"@",width:260,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
 {key:"center",label:"Center ID",type:"text",icon:"⌖",width:260,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
 {key:"batch",label:"Batch ID",type:"text",icon:"▦",width:260,permission:"open_studio.walkin_pass.manage",readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof passFields;
const sections=[{id:"pass-identity",label:"Thông tin Pass",fields:["code","status","path","parent","center","batch"]}] as const;
export const passQuery: TableQuery<F> = {
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"code",direction:"asc"},group:null,
 order:["code","status","path","parent","center","batch"],
 visible:["code","status","path","parent","center"],page:1,pageSize:15,
};
export const passDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"walkinPasses",
 label:"Pass Trạm Nghệ Thuật",group:"Open Studio",
 fields:passFields,capabilities:{read:"open_studio.walkin_pass.manage"},
 table:{
  identity:{field:"code",pinned:"left",hideable:false,reorderable:false},
  columns:[{field:"code",visible:true},{field:"status",visible:true},{field:"path",visible:true},{field:"parent",visible:true},{field:"center",visible:true},{field:"batch",visible:false}],
  search:{fields:["code","status","path","parent","center","batch"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status","path","center","batch"],mode:"flat",logic:"AND"},
  sort:{fields:["code","status","path","center","batch"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["status","path"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Chỉ hiển thị lịch sử khi Core trả về dữ liệu có chứng cứ cho phạm vi HO."}},
} as const satisfies SurfaceDefinition<F>;
type PassRow=ModuleRow<F>;
export type WalkinPass={
 id:string;code:string;batch_id:string;status:"AVAILABLE"|"ASSIGNED"|"CONSUMED"|"REVOKED";
 path_code:"AC"|"LPP"|"LPA"|"PH"|null;parent_user_id:string|null;center_id:string|null;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function loadHoWalkinInventory(fetcher:typeof fetch,signal:AbortSignal):Promise<readonly WalkinPass[]>{
 const response=await fetcher("/api/ho/open-studio/walkin/inventory?limit=100",{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!response.ok)throw Error("Không thể tải kho Pass từ Core.");
 const json:unknown=await response.json();signal.throwIfAborted();
 if(!json||typeof json!=="object"||!("data" in json)||!Array.isArray(json.data))throw Error("Dữ liệu kho Pass không hợp lệ.");
 const rows=json.data as WalkinPass[];
 if(rows.length>100||rows.some(p=>!p||!uuid.test(p.id)||!uuid.test(p.batch_id)||typeof p.code!=="string"||!/^PINO-OS-[0-9A-F]+$/.test(p.code)||!["AVAILABLE","ASSIGNED","CONSUMED","REVOKED"].includes(p.status)||
   (p.path_code!==null&&!["AC","LPP","LPA","PH"].includes(p.path_code))||
   (p.parent_user_id!==null&&!uuid.test(p.parent_user_id))||(p.center_id!==null&&!uuid.test(p.center_id))))
  throw Error("Kho Pass trả dữ liệu sai contract.");
 return rows;
}
function project(p:WalkinPass):PassRow{
 return {id:p.id,code:p.code,status:p.status,path:p.path_code??"—",parent:p.parent_user_id??"—",center:p.center_id??"—",batch:p.batch_id};
}
export const passProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,fetcher,signal){
  if(scope.surface!=="HO")throw Error("HO only");
  // HO inventory has an exact /api/ho facade; the shared TDD session transport intentionally\n  // accepts only /api/bo reads. Use the real same-origin HO facade, reauthorized by Core.\n  const passes=await loadHoWalkinInventory(fetch,signal);
  return {records:passes.map(p=>({row:project(p)})),total:passes.length};
 },
 async detail(id,scope,fetcher,signal){
  if(scope.surface!=="HO")throw Error("HO only");
  // HO inventory has an exact /api/ho facade; the shared TDD session transport intentionally\n  // accepts only /api/bo reads. Use the real same-origin HO facade, reauthorized by Core.\n  const passes=await loadHoWalkinInventory(fetch,signal);
  const pass=passes.find(p=>p.id===id);
  return pass?{row:project(pass)}:null;
 }
};
const registry=new TddRegistry();
export const passSchema=registry.register({...passDefinition,data:{
 id:"ho-open-studio-walkin-inventory",
 list:async(_query:TableQuery<F>,_context,signal)=>{
  const passes=await loadHoWalkinInventory(fetch,signal);return{rows:passes.map(project),total:passes.length};
 },
 detail:async(id:string,_context,signal)=>{
  const passes=await loadHoWalkinInventory(fetch,signal);const pass=passes.find(p=>p.id===id);return pass?project(pass):null;
 }
}});
