import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import type { BoCenter } from "@/lib/bo-model";

const read = { display:true, search:true, filter:true, sort:true, group:true, inlineEdit:false } as const;
const P="open_studio.walkin_pass.manage";
export const passFields=[
 {key:"code",label:"Mã Pass",type:"text",icon:"#",width:255,permission:P,readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:150,permission:P,readOnly:true,capabilities:read},
 {key:"path",label:"Path",type:"text",icon:"▣",width:110,permission:P,readOnly:true,capabilities:read},
 {key:"parent",label:"Parent ID",type:"text",icon:"@",width:280,permission:P,readOnly:true,capabilities:read},
 {key:"center",label:"Center ID",type:"text",icon:"⌖",width:260,permission:P,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof passFields;
const sections=[{id:"pass",label:"Pass tại Center",fields:["code","status","path","parent","center"]}] as const;
export const passQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"code",direction:"asc"},group:null,
 order:["code","status","path","parent","center"],visible:["code","status","path","parent"],page:1,pageSize:15,
};
export const passDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"open-studio-passes",label:"Pass Trạm Nghệ Thuật",group:"Open Studio",
 fields:passFields,capabilities:{read:P},
 table:{
  identity:{field:"code",pinned:"left",hideable:false,reorderable:false},
  columns:[{field:"code",visible:true},{field:"status",visible:true},{field:"path",visible:true},{field:"parent",visible:true},{field:"center",visible:false}],
  search:{fields:["code","status","path","parent"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["status","path"],mode:"flat",logic:"AND"},
  sort:{fields:["code","status","path"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["status","path"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Lịch sử chỉ khả dụng khi API cung cấp cho Center hiện hành; không tạo event giả."}},
} as const satisfies SurfaceDefinition<F>;
export type PassRow=ModuleRow<F>;
export type PassRecord={
 id:string;code:string;status:"AVAILABLE"|"ASSIGNED"|"CONSUMED"|"REVOKED";
 path_code:"AC"|"LPP"|"LPA"|"PH"|null;parent_user_id:string|null;center_id:string|null;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** BO /api/bo/centers uses the lowercase ACTIVE lifecycle value. */
export function isActiveBoCenter(c:Pick<BoCenter,"id"|"status">):boolean {
 return uuid.test(c.id) && c.status==="active";
}
export async function readCenterPasses(fetcher:typeof fetch,centerId:string,signal:AbortSignal):Promise<readonly PassRecord[]>{
 if(!uuid.test(centerId))throw Error("Center identity invalid");
 const url="/api/bo/open-studio/walkin/inventory?centerId="+encodeURIComponent(centerId);
 const response=await fetcher(url,{method:"GET",cache:"no-store",signal});
 signal.throwIfAborted();
 if(!response.ok)throw Error("Không thể đọc Pass tại Center này.");
 const raw:unknown=await response.json();signal.throwIfAborted();
 if(!raw||typeof raw!=="object"||!("data" in raw)||!Array.isArray(raw.data))throw Error("Invalid Center Pass inventory");
 const passes=raw.data as PassRecord[];
 if(passes.length>100||passes.some(p=>!p||!uuid.test(p.id)||!/^PINO-OS-[0-9A-F]+$/.test(p.code)||
   !["AVAILABLE","ASSIGNED","CONSUMED","REVOKED"].includes(p.status)||
   (p.path_code!==null&&!["AC","LPP","LPA","PH"].includes(p.path_code))||
   (p.parent_user_id!==null&&!uuid.test(p.parent_user_id))||p.center_id!==centerId)||
   new Set(passes.map(p=>p.id)).size!==passes.length)throw Error("Invalid Center-scoped Pass response");
 return passes;
}
function project(p:PassRecord):PassRow{
 return{id:p.id,code:p.code,status:p.status,path:p.path_code??"—",parent:p.parent_user_id??"—",center:p.center_id??"—"};
}
export const passProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,fetcher,signal){
  if(scope.surface!=="BO")throw Error("BO Center scope required");
  const rows=await readCenterPasses(fetcher,scope.centerId,signal);
  return{records:rows.map(p=>({row:project(p),centerId:scope.centerId})),total:rows.length};
 },
 async detail(id,scope,fetcher,signal){
  if(scope.surface!=="BO")throw Error("BO Center scope required");
  const rows=await readCenterPasses(fetcher,scope.centerId,signal);
  const row=rows.find(p=>p.id===id);
  return row?{row:project(row),centerId:scope.centerId}:null;
 }
};
const registry=new TddRegistry();
export const passSchema=registry.register({...passDefinition,data:{
 id:"bo-open-studio-walkin-center-bound",
 list:async()=>{throw Error("Requires authenticated Center-scoped TDD adapter");},
 detail:async()=>{throw Error("Requires authenticated Center-scoped TDD adapter");}
}});
