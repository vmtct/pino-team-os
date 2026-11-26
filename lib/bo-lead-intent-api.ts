/** PAP-2288 / PAP-2399 / PLT-LEAD — exact F1 child transition and committed-only lookup. */
import {LeadApiError} from "./bo-lead-household-client";
const statuses={contacted:"CONTACTED","verify-contact":"CONTACT_VERIFIED",close:"CLOSED"} as const;
export type IntentAction=keyof typeof statuses;
export type IntentStatus="SUBMITTED"|typeof statuses[IntentAction];
export type IntentTarget={leadId:string;intentId:string};
export type IntentRecoveryInput={action:IntentAction;key:string;expectedVersion:number};
export type IntentCommandInput={expectedVersion:number;reason?:string};
export type IntentReceipt=IntentTarget&{status:IntentStatus;version:number};
export type IntentRecovered=IntentReceipt&{currentStatus:IntentStatus;currentVersion:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validKey=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{16,128}$/.test(v);
const positive=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>0;
const version=(v:unknown):v is number=>positive(v)&&v<Number.MAX_SAFE_INTEGER;
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function exact(v:Record<string,unknown>,fields:string[]){return Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));}
export function isIntentAction(v:unknown):v is IntentAction{return typeof v==="string"&&Object.hasOwn(statuses,v);}
function targetValid(t:IntentTarget){return uuid.test(t.leadId)&&uuid.test(t.intentId);}
export function parseIntentCommand(v:unknown,action:IntentAction):IntentCommandInput|null{
 if(!isIntentAction(action)||!object(v)||!exact(v,action==="close"?["expectedVersion","reason"]:["expectedVersion"])||!version(v.expectedVersion))return null;
 if(action==="close")return typeof v.reason==="string"&&v.reason.trim()&&v.reason.trim().length<=240?{expectedVersion:v.expectedVersion,reason:v.reason.trim()}:null;
 return {expectedVersion:v.expectedVersion};
}
export function parseIntentRecovery(v:unknown):IntentRecoveryInput|null{
 if(!object(v)||!exact(v,["action","key","expectedVersion"])||!isIntentAction(v.action)||!validKey(v.key)||!version(v.expectedVersion))return null;
 return {action:v.action,key:v.key,expectedVersion:v.expectedVersion};
}
export function parseIntentReceipt(v:unknown,t:IntentTarget,action:IntentAction,expectedVersion:number,recovery:false):IntentReceipt|null;
export function parseIntentReceipt(v:unknown,t:IntentTarget,action:IntentAction,expectedVersion:number,recovery:true):IntentRecovered|null;
export function parseIntentReceipt(v:unknown,t:IntentTarget,action:IntentAction,expectedVersion:number,recovery:boolean):IntentReceipt|IntentRecovered|null{
 if(!targetValid(t)||!isIntentAction(action)||!version(expectedVersion)||!object(v)||!exact(v,recovery?["leadId","intentId","status","version","currentStatus","currentVersion"]:["leadId","intentId","status","version"])||v.leadId!==t.leadId||v.intentId!==t.intentId||v.status!==statuses[action]||v.version!==expectedVersion+1)return null;
 const receipt:IntentReceipt={leadId:t.leadId,intentId:t.intentId,status:statuses[action],version:expectedVersion+1};
 if(!recovery)return receipt;
 const allowed:IntentStatus[]=["SUBMITTED","CONTACTED","CONTACT_VERIFIED","CLOSED"];
 if(!positive(v.currentVersion)||v.currentVersion<receipt.version||!allowed.includes(v.currentStatus as IntentStatus)||allowed.indexOf(v.currentStatus as IntentStatus)<allowed.indexOf(receipt.status)||(v.currentVersion===receipt.version&&v.currentStatus!==receipt.status))return null;
 return {...receipt,currentVersion:v.currentVersion,currentStatus:v.currentStatus as IntentStatus};
}
export class IntentDefinitiveRejection extends LeadApiError{
 constructor(requestId:string|null){super(409,"ACQUISITION_STALE_VERSION",requestId);}
}
export function intentRejectionProof(t:IntentTarget,action:IntentAction,expectedVersion:number,key:string){
 return {code:"ACQUISITION_STALE_VERSION",commandOutcome:"NOT_COMMITTED",...t,action,expectedVersion,key} as const;
}
function exactRejection(v:unknown,t:IntentTarget,action:IntentAction,expectedVersion:number,key:string){
 if(!object(v)||!exact(v,["error"])||!object(v.error))return false;
 const proof=intentRejectionProof(t,action,expectedVersion,key),error=v.error;
 return exact(error,Object.keys(proof))&&Object.entries(proof).every(([k,value])=>error[k]===value);
}
export function createLeadIntentApi(fetcher:typeof fetch=fetch){
 async function send(t:IntentTarget,action:IntentAction|"recovery",body:IntentCommandInput|IntentRecoveryInput,key?:string){
  if(!targetValid(t))throw new LeadApiError(400,"LEAD_INTENT_INPUT_INVALID",null);
  const r=await fetcher("/api/bo/acquisition/households/"+t.leadId+"/intents/"+t.intentId+"/"+action,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json",...(key?{"idempotency-key":key}:{})},body:JSON.stringify(body)});
  const requestId=r.headers.get("x-request-id");
  if(!r.ok){
   if(r.status===409&&action!=="recovery"&&key){
    let error:unknown;try{error=await r.json();}catch{error=null;}
    if(exactRejection(error,t,action,body.expectedVersion,key))throw new IntentDefinitiveRejection(requestId);
   }
   throw new LeadApiError(r.status,"LEAD_INTENT_REQUEST_FAILED",requestId);
  }
  if(r.status!==200)throw new LeadApiError(502,"LEAD_INTENT_RESPONSE_INVALID",requestId);
  let data:unknown;try{const raw:unknown=await r.json();data=object(raw)?raw.data:null;}catch{throw new LeadApiError(502,"LEAD_INTENT_RESPONSE_INVALID",requestId);}
  return {data,requestId};
 }
 return {
  async transition(t:IntentTarget,action:IntentAction,raw:IntentCommandInput,key:string){
   const input=parseIntentCommand(raw,action);if(!input||!validKey(key))throw new LeadApiError(400,"LEAD_INTENT_INPUT_INVALID",null);
   const {data,requestId}=await send(t,action,input,key);
   const receipt=parseIntentReceipt(data,t,action,input.expectedVersion,false);
   if(!receipt)throw new LeadApiError(502,"LEAD_INTENT_RESPONSE_INVALID",requestId);return receipt;
  },
  async recover(t:IntentTarget,raw:IntentRecoveryInput){
   const input=parseIntentRecovery(raw);if(!input)throw new LeadApiError(400,"LEAD_INTENT_INPUT_INVALID",null);
   const {data,requestId}=await send(t,"recovery",input);
   const receipt=parseIntentReceipt(data,t,input.action,input.expectedVersion,true);
   if(!receipt)throw new LeadApiError(502,"LEAD_INTENT_RESPONSE_INVALID",requestId);return receipt;
  }
 };
}
