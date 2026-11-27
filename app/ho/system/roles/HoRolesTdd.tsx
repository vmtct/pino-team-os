"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry,type ModuleSchema} from "@/lib/workspace-schema";
import {recordProjection} from "@/app/components/workspace-renderer/projection";
import type {OverviewProperties} from "@/app/components/workspace-renderer/Properties";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {roleDefinition,roleFields,roleProvider,roleQuery,verifyRolePermissionTabApproval} from "./schema";
import {HoRoleEditor,type RolePresentationTransport} from "./HoRoleEditor";
import {createRoleMetadataFence,createRoleMetadataClient} from "./role-metadata-flow";
import {ROLE_METADATA_COMMAND,type RoleMetadataPresentation} from "@/lib/workspace-adapters/ho-inline-command-contract";
import {RoleMetadataPropertyHost,type RoleMetadataBinding} from "./RoleMetadataPropertyHost";
import {boApi} from "@/lib/bo-api";
import {CreateCustomRoleFields} from "./RoleLifecycleForms";
import {useRoleCreateFlow,type RoleCreateOutcome} from "./useRoleCreateFlow";
import {verifyCreatedRole,type RoleCreateInput} from "./role-lifecycle-model";

type F=typeof roleFields;
// PAP-2408: one native Overview while preserving the existing editor interlock.
function nativeRoleOverview(schema:ModuleSchema,context:Ready["adapter"]["context"],row:Readonly<Record<string,unknown>>):OverviewProperties|undefined{
 const projection=recordProjection(schema,context,row);
 if(!projection)return undefined;
 return {record:projection.record,fields:[...projection.fields,{key:"id",label:"Role ID",type:"id",icon:"ID",w:180,readonly:true}],
  sections:schema.detail.overview.sections.map(section=>({...section,fields:section.id==="role-info"?[...section.fields,"id"]:section.fields}))};
}
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
type SubmitCreate=(input:RoleCreateInput)=>Promise<RoleCreateOutcome>;
async function submitNativeCreate(input:RoleCreateInput):Promise<RoleCreateOutcome>{
 const response=await fetch("/api/ho/system/roles/create",{
  method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
  headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(input),
 });
 if(response.status===409)return{state:"conflict"};
 if(response.status===400)return{state:"invalid"};
 if([401,403,404].includes(response.status))return{state:"denied"};
 if(response.status!==201)return{state:"unverified"};
 const payload:unknown=await response.json();
 const receipt=payload&&typeof payload==="object"&&"data" in payload?payload.data:null;
 if(!receipt||typeof receipt!=="object"||!("id" in receipt)||typeof receipt.id!=="string"||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(receipt.id)||
 !verifyCreatedRole(input,receipt))return{state:"unverified"};
 return{state:"verified",receipt};
}

/** Existing native Table/Drawer/Detail shell. No fallback mutation transport. */
export function ReadyRoles({ready,submitCreate,onVerified,nativeLifecycle=false,transport}:{ready:Ready;submitCreate?:SubmitCreate;onVerified:()=>void;nativeLifecycle?:boolean;transport?:RolePresentationTransport}){
 const {adapter}=ready;
 const [metadataFence]=useState(createRoleMetadataFence);
 const [metadataBinding]=useState<RoleMetadataBinding>(()=>({command:ROLE_METADATA_COMMAND,commit:createRoleMetadataClient({read:(id,signal)=>boApi.accessRole(id,(input,init)=>(transport?.fetcher??fetch)(input,{...init,signal})),fetcher:(input,init)=>(transport?.fetcher??fetch)(input,init),idempotencyKey:()=>transport?transport.idempotencyKey():crypto.randomUUID()},metadataFence)}));
 const roleMetadata:RoleMetadataPresentation|undefined=nativeLifecycle?{command:ROLE_METADATA_COMMAND,render:props=><RoleMetadataPropertyHost key={JSON.stringify([props.host,props.row.id,props.field,props.version])} host={props.host} row={props.row} version={props.version} field={props.field} anchor={props.anchor} onClose={props.onClose} onSaved={props.onSaved} schema={adapter.schema} context={adapter.context} binding={metadataBinding}/>}:undefined;
 const authorized=adapter.schema.capabilities.create==="access.role.create" &&
   adapter.context.authorize("access.role.view") && adapter.context.authorize("access.role.create");
 const flow=useRoleCreateFlow(authorized,submitCreate,onVerified);
 return <>
   <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={roleQuery} actionBindings={flow.bindings} roleMetadata={roleMetadata}
      detailProperties={nativeLifecycle?()=>null:undefined}
      detailApprovedExtension={(row,context,activeTab,_principalId,onSaved)=> <HoRoleEditor key={row.id} roleId={row.id}
        nativeOverview={nativeLifecycle?nativeRoleOverview(adapter.schema as unknown as ModuleSchema,context,row):undefined} transport={transport}
        assignmentCount={Number(row.assignmentCount)} activeTab={activeTab}
        onSaved={onSaved} authorized={context.authorize("access.role.edit")} metadataFence={metadataFence} metadataAuthorized={nativeLifecycle&&context.authorize("access.role.view")&&context.authorize("access.role.edit")} archiveAuthorized={nativeLifecycle&&context.authorize("access.role.archive")} />} />
   {flow.uncertain&&<p role="alert">Chưa xác minh được Role. Tải lại và kiểm tra danh sách trước khi thử lại.</p>}
   {flow.open&&<TddRenderer view={{kind:"form",props:{registry:adapter.registry,schema:adapter.schema,context:adapter.context,mode:"create",title:"Tạo vai trò",onClose:flow.close,actionBindings:flow.bindings,content:<CreateCustomRoleFields draft={flow.draft} onChange={flow.setDraft} disabled={flow.busy}/>}}}/>}
 </>;
}

/** Canonical HO TDD controller; capability is presented only if an independent domain command is supplied. */
export function HoRolesTdd({submitCreate,nativeLifecycle=false}:{submitCreate?:SubmitCreate;nativeLifecycle?:boolean}={}){
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
    ? <ReadyRoles key={ready.adapter.userId} ready={ready} submitCreate={submitCreate??(nativeLifecycle?submitNativeCreate:undefined)} nativeLifecycle={nativeLifecycle} onVerified={reload}/>
    : <p role="status">Đang tải Roles…</p>;
 return <HoWorkspace module="roles" content={content}/>;
}
