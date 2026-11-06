/** PAP-1419 / PNR-TV / PAP-650 — Founder HO TV directory, real Core data only.
 * PINO DS: shared TDD shell handles Table → Quick View → Full Detail.
 * No BO TV writer, Device pairing controls, Ads, generated fixture or inferred online state.
 */
import {TddRegistry, type FieldSchema, type ModuleRow, type TableQuery} from "@/lib/workspace-schema";
import type {SurfaceDefinition, SurfaceProvider} from "@/lib/workspace-adapters/contracts";
import {adapterError} from "@/lib/workspace-adapters/session";
import {loadHoTvDirectory,loadHoTvOperatorHealth,type HoTvDeviceSession} from "@/lib/ho-tv-directory-client";

const P="tv.view";
const canRead={display:true,search:true,filter:true,sort:true,group:true,inlineEdit:false} as const;
export const tvFields=[
 {key:"name",label:"TV",type:"text",icon:"Aa",width:260,permission:P,readOnly:true,capabilities:canRead},
 {key:"center",label:"Center",type:"text",icon:"⌖",width:180,permission:P,readOnly:true,capabilities:canRead},
 {key:"type",label:"Loại TV",type:"text",icon:"▣",width:190,permission:P,readOnly:true,capabilities:canRead},
 {key:"status",label:"Trạng thái",type:"text",icon:"◉",width:140,permission:P,readOnly:true,capabilities:canRead},
 {key:"resolution",label:"Tỷ lệ",type:"text",icon:"▣",width:110,permission:P,readOnly:true,capabilities:canRead},
 {key:"deviceCount",label:"Thiết bị được gán",type:"number",icon:"#",width:170,permission:P,readOnly:true,capabilities:canRead},
 {key:"heartbeat",label:"Heartbeat",type:"text",icon:"◉",width:170,permission:P,readOnly:true,capabilities:canRead},
 {key:"ack",label:"Renderer ACK",type:"text",icon:"◉",width:170,permission:P,readOnly:true,capabilities:canRead},
 {key:"observation",label:"Observation",type:"text",icon:"◉",width:170,permission:P,readOnly:true,capabilities:canRead},
 {key:"lastSeen",label:"Kết nối cuối",type:"text",icon:"◷",width:235,permission:P,readOnly:true,capabilities:canRead},
 {key:"version",label:"Phiên bản",type:"number",icon:"#",width:120,permission:P,readOnly:true,capabilities:canRead},
 {key:"id",label:"ID",type:"id",icon:"#",width:280,permission:P,readOnly:true,capabilities:{...canRead,search:false,filter:false,sort:false,group:false}},
] as const satisfies readonly FieldSchema[];
type F=typeof tvFields;
type Row=ModuleRow<F>;
const columns=["name","center","type","status","resolution","deviceCount","heartbeat","ack","observation","lastSeen","version","id"] as const;
const sections=[
 {id:"identity",label:"Thông tin TV",fields:["name","center","type","status","resolution","version","id"]},
 {id:"runtime",label:"Kết nối và thiết bị",fields:["deviceCount","heartbeat","ack","observation","lastSeen"]},
] as const;
export const tvQuery:TableQuery<F>={
 search:"",filters:{logic:"AND",rules:[]},sort:{field:"name",direction:"asc"},
 group:null,order:[...columns],
 visible:["name","center","type","status","heartbeat","observation","lastSeen"],
 page:1,pageSize:15,
};
export const tvDefinition={
 version:1,classification:"TDD_DEFAULT",surface:"HO",key:"tvs",label:"TV",group:"Pinoria",
 fields:tvFields,capabilities:{read:P},
 table:{
  identity:{field:"name",pinned:"left",hideable:false,reorderable:false},
  columns:columns.map(field=>({field,visible:tvQuery.visible.includes(field as typeof tvQuery.visible[number])})),
  search:{fields:["name","center","type"],normalization:"vi-diacritic-insensitive"},
  filters:{fields:["center","type","status","heartbeat","observation"],mode:"flat",logic:"AND"},
  sort:{fields:["name","center","status","lastSeen"],mode:"single",nulls:"last",tieBreak:"record-id"},
  group:{fields:["center","type","status"],mode:"single"},
  views:{builtIn:[],saved:{kind:"local-ui"},actions:["add","apply","rename","delete","reorder"]},
  pagination:{sizes:[8,15,30],defaultSize:15,mode:"local-ui"},
  inlineEdit:{fields:[],enabled:false},
  interaction:{settings:["properties","grouping","filters","quick-views"],quickView:"separate-opener",keyboard:"canonical",undo:"local-ui-only"},
 },
 drawer:{density:"one-column",sections,actions:[]},
 detail:{overview:{sections},businessTabs:[],history:{kind:"unavailable",reason:"Lịch sử TV chưa có nguồn dữ liệu được cấp quyền."}},
} as const satisfies SurfaceDefinition<F>;

