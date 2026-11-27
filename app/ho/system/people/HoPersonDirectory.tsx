"use client";
/** PAP-2180: canonical typed TDD binding; no bespoke table or record shell. */
import {useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import type {AuthorizationContext,ModuleRow,TableQuery} from "@/lib/workspace-schema";
import type {BoRecord} from "@/lib/bo-registration";
import {PersonReadError} from "./person-read-client";
import {personSchema,registry,personPreviewSchema,previewRegistry,READ,VIEW_AS,VIEW_AS_TAB,queryDefault,type PersonFields} from "./schema";
import {SUPPORT_FIXTURE_ID} from "./person-support-preview";
export type PersonRow=BoRecord & {roles:string[];avatarState:string;identityState:string;student:string|null;staff:string|null;parent:string|null;guest:string|null;avatarId:string|null;nickname:string|null};
const projection=(r:PersonRow):ModuleRow<PersonFields>=>({id:r.id,personId:r.id,name:r.name,roles:r.roles,avatarState:r.avatarState,identityState:r.identityState,student:r.student,staff:r.staff,parent:r.parent,guest:r.guest,avatarId:r.avatarId,nickname:r.nickname,createdAt:typeof r.createdAt==="string"?r.createdAt:null,createdBy:typeof r.createdBy==="string"?r.createdBy:null,updatedAt:typeof r.updatedAt==="string"?r.updatedAt:null,updatedBy:typeof r.updatedBy==="string"?r.updatedBy:null});
const routeId=()=>new URLSearchParams(window.location.search).get("record");
function setRoute(id:string|null){const u=new URL(window.location.href);if(id)u.searchParams.set("record",id);else u.searchParams.delete("record");window.history.pushState(null,"",u.pathname+u.search);}
type RecordStatus="ready"|"loading"|"error"|"denied"|"not-found";
export function HoPersonDirectory({rows,loadState="ready",onRetry,loadDetail,counts,renderSupportPreview}:{rows:PersonRow[];loadState?:string;onRetry?:()=>void;loadDetail?:(id:string,signal:AbortSignal)=>Promise<PersonRow>;counts?:{students:number;staff:number;parents?:number};renderSupportPreview?:(person:PersonRow)=>ReactNode}){
 const menu=useContext(TddHostMenu);
 const [query,setQuery]=useState<TableQuery<PersonFields>>(queryDefault);
 const [selected,setSelected]=useState<string|null>(null),[mode,setMode]=useState<"drawer"|"detail"|null>(null);
 const [attempt,retry]=useState(0);
 const [denied,setDenied]=useState(false);
 const [detail,setDetail]=useState<{id:string;row:PersonRow|null;status:RecordStatus}|null>(null);
 const opener=useRef<HTMLElement|null>(null);
 const preview=Boolean(renderSupportPreview&&!loadDetail&&rows.length===1&&rows[0].id===SUPPORT_FIXTURE_ID);
 const activeRegistry=preview?previewRegistry:registry,activeSchema=preview?personPreviewSchema:personSchema;
 const context:AuthorizationContext={surface:"HO",authorize:key=>!denied&&loadState!=="denied"&&(key===READ||(preview&&key===VIEW_AS))};
 const person=loadDetail?detail?.id===selected?detail.row:null:rows.find(r=>r.id===selected);
 const status:RecordStatus=loadDetail?detail?.id===selected?detail.status:"loading":person?"ready":"not-found";
 useEffect(()=>{const restore=()=>{const id=routeId();setSelected(id);setMode(id?"detail":null);};restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);},[]);
 useEffect(()=>{if(!selected||!mode||!loadDetail)return;const controller=new AbortController();
  void loadDetail(selected,controller.signal).then(row=>{if(!controller.signal.aborted)setDetail({id:selected,row,status:"ready"});}).catch((error:unknown)=>{if(controller.signal.aborted)return;const s:RecordStatus=error instanceof PersonReadError&&[401,403].includes(error.status)?"denied":error instanceof PersonReadError&&error.status===404?"not-found":"error";if(s==="denied")setDenied(true);setDetail({id:selected,row:null,status:s});});
  return()=>controller.abort();
 },[selected,mode,loadDetail,attempt]);
 const close=()=>{if(routeId())setRoute(null);setSelected(null);setMode(null);setDetail(null);requestAnimationFrame(()=>opener.current?.focus({preventScroll:true}));};
 const open=useCallback((row:BoRecord)=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setDetail(null);setSelected(row.id);setMode("drawer");},[]);
 const full=()=>{if(person){setRoute(person.id);setMode("detail");}};
 const record=person?projection(person):{id:selected??""} as ModuleRow<PersonFields>;
 const common={registry:activeRegistry,schema:activeSchema,context,record,status,onRetry:()=>{setDetail(null);retry(n=>n+1);}};
 if(denied||loadState==="denied")return <p role="alert">Bạn không có quyền xem Person.</p>;
 return <>
 {counts&&(counts.students>0||counts.staff>0||(counts.parents??0)>0)&&<p role="status">Student: {counts.students} · Staff: {counts.staff}{counts.parents!==undefined&&<> · Parent: {counts.parents}</>} chưa liên kết Person.</p>}
 <div hidden={mode==="detail"}><TddRenderer view={{kind:"table",mobileMenu:menu("menu-btn"),props:{registry:activeRegistry,schema:activeSchema,context,rows:rows.map(projection),query,onQueryChange:setQuery,onOpen:open,status:loadState==="ready"?"ready":loadState==="loading"?"loading":"error",onRetry}}}/></div>
 {mode==="drawer"&&selected&&<TddRenderer view={{kind:"drawer",props:{...common,schema:activeSchema,onClose:close,onDetail:full}}}/>}
 {mode==="detail"&&selected&&<TddRenderer view={{kind:"detail",props:{...common,schema:activeSchema,subject:{type:"person",id:selected},mobileMenu:menu("detail-menu-btn"),onBack:close,returnFocus:()=>opener.current,renderApprovedExtension:preview&&person&&status==="ready"?(_record,_context,tab)=><div hidden={tab!==VIEW_AS_TAB}>{renderSupportPreview?.(person)}</div>:undefined}}}/>}
 </>;
}
