/** PAP-2371: feature-owned live projection and command fence; no mock fallback. */
import {mapHoCenters} from "@/lib/ho-centers";
import {readData} from "@/lib/workspace-adapters/providers";
import type {ModuleRow} from "@/lib/workspace-schema";
import type {SpaceSchemaFields} from "./schema";
import {SpaceApiError,type SpaceDto,type SpaceFields,type SpaceReceipt,type createLearningSpaceClient} from "./learning-space-client";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type CenterOption={id:string;name:string};
export async function loadSpaceCenters(fetcher:typeof fetch,signal:AbortSignal):Promise<CenterOption[]>{
 const centers=mapHoCenters(await readData(fetcher,"centers",signal));
 return centers.filter(c=>c.status==="active").map(c=>{if(!ID.test(c.id)||typeof c.name!=="string")throw Error("Invalid Center identity");return {id:c.id,name:c.name};});
}
export function projectLiveSpace(p:SpaceDto):ModuleRow<SpaceSchemaFields>{return {id:p.id,name:p.displayName,code:p.code,center:p.centerName,optimalCapacity:p.optimalConcurrentCapacity,hardCapacity:p.hardConcurrentCapacity,status:p.status,createdAt:p.createdAt,createdBy:p.createdBy??"—",updatedAt:p.updatedAt,updatedBy:p.updatedBy??"—",spaceId:p.id,version:p.version};}
export function mergeSpacePatch(row:SpaceDto,patch:Record<string,unknown>):SpaceFields{
 const allowed={name:"displayName",code:"code",optimalCapacity:"optimalConcurrentCapacity",hardCapacity:"hardConcurrentCapacity",status:"status"} as const;
 const mapped:Record<string,unknown>={};
 for(const [k,v] of Object.entries(patch)){if(!Object.hasOwn(allowed,k))throw Error("Unsupported property");mapped[allowed[k as keyof typeof allowed]]=v;}
 if(!Object.keys(mapped).length)throw Error("Empty patch");
 const b={centerId:row.centerId,code:row.code,displayName:row.displayName,optimalConcurrentCapacity:row.optimalConcurrentCapacity,hardConcurrentCapacity:row.hardConcurrentCapacity,status:row.status,...mapped} as SpaceFields;
 return validated(b);
}
function validated(b:SpaceFields):SpaceFields{
 if(!ID.test(b.centerId)||typeof b.code!=="string"||typeof b.displayName!=="string"||!b.displayName.trim()||b.displayName.trim().length>200||! /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(b.code.trim().toLowerCase())||b.code.trim().length>64||!Number.isSafeInteger(b.optimalConcurrentCapacity)||b.optimalConcurrentCapacity<1||b.hardConcurrentCapacity!==null&&(!Number.isSafeInteger(b.hardConcurrentCapacity)||b.hardConcurrentCapacity<b.optimalConcurrentCapacity)||!["ACTIVE","INACTIVE","ARCHIVED"].includes(b.status))throw Error("Invalid Space fields");
 return {centerId:b.centerId,code:b.code.trim().toLowerCase(),displayName:b.displayName.trim(),optimalConcurrentCapacity:b.optimalConcurrentCapacity,hardConcurrentCapacity:b.hardConcurrentCapacity,status:b.status};
}
export type SpaceCommand={kind:"create";fields:SpaceFields}|{kind:"update";id:string;version:number;fields:SpaceFields}|{kind:"delete";id:string;version:number;centerId:string};
type Attempt={key:string;command:SpaceCommand;uncertain:boolean};
type Receipt=SpaceReceipt|{id:string;deleted:true};
type Client=Pick<ReturnType<typeof createLearningSpaceClient>,"create"|"update"|"remove"|"detail">;
export type CommandResult={status:"saved";row:SpaceDto|null}|{status:"conflict"|"denied"|"invalid"|"uncertain"|"busy"};
function snapshot(command:SpaceCommand):SpaceCommand{
 if(command.kind!=="create"&&(!ID.test(command.id)||!Number.isSafeInteger(command.version)||command.version<1))throw Error("Invalid command identity");
 if(command.kind==="delete"){if(!ID.test(command.centerId))throw Error("Invalid Center");return {kind:"delete",id:command.id,version:command.version,centerId:command.centerId};}
 const fields=validated(command.fields);
 return command.kind==="create"?{kind:"create",fields}:{kind:"update",id:command.id,version:command.version,fields};
}
export function createSpaceCommandFence(client:Client,newKey:()=>string=()=>crypto.randomUUID()){
 let attempt:Attempt|null=null,running=false;
 async function run():Promise<CommandResult>{
  if(running||!attempt)return {status:"busy"};
  const a=attempt,c=a.command;running=true;
  let acknowledged=false;
  try{
   let r:Receipt;
   if(c.kind==="create")r=await client.create(c.fields,a.key);
   else if(c.kind==="update")r=await client.update(c.id,c.fields,c.version,a.key);
   else r=await client.remove(c.id,c.centerId,c.version,a.key);
   acknowledged=true;
   if(c.kind==="delete"){
    try{await client.detail(r.id);throw Error("Deleted record still present");}catch(e){if(!(e instanceof SpaceApiError)||e.status!==404)throw e;}
    attempt=null;return {status:"saved",row:null};
   }
   const row=await client.detail(r.id);
   if("deleted" in r||row.id!==r.id||row.version<r.version||row.centerId!==c.fields.centerId)throw Error("Readback mismatch");
   attempt=null;return {status:"saved",row};
  }catch(e){
   if(acknowledged||a.uncertain||!(e instanceof SpaceApiError)||e.uncertain){a.uncertain=true;return {status:"uncertain"};}
   attempt=null;return {status:e.status===409?"conflict":e.status===401||e.status===403?"denied":"invalid"};
  }finally{running=false;}
 }
 return {
  get blocked(){return attempt!==null;},
  get uncertain(){return attempt?.uncertain===true;},
  async submit(command:SpaceCommand):Promise<CommandResult>{
   if(running||attempt)return {status:"busy"};
   let c:SpaceCommand;try{c=snapshot(command);}catch{return {status:"invalid"};}
   attempt={key:newKey(),command:c,uncertain:false};return run();
  },
  async retry():Promise<CommandResult>{if(!attempt?.uncertain)return {status:"busy"};return run();}
 };
}
