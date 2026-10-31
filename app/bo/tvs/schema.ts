import {TddRegistry,type Approval,type FieldSchema,type ModuleRow,type TableQuery} from "@/lib/workspace-schema";
import type {SurfaceDefinition,SurfaceProvider} from "@/lib/workspace-adapters/contracts";
const P="tv.view";
const read={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const tvFields=[
 {key:"name",label:"TV / Display",type:"text",icon:"Aa",width:230,permission:P,readOnly:true,capabilities:read},
 {key:"center",label:"Center",type:"text",icon:"⌖",width:190,permission:P,readOnly:true,capabilities:read},
 {key:"runtime",label:"Runtime",type:"text",icon:"▣",width:180,permission:P,readOnly:true,capabilities:read},
 {key:"orientation",label:"Tỷ lệ / Hướng",type:"text",icon:"▣",width:160,permission:P,readOnly:true,capabilities:read},
 {key:"status",label:"Trạng thái định nghĩa",type:"text",icon:"◉",width:170,permission:P,readOnly:true,capabilities:read},
 {key:"deviceCount",label:"Thiết bị liên kết",type:"number",icon:"#",width:155,permission:P,readOnly:true,capabilities:read},
 {key:"lastSeen",label:"Lần kết nối gần nhất",type:"text",icon:"⌁",width:220,permission:P,readOnly:true,capabilities:read},
 {key:"key",label:"Display key",type:"text",icon:"#",width:210,permission:P,readOnly:true,capabilities:read},
 {key:"centerId",label:"Center ID",type:"text",icon:"#",width:265,permission:P,readOnly:true,capabilities:read},
] as const satisfies readonly FieldSchema[];
type F=typeof tvFields;
const columns=["name","center","runtime","orientation","status","deviceCount","lastSeen","key","centerId"] as const;
const sections=[{id:"identity",label:"Thông tin TV",fields:columns}] as const;
export const tvQuery:TableQuery<F>={search:"",filters:{logic:"AND",rules:[]},sort:{field:"name",direction:"asc"},group:null,order:[...columns],visible:["name","runtime","orientation","status","deviceCount","lastSeen"],page:1,pageSize:15};
const extensionApproval={jira:"PAP-1266",owner:"Founder",designAuthority:"PAP-650/PAP-656 House Ambient b80d44c; Option A 2026-10-31",files:["app/bo/tvs/TvsTdd.tsx","app/bo/tvs/schema.ts","app/bo/pinoria-tv-mesh/HouseMeshEditor.tsx"],tests:["app/bo/tvs/schema.test.ts","lib/host-boundary.test.ts"],reviewBy:"2026-11-30T00:00:00+07:00"} as const;
export const verifyTvExtension=(approval:Approval,scope:{surface:"BO"|"HO";key:string;extensionId?:string})=>scope.surface==="BO"&&scope.key==="tvs"&&scope.extensionId==="pap1266-house-mesh-v1"&&approval.jira===extensionApproval.jira&&approval.designAuthority===extensionApproval.designAuthority;
export const tvDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"BO",key:"tvs",label:"TVs",group:"Pinoria",fields:tvFields,capabilities:{read:P},
 table:{identity:{field:"name",pinned:"left",hideable:false,reorderable:false},columns:columns.map(field=>({field,visible:tvQuery.visible.includes(field as typeof tvQuery.visible[number])})),
 search:{fields:["name","runtime","key"],normalization:"vi-diacritic-insensitive"},
 filters:{fields:["runtime","status","orientation"],mode:"flat",logic:"AND"},
 sort:{fields:["name","status","lastSeen"],mode:"single",nulls:"last",tieBreak:"record-id"},
 group:{fields:["runtime","status"],mode:"single"},
 views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
 pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},inlineEdit:{fields:[],enabled:false},
 interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"}},
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[{id:"space",label:"Không gian",kind:"approved-extension",extensionId:"pap1266-house-mesh-v1",source:{adapter:"pinoria.tv.spatial",permission:P},approval:extensionApproval}],history:{kind:"unavailable",reason:"Chưa có audit history được Core cấp quyền cho Center này."}},
} as const satisfies SurfaceDefinition<F>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type TvDisplay={id:string;key:string;displayName:string;description:string|null;runtimeType:string;scopeType:"GLOBAL"|"CENTER";scopeId:string|null;centerName:string|null;orientation:"LANDSCAPE"|"PORTRAIT";targetAspectRatio:string;definitionVersion:number;status:string};
export type TvDevice={id:string;centerId:string|null;defaultDisplayId:string|null;lastSeenAt:string|null};
export type TvRow=ModuleRow<F>;
const validDisplay=(v:unknown):v is TvDisplay=>{const d=v as TvDisplay;return Boolean(d&&typeof d==="object"&&uuid.test(d.id)&&typeof d.displayName==="string"&&typeof d.key==="string"&&typeof d.runtimeType==="string"&&["GLOBAL","CENTER"].includes(d.scopeType)&&(!d.scopeId||uuid.test(d.scopeId))&&["LANDSCAPE","PORTRAIT"].includes(d.orientation)&&typeof d.targetAspectRatio==="string"&&typeof d.status==="string")};
const validDevice=(v:unknown):v is TvDevice=>{const x=v as TvDevice;return Boolean(x&&typeof x==="object"&&uuid.test(x.id)&&(x.centerId===null||uuid.test(x.centerId))&&(x.defaultDisplayId===null||uuid.test(x.defaultDisplayId))&&(x.lastSeenAt===null||typeof x.lastSeenAt==="string"))};
async function readRows<T>(fetcher:typeof fetch,url:string,signal:AbortSignal,guard:(v:unknown)=>v is T):Promise<T[]>{
 const response=await fetcher(url,{method:"GET",cache:"no-store",signal});signal.throwIfAborted();
 if(!response.ok)throw new Error("TV Core read denied/unavailable ("+response.status+")");
 const body:unknown=await response.json();signal.throwIfAborted();
 if(!body||typeof body!=="object"||!("data" in body)||!Array.isArray(body.data)||body.data.length>2000||body.data.some(x=>!guard(x)))throw Error("Invalid TV Core projection");
 return body.data as T[];
}
export function projectCenterTvs(displays:readonly TvDisplay[],devices:readonly TvDevice[],centerId:string):TvRow[]{
 if(!uuid.test(centerId))throw Error("Center scope required");
 return displays.filter(tv=>tv.scopeType==="CENTER"&&tv.scopeId===centerId).map(tv=>{
  const linked=devices.filter(device=>device.centerId===centerId&&device.defaultDisplayId===tv.id);
  const timestamps=linked.map(device=>device.lastSeenAt).filter((v):v is string=>Boolean(v)&&Number.isFinite(Date.parse(v!))).sort();
  return {id:tv.id,name:tv.displayName,center:tv.centerName??centerId,runtime:tv.runtimeType,orientation:tv.orientation+" · "+tv.targetAspectRatio,status:tv.status,deviceCount:linked.length,lastSeen:timestamps.at(-1)??"Chưa từng kết nối",key:tv.key,centerId};
 });
}
async function centerRows(scope:{surface:"BO"|"HO";centerId?:string},fetcher:typeof fetch,signal:AbortSignal){
 if(scope.surface!=="BO"||!scope.centerId||!uuid.test(scope.centerId))throw Error("Center scope denied");
 const [displays,devices]=await Promise.all([readRows(fetcher,"/api/bo/tv/displays",signal,validDisplay),readRows(fetcher,"/api/bo/tv/devices",signal,validDevice)]);
 return projectCenterTvs(displays,devices,scope.centerId);
}
export const tvProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,fetcher,signal){const rows=await centerRows(scope,fetcher,signal);return {records:rows.map(row=>({row,centerId:scope.surface==="BO"?scope.centerId:undefined})),total:rows.length}},
 async detail(id,scope,fetcher,signal){if(!uuid.test(id))throw Error("Invalid display identity");const rows=await centerRows(scope,fetcher,signal);const row=rows.find(v=>v.id===id);return row?{row,centerId:scope.surface==="BO"?scope.centerId:undefined}:null},
};
const registry=new TddRegistry((approval,scope)=>verifyTvExtension(approval,scope));
export const tvSchema=registry.register({...tvDefinition,data:{id:"bo-tv-center-session-required",list:async()=>{throw Error("Authenticated TV adapter required");},detail:async()=>{throw Error("Authenticated TV adapter required");}}});
