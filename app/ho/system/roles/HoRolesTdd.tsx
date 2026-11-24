"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {roleDefinition,roleFields,roleProvider,roleQuery,verifyRolePermissionTabApproval} from "./schema";
import {HoRoleEditor} from "./HoRoleEditor";
import {CreateCustomRoleFields} from "./RoleLifecycleForms";
import {useRoleCreateFlow,type RoleCreateOutcome} from "./useRoleCreateFlow";
import type {RoleCreateInput} from "./role-lifecycle-model";

type F=typeof roleFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
type SubmitCreate=(input:RoleCreateInput)=>Promise<RoleCreateOutcome>;

/** Existing native Table/Drawer/Detail shell. No fallback mutation transport. */
export function ReadyRoles({ready,submitCreate,onVerified}:{ready:Ready;submitCreate?:SubmitCreate;onVerified:()=>void}){
 const {adapter}=ready;
 const authorized=adapter.schema.capabilities.create==="access.role.create" &&
   adapter.context.authorize("access.role.view") && adapter.context.authorize("access.role.create");
 const flow=useRoleCreateFlow(authorized,submitCreate,onVerified);
 return <>
   <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={roleQuery} actionBindings={flow.bindings}
      detailApprovedExtension={(row,context,activeTab,_principalId,onSaved)=> <HoRoleEditor key={row.id} roleId={row.id}
        assignmentCount={Number(row.assignmentCount)} activeTab={activeTab}
        onSaved={onSaved} authorized={context.authorize("access.role.edit")} />} />
   {flow.uncertain&&<p role="alert">Chưa xác minh được Role. Tải lại và kiểm tra danh sách trước khi thử lại.</p>}
   {flow.open&&<TddRenderer view={{kind:"form",props:{registry:adapter.registry,schema:adapter.schema,context:adapter.context,mode:"create",title:"Tạo vai trò",onClose:flow.close,actionBindings:flow.bindings,content:<CreateCustomRoleFields draft={flow.draft} onChange={flow.setDraft} disabled={flow.busy}/>}}}/>}
 </>;
}

/** Canonical HO TDD controller; capability is presented only if an independent domain command is supplied. */
export function HoRolesTdd({submitCreate}:{submitCreate?:SubmitCreate}={}){
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(verifyRolePermissionTabApproval),definition:roleDefinition,provider:roleProvider},controller.signal)
    .then(result=>{
      adapter=result;
      if(controller.signal.aborted){result.dispose();return;}
      const navigation=browserTddNavigation("HO","roles",roleQuery);
      setReady({adapter:result,navigation});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>{controller.abort();adapter?.dispose();};
 },[retry]);
 const reload=()=>{setReady(null);setError(false);setRetry(n=>n+1);};
 const content=error
  ? <p role="alert">Không tải được Roles. <button type="button" onClick={reload}>Thử lại</button></p>
  : ready
    ? <ReadyRoles key={ready.adapter.userId} ready={ready} submitCreate={submitCreate} onVerified={reload}/>
    : <p role="status">Đang tải Roles…</p>;
 return <HoWorkspace module="roles" content={content}/>;
}
