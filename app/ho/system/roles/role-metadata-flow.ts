import {parseRoleInlineRequest,type RoleInlineRequest} from "@/lib/workspace-adapters/ho-inline-command-contract";
import {prepareRoleMetadataEdit,verifyRoleMetadataEdit,type MetadataEditCommand} from "./role-metadata-edit";

export type MetadataOutcome =
 | {status:"saved";receipt:unknown}
 | {status:"invalid"|"conflict"|"unavailable"|"uncertain"|"busy"};
type Ports = {
 read:(id:string,signal:AbortSignal)=>Promise<unknown>;
 submit:(command:MetadataEditCommand,signal:AbortSignal,patch:unknown)=>Promise<"accepted"|"conflict"|"rejected"|"uncertain">;
};

/** PAP-2373: transport-independent orchestration; no authorization or route admission.
 * An ambiguous submission is never automatically repeated. */
export function createRoleMetadataFlow(ports:Ports){
 const pending=new Set<string>();
 // Instance-local ambiguity fence: a new attempt requires a genuinely newer readback.
 const uncertainVersions=new Map<string,string>();
 return async (id:string,expectedVersion:string,patch:unknown,signal:AbortSignal):Promise<MetadataOutcome>=>{
  if(pending.has(id))return {status:"busy"};
  pending.add(id);
  let submitted=false;
  try{
   signal.throwIfAborted();
   const current=await ports.read(id,signal);
   signal.throwIfAborted();
   if(!current||typeof current!=="object"||!("id" in current)||current.id!==id)return {status:"invalid"};
   const unresolved=uncertainVersions.get(id);
   if(unresolved!==undefined&&(!("updatedAt" in current)||typeof current.updatedAt!=="string"||
      !(Date.parse(current.updatedAt)>Date.parse(unresolved))))return {status:"uncertain"};
   if(!("updatedAt" in current)||current.updatedAt!==expectedVersion)return {status:"conflict"};
   const command=prepareRoleMetadataEdit(current,expectedVersion,patch);
   if(!command)return {status:"invalid"};
   submitted=true;
   uncertainVersions.set(id,expectedVersion);
   const outcome=await ports.submit(command,signal,patch);
   if(outcome==="conflict"){uncertainVersions.delete(id);return {status:"conflict"};}
   if(outcome==="rejected"){uncertainVersions.delete(id);return {status:"unavailable"};}
   if(outcome!=="accepted")return {status:"uncertain"};
   signal.throwIfAborted();
   const receipt=await ports.read(id,signal);
   signal.throwIfAborted();
   if(!verifyRoleMetadataEdit(command,receipt))return {status:"uncertain"};
   uncertainVersions.delete(id);
   return {status:"saved",receipt};
  }catch{
   return {status:submitted?"uncertain":"unavailable"};
  }finally{
   pending.delete(id);
  }
 };
}

/** PAP-2373: injected transport for the already admitted exact Role edit endpoint.
 * Not mounted here; the caller must supply the existing authorized read boundary. */
export function createRoleMetadataClient(ports:{
 read:Ports["read"];
 fetcher:typeof fetch;
 idempotencyKey:()=>string;
}){
 const flow=createRoleMetadataFlow({
  read:ports.read,
  submit:async(command,signal,patch)=>{
   const request=parseRoleInlineRequest({id:command.roleId,expectedVersion:command.body.expectedUpdatedAt,patch});
   if(!request)return "rejected";
   signal.throwIfAborted();
   const response=await ports.fetcher("/api/ho/system/roles/"+encodeURIComponent(request.id)+"/update",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
    headers:{"content-type":"application/json","idempotency-key":ports.idempotencyKey()},
    body:JSON.stringify(request),
   });
   if(response.status===409)return "conflict";
   if([400,401,403,404,405].includes(response.status))return "rejected";
   if(response.status!==200)return "uncertain";
   const body:unknown=await response.json();
   if(!body||typeof body!=="object"||!("data" in body)||!verifyRoleMetadataEdit(command,body.data))return "uncertain";
   return "accepted";
  },
 });
 return async(input:RoleInlineRequest,signal:AbortSignal):Promise<MetadataOutcome>=>{
  const request=parseRoleInlineRequest(input);
  return request?flow(request.id,request.expectedVersion,request.patch,signal):{status:"invalid"};
 };
}
