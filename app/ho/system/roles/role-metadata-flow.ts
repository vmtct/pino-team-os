import {prepareRoleMetadataEdit,verifyRoleMetadataEdit,type MetadataEditCommand} from "./role-metadata-edit";

export type MetadataOutcome =
 | {status:"saved";receipt:unknown}
 | {status:"invalid"|"conflict"|"unavailable"|"uncertain"|"busy"};
type Ports = {
 read:(id:string,signal:AbortSignal)=>Promise<unknown>;
 submit:(command:MetadataEditCommand,signal:AbortSignal)=>Promise<"accepted"|"conflict"|"rejected">;
};

/** PAP-2373: transport-independent orchestration; no authorization or route admission.
 * An ambiguous submission is never automatically repeated. */
export function createRoleMetadataFlow(ports:Ports){
 const pending=new Set<string>();
 return async (id:string,expectedVersion:string,patch:unknown,signal:AbortSignal):Promise<MetadataOutcome>=>{
  if(pending.has(id))return {status:"busy"};
  pending.add(id);
  let submitted=false;
  try{
   signal.throwIfAborted();
   const current=await ports.read(id,signal);
   signal.throwIfAborted();
   if(!current||typeof current!=="object"||!("id" in current)||current.id!==id)return {status:"invalid"};
   if(!("updatedAt" in current)||current.updatedAt!==expectedVersion)return {status:"conflict"};
   const command=prepareRoleMetadataEdit(current,expectedVersion,patch);
   if(!command)return {status:"invalid"};
   submitted=true;
   const outcome=await ports.submit(command,signal);
   if(outcome==="conflict")return {status:"conflict"};
   if(outcome==="rejected")return {status:"unavailable"};
   if(outcome!=="accepted")return {status:"uncertain"};
   signal.throwIfAborted();
   const receipt=await ports.read(id,signal);
   signal.throwIfAborted();
   return verifyRoleMetadataEdit(command,receipt)?{status:"saved",receipt}:{status:"uncertain"};
  }catch{
   return {status:submitted?"uncertain":"unavailable"};
  }finally{
   pending.delete(id);
  }
 };
}
