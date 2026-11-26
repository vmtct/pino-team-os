/** PAP-2288 / PAP-2398 / PLT-LEAD — exact committed-only read port, no replay. */
import {LeadApiError} from "./bo-lead-household-client";
const kinds=["create","contact","addMember","updateMember","retireMember","primary","addRelation","updateRelation","confirmRelation","retireRelation","archive"] as const;
export type LeadRecoveryKind=typeof kinds[number];
export type LeadRecoveryInput={kind:"create";key:string;target:null;expectedVersion:null}|{kind:Exclude<LeadRecoveryKind,"create">;key:string;target:string;expectedVersion:number};
export type LeadRecoveryReceipt={leadId:string;version:number;created?:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function exact(v:Record<string,unknown>,fields:string[]){return Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));}
function positive(v:unknown):v is number{return typeof v==="number"&&Number.isSafeInteger(v)&&v>0;}
export function parseLeadRecoveryInput(v:unknown):LeadRecoveryInput|null{
 if(!object(v)||!exact(v,["kind","key","target","expectedVersion"])||typeof v.kind!=="string"||!kinds.includes(v.kind as LeadRecoveryKind)||typeof v.key!=="string"||!/^[A-Za-z0-9_-]{16,128}$/.test(v.key))return null;
 if(v.kind==="create")return v.target===null&&v.expectedVersion===null?{kind:"create",key:v.key,target:null,expectedVersion:null}:null;
 if(typeof v.target!=="string"||!uuid.test(v.target)||!positive(v.expectedVersion))return null;
 return {kind:v.kind as Exclude<LeadRecoveryKind,"create">,key:v.key,target:v.target,expectedVersion:v.expectedVersion};
}
export function parseLeadRecoveryReceipt(v:unknown,input:LeadRecoveryInput):LeadRecoveryReceipt|null{
 if(!object(v)||!exact(v,input.kind==="create"?["leadId","version","created"]:["leadId","version"])||typeof v.leadId!=="string"||!uuid.test(v.leadId)||!positive(v.version))return null;
 if(input.kind==="create")return typeof v.created==="boolean"?{leadId:v.leadId,version:v.version,created:v.created}:null;
 return v.leadId===input.target&&v.version===input.expectedVersion+1?{leadId:v.leadId,version:v.version}:null;
}
export function createLeadRecoveryApi(fetcher:typeof fetch=fetch){
 return async(raw:LeadRecoveryInput,signal?:AbortSignal):Promise<LeadRecoveryReceipt>=>{
  const input=parseLeadRecoveryInput(raw);
  if(!input)throw new LeadApiError(400,"LEAD_RECOVERY_INPUT_INVALID",null);
  const response=await fetcher("/api/bo/acquisition/households/recovery",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify(input),...(signal?{signal}:{})});
  const requestId=response.headers.get("x-request-id");
  if(!response.ok)throw new LeadApiError(response.status,"LEAD_RECOVERY_UNAVAILABLE",requestId);
  let body:unknown;try{body=await response.json();}catch{throw new LeadApiError(502,"LEAD_RECOVERY_RESPONSE_INVALID",requestId);}
  const receipt=object(body)?parseLeadRecoveryReceipt(body.data,input):null;
  if(!receipt)throw new LeadApiError(502,"LEAD_RECOVERY_RESPONSE_INVALID",requestId);
  return receipt;
 };
}
