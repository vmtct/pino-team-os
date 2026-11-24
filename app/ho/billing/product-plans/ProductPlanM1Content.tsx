"use client";
// PAP-2183 / PLT-PRODUCT-PLAN: one native typed renderer, isolated M1 commands.
import {useContext,useEffect,useMemo,useRef,useState} from "react";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {TddHostMenu} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import type {AuthorizationContext,MutationAdapter,TableQuery} from "@/lib/workspace-schema";
import {createPreviewState,reducePreview} from "@/lib/m1-preview/state";
import {productPlanM1,previewProductPlanUpdate} from "./product-plan-m1-preview";
import {planRegistry,planSchema,planQuery,projectPlan,PLAN_READ,PLAN_EDIT,type PlanFields} from "./schema";
export function ProductPlanM1Content({scopeKey,permissionKeys,initialRecord}:{scopeKey:string;permissionKeys:readonly string[];initialRecord?:string}){
 const menu=useContext(TddHostMenu);
 const context=useMemo<AuthorizationContext>(()=>({surface:"HO",authorize:key=>permissionKeys.includes(key)}),[permissionKeys]);
 const [state,setState]=useState(()=>createPreviewState(productPlanM1,scopeKey));
 const current=useRef(state);
 const [query,setQuery]=useState<TableQuery<PlanFields>>(planQuery);
 const [selected,setSelected]=useState<string|null>(initialRecord??null),[full,setFull]=useState(Boolean(initialRecord));
 const row=state.records.find(r=>r.id===selected);
 const canEdit=context.authorize(PLAN_READ)&&context.authorize(PLAN_EDIT);
 const adapter=useMemo<MutationAdapter<PlanFields>>(()=>({update:async(id,patch,expectedVersion,authorization,signal)=>{
   signal.throwIfAborted();
   if(authorization.surface!=="HO"||!authorization.authorize(PLAN_READ)||!authorization.authorize(PLAN_EDIT))return {status:"denied"};
   const old=current.current.records.find(r=>r.id===id);
   if(!old)return {status:"denied"};
   if(String(old.version)!==expectedVersion)return {status:"conflict"};
   const next=previewProductPlanUpdate(old,patch,old.version);
   if(!next)return {status:"invalid",fields:["price","badge","enabled"]};
   const updated=reducePreview(current.current,{type:"replace",id,record:next});
   current.current=updated;
   setState(updated);
   return {status:"saved",row:projectPlan(next),version:String(next.version)};
 }}),[]);
 const onSaved=()=>{};
 const versionForRow=(id:string)=>String(state.records.find(r=>r.id===id)?.version??"");
 const tableWrites=canEdit?{adapter,versionForRow,onSaved}:undefined;
 const recordWrites=canEdit&&row?{adapter,version:String(row.version),onSaved,directFields:["price","badge","enabled"]}:undefined;
 const common={registry:planRegistry,context};
 const navigate=(id:string|null)=>{
   if(self.origin==="null")return;
   const url=new URL(location.href);
   if(id)url.searchParams.set("record",id);else url.searchParams.delete("record");
   if(url.href!==location.href)history.pushState(null,"",url.pathname+url.search);
 };
 useEffect(()=>{
   if(self.origin==="null")return;
   const restore=()=>{const id=new URLSearchParams(location.search).get("record");setSelected(id);setFull(Boolean(id));};
   addEventListener("popstate",restore);
   return()=>removeEventListener("popstate",restore);
 },[]);
 const close=()=>{navigate(null);setSelected(null);setFull(false);};
 if(!context.authorize(PLAN_READ))return <p role="alert">Không có quyền truy cập gói học.</p>;
 return <TddPreferencePolicy.Provider value="ephemeral">
  {full&&row?<TddRenderer view={{kind:"detail",props:{...common,schema:planSchema,record:projectPlan(row),writes:recordWrites,subject:{type:"product_plan",id:row.id},mobileMenu:menu("detail-menu-btn"),onBack:close}}}/>:
  <TddRenderer view={{kind:"table",mobileMenu:menu("menu-btn"),props:{...common,schema:planSchema,query,rows:state.records.map(projectPlan),total:state.records.length,status:"ready",writes:tableWrites,onQueryChange:setQuery,onOpen:r=>{setSelected(r.id);setFull(false);}}}}/>}
  {selected&&!row&&<p role="alert">Gói học không tồn tại.</p>}
  {row&&!full&&<TddRenderer view={{kind:"drawer",props:{...common,schema:planSchema,record:projectPlan(row),writes:recordWrites,onClose:close,onDetail:()=>{navigate(row.id);setFull(true);}}}}/>}
 </TddPreferencePolicy.Provider>;
}
