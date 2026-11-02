import type { DialogueConfig } from "./pap657-dialogue-config";
export type DialogueScope = {kind:"DEFAULT"} | {kind:"CENTER";centerId:string};
export type DialogueVersion = {id:string;revision:number;createdBy:string;createdAt:string;applied:boolean};
export type DialogueHead = {revision:number;active_version_id:string|null};
const ROOT="/api/bo/pinoria/tv-config/dialogue/";
export function dialogueReadPath(action:"head"|"versions"|"version"|"active",scope:DialogueScope,versionId?:string){
 const q=new URLSearchParams();
 if(action==="active"){
  if(scope.kind!=="CENTER")throw new Error("Center required");
  q.set("centerId",scope.centerId);
 }else{
  q.set("scope",scope.kind);
  if(scope.kind==="CENTER")q.set("centerId",scope.centerId);
  if(action==="version"){if(!versionId)throw new Error("Version required");q.set("versionId",versionId);}
 }
 return ROOT+action+"?"+q.toString();
}
async function read<T>(request:Promise<Response>):Promise<T>{
 const response=await request;
 let payload:unknown;
 try{payload=await response.json();}catch{throw new Error("Dialogue config returned invalid JSON");}
 const body=payload as {data?:T;error?:{message?:string}};
 if(!response.ok)throw new Error(body?.error?.message??"Dialogue config operation failed");
 if(!body||!("data" in body))throw new Error("Dialogue config response missing data");
 return body.data as T;
}
export const dialogueConfigApi={
 head:(scope:DialogueScope)=>read<DialogueHead|null>(fetch(dialogueReadPath("head",scope),{cache:"no-store"})),
 versions:(scope:DialogueScope)=>read<DialogueVersion[]>(fetch(dialogueReadPath("versions",scope),{cache:"no-store"})),
 version:(scope:DialogueScope,id:string)=>read<{id:string;revision:number;applied:boolean;configuration:DialogueConfig}|null>(fetch(dialogueReadPath("version",scope,id),{cache:"no-store"})),
 active:(centerId:string)=>read<{configuration:DialogueConfig;appliedVersion:string;scope:string}|null>(fetch(dialogueReadPath("active",{kind:"CENTER",centerId}),{cache:"no-store"})),
 write:(command:"drafts"|"publish"|"revert",body:unknown)=>read<Record<string,unknown>>(fetch(ROOT+command,{
  method:"POST",cache:"no-store",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
  body:JSON.stringify(body),
 })),
};