function statusForHealth(session:HoTvDeviceSession|undefined):Pick<Row,"heartbeat"|"ack"|"observation"|"lastSeen">{
 if(!session)return{heartbeat:"Chưa ghi nhận",ack:"Chưa xác nhận",observation:"NONE",lastSeen:"—"};
 return{
  heartbeat:session.heartbeatFresh?"Có tín hiệu":"Không cập nhật",
  ack:session.rendererAcknowledged?"Đã xác nhận":"Chưa xác nhận",
  observation:session.observationStatus,
  lastSeen:session.lastSeenAt,
 };
}
const latest=(sessions:readonly HoTvDeviceSession[]):HoTvDeviceSession|undefined=>
 [...sessions].sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt))[0];

async function load(scope:"HO"|"BO",fetcher:typeof fetch,signal:AbortSignal):Promise<readonly {row:Row}[]>{
 if(scope!=="HO")throw adapterError(403);
 const {displays,devices}=await loadHoTvDirectory(fetcher,signal);
 signal.throwIfAborted();
 const centers=[...new Set(displays.data.map(x=>x.scopeType==="CENTER"?x.scopeId:null).filter((x):x is string=>Boolean(x)))];
 const health=new Map(await Promise.all(centers.map(async centerId=>{
  const result=await loadHoTvOperatorHealth(centerId,fetcher,signal);
  signal.throwIfAborted();
  return[centerId,result.data.deviceSessions] as const;
 })));
 signal.throwIfAborted();
 return displays.data.map(d=>{
  const session=latest((health.get(d.scopeId||"")||[]).filter(s=>s.displayId===d.id));
  const assigned=devices.data.filter(x=>x.defaultDisplayId===d.id&&x.status==="ACTIVE").length;
  const row:Row={
   id:d.id,name:d.displayName,center:d.scopeType==="GLOBAL"?"Toàn hệ thống":d.centerName||d.scopeId||"—",
   type:d.runtimeType,status:d.status,resolution:d.targetAspectRatio,
   deviceCount:assigned,...statusForHealth(session),version:d.definitionVersion,
  };
  return{row};
 });
}
/** Every read is authenticated and Center-gated by the existing HO BFF/Core. */
export const tvProvider:SurfaceProvider<F>={
 pagination:"local-ui",
 async list(_query,scope,fetcher,signal){
  const records=await load(scope.surface,fetcher,signal);
  return{records,total:records.length};
 },
 async detail(id,scope,fetcher,signal){
  return(await load(scope.surface,fetcher,signal)).find(x=>x.row.id===id)||null;
 },
};
const hoScope=(surface:"BO"|"HO")=>{if(surface!=="HO")throw adapterError(403);return{surface:"HO" as const};};
const registry=new TddRegistry();
export const tvSchema=registry.register({...tvDefinition,data:{
 id:"ho-tv-directory",
 list:async(_query,context,signal)=>{
  const rows=await tvProvider.list(tvQuery,hoScope(context.surface),fetch,signal);
  return{rows:rows.records.map(x=>x.row),total:rows.total};
 },
 detail:async(id,context,signal)=>(await tvProvider.detail(id,hoScope(context.surface),fetch,signal))?.row||null,
}});
