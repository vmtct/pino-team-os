"use client";
import {useLayoutEffect,useRef,useState} from "react";
import {PropertyEditor,type PropertyCommitResult} from "@pino/design-system/react";
import {ROLE_METADATA_COMMAND,parseRoleInlineRequest,roleInlineSelection,type RoleInlineRequest} from "@/lib/workspace-adapters/ho-inline-command-contract";
import type {AuthorizationContext,FieldSchema} from "@/lib/workspace-schema";

type Outcome={status:"saved";receipt:unknown}|{status:"invalid"|"conflict"|"unavailable"|"uncertain"|"busy"};
/** PAP-1247: exact Role command only, not a generic mutation adapter. */
export type RoleMetadataBinding=Readonly<{
 command:typeof ROLE_METADATA_COMMAND;
 commit:(request:RoleInlineRequest,signal:AbortSignal)=>Promise<Outcome>;
}>;
type HostSchema={surface:string;key:string;capabilities:{read:string;edit?:string};fields:readonly FieldSchema[];table:{inlineEdit:{enabled:boolean;fields:readonly string[]}}};
type SelectionProps={
 host:"table"|"drawer";schema:HostSchema;context:AuthorizationContext;
 row:Readonly<Record<string,unknown>>;version:string|undefined;field:string;binding:RoleMetadataBinding;
};
export function roleHostSelection({host,schema,context,row,version,field,binding}:SelectionProps){
 if(binding.command!==ROLE_METADATA_COMMAND||schema.surface!=="HO"||schema.key!=="roles"||
    schema.capabilities.read!=="access.role.view"||schema.capabilities.edit!==undefined||
    schema.table.inlineEdit.enabled||schema.table.inlineEdit.fields.length||
    schema.fields.some(f=>f.capabilities.inlineEdit)||context.surface!=="HO")return null;
 const metadata=schema.fields.find(f=>f.key===field);
 if(!metadata||metadata.permission!=="access.role.view"||!metadata.capabilities.display||
    !metadata.readOnly||metadata.type!==(field==="name"?"text":"textarea"))return null;
 return roleInlineSelection({host,surface:schema.surface,moduleKey:schema.key,
  canRead:context.authorize("access.role.view"),canEdit:context.authorize("access.role.edit"),
  row,version,field});
}
function verifiedValue(row:Readonly<Record<string,unknown>>,request:RoleInlineRequest,field:"name"|"description",receipt:unknown):string|null{
 if(!receipt||typeof receipt!=="object"||Array.isArray(receipt))return null;
 const result=receipt as Record<string,unknown>;
 const expectedName=request.patch.name??row.name;
 const expectedDescription=request.patch.description===undefined?row.description||null:request.patch.description||null;
 if(result.id!==request.id||result.roleKey!==row.roleKey||result.roleType!=="custom"||result.status!=="active"||
    result.displayName!==expectedName||result.description!==expectedDescription||
    typeof result.updatedAt!=="string"||!Number.isFinite(Date.parse(result.updatedAt))||
    new Date(result.updatedAt).toISOString()!==result.updatedAt||Date.parse(result.updatedAt)<=Date.parse(request.expectedVersion)||
    !Array.isArray(result.permissionKeys)||result.permissionKeys.some(k=>typeof k!=="string")||
    new Set(result.permissionKeys).size!==result.permissionKeys.length||
    result.permissionCount!==result.permissionKeys.length||result.permissionCount!==row.permissionCount)return null;
 const value=field==="name"?result.displayName:result.description??"";
 return typeof value==="string"?value:null;
}
/** Unmounted native presentation host. The module's existing separately authorized
 * command owns fresh reads and persistence; this component never opens a transport. */
export function RoleMetadataPropertyHost(props:SelectionProps&{
 anchor:HTMLElement;onSaved:()=>void;onClose:()=>void;
}){
 const latest=useRef(props);
 useLayoutEffect(()=>{latest.current=props;},[props]);
 const [blocked,setBlocked]=useState(false);
 const [reviewed]=useState(()=>({selection:roleHostSelection(props),binding:props.binding}));
 const selection=roleHostSelection(props);
 const matches=(current:SelectionProps)=>{
  const now=roleHostSelection(current),original=reviewed.selection;
  return !blocked&&!!now&&!!original&&now.id===original.id&&now.field===original.field&&
   now.expectedVersion===original.expectedVersion&&current.binding===reviewed.binding;
 };
 const canEdit=()=>matches(props);
 if(!selection)return null;
 const metadata=props.schema.fields.find(f=>f.key===selection.field)!;
 return <PropertyEditor field={{key:selection.field,label:metadata.label,type:selection.field==="name"?"text":"textarea",required:selection.field==="name"}}
   value={String(props.row[selection.field])} anchor={props.anchor} surface="ho"
   canEdit={canEdit} onClose={props.onClose} onSaved={()=>latest.current.onSaved()}
   onCommit={async(value,{signal}):Promise<PropertyCommitResult>=>{
    if(signal.aborted||!matches(latest.current))return {status:"denied"};
    const request=parseRoleInlineRequest({id:selection.id,expectedVersion:selection.expectedVersion,patch:{[selection.field]:value}});
    if(!request)return {status:"error"};
    try{
     const result=await props.binding.commit(request,signal);
     if(signal.aborted)return {status:"error"};
     if(result.status==="saved"){
      const saved=verifiedValue(props.row,request,selection.field,result.receipt);
      if(saved!==null&&matches(latest.current))return {status:"saved",value:saved};
      setBlocked(true);return {status:"conflict"};
     }
     if(result.status==="uncertain"||result.status==="conflict"){setBlocked(true);return {status:"conflict"};}
     return {status:"error"};
    }catch{if(!signal.aborted)setBlocked(true);return {status:"error"};}
   }}/>;
}
