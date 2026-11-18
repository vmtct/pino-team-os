"use client";
/** PAP-2132 / PAP-1491 — the original Specialty schema/renderer, never a grant projection.
 * Host supplies a real authorized Catalog read binding; absent binding is denied.
 * No BO-to-HO permission bridge or delivery endpoint is created by this component. */
import {useEffect,useState} from "react";
import {TddDrawer,RecordState} from "@/app/components/workspace-renderer/Record";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import type {AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import type {ModuleRow} from "@/lib/workspace-schema";
import type {specialtyFields} from "@/app/ho/learning/specialties/schema";
import {BoApiError} from "@/lib/bo-api-error";
type F=typeof specialtyFields;
export type LinkedSpecialtySubject={specialtyId:string;pathProgramId:string;subscriptionId:string;centerId:string};
export type LinkedSpecialtyBinding={openAuthorized:(subject:LinkedSpecialtySubject,signal:AbortSignal)=>Promise<AuthenticatedSurfaceAdapter<F>>;openDetail:(subject:LinkedSpecialtySubject)=>void};
type State={status:"loading"|"error"|"denied"|"not-found"}|{status:"ready";adapter:AuthenticatedSurfaceAdapter<F>;row:ModuleRow<F>};
export function BoLinkedSpecialtyDrawer({subject,binding,onClose}:{subject:LinkedSpecialtySubject;binding?:LinkedSpecialtyBinding;onClose:()=>void}){
 const [state,setState]=useState<State>({status:"loading"}),[retry,setRetry]=useState(0);
 const {specialtyId,pathProgramId,subscriptionId,centerId}=subject;
 useEffect(()=>{const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|undefined;
  if(!binding){setState({status:"denied"});return;}setState({status:"loading"});
  void binding.openAuthorized({specialtyId,pathProgramId,subscriptionId,centerId},controller.signal).then(async result=>{
   adapter=result;if(controller.signal.aborted){result.dispose();return;}
   if(result.schema.key!=="specialties"||result.schema.surface!=="HO"||!result.capabilities.read)throw new BoApiError(403,"Không có quyền xem Chuyên đề.",null);
   const detail=await result.detail(specialtyId,controller.signal);if(controller.signal.aborted)return;
   if(!detail){setState({status:"not-found"});return;}if(detail.row.id!==specialtyId)throw Error("Specialty identity mismatch");
   setState({status:"ready",adapter:result,row:detail.row});
  }).catch(error=>{if(!controller.signal.aborted)setState({status:error instanceof BoApiError&&[401,403].includes(error.status)?"denied":error instanceof BoApiError&&error.status===404?"not-found":"error"});});
  return()=>{controller.abort();adapter?.dispose();};
 },[binding,specialtyId,pathProgramId,subscriptionId,centerId,retry]);
 if(state.status==="ready"&&binding)return <TddDrawer registry={state.adapter.registry} schema={state.adapter.schema} context={state.adapter.context} record={state.row} onClose={onClose} onDetail={()=>binding.openDetail(subject)}/>;
 return <DrawerFrame title="Chuyên đề" path="Chuyên đề" onClose={onClose} footer={<button type="button" id="full-detail" className="primary-btn" disabled>↗ Full Detail</button>}><RecordState status={state.status} onRetry={()=>setRetry(n=>n+1)}/></DrawerFrame>;
}
