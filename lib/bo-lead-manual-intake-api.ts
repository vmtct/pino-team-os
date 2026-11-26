/** PAP-2402 / PAP-2288 / PLT-LEAD — exact manual intake, no alternate list. */
import {LeadApiError} from "./bo-lead-household-client";
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const opaque=(v:unknown):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{16,128}$/.test(v);
const canonical=(v:unknown):v is string=>typeof v==="string"&&id.test(v);
function obj(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==="object"&&!Array.isArray(v);}
function exact(v:Record<string,unknown>,keys:string[]){return Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
export type ManualIntakeInput={centerId:string;phone:string;sourceBrand:"PINO_HOUSE"|"TOPPI";intentKind:"OPEN_STUDIO"|"PROGRAM_INTEREST"|"GENERAL_INQUIRY";childAge:number|null};
export type ManualIntakeRecovery={centerId:string;key:string};
export type ManualIntakeReceipt={centerId:string;intentId:string;leadId:string|null;status:"SUBMITTED"};
export type ManualIntakeCenter={id:string;displayName:string};
export function parseManualIntake(v:unknown):ManualIntakeInput|null{
 if(!obj(v)||!exact(v,["centerId","phone","sourceBrand","intentKind","childAge"])||!canonical(v.centerId)||typeof v.phone!=="string"||v.phone.length>40||v.sourceBrand!=="PINO_HOUSE"&&v.sourceBrand!=="TOPPI"||v.intentKind!=="OPEN_STUDIO"&&v.intentKind!=="PROGRAM_INTEREST"&&v.intentKind!=="GENERAL_INQUIRY"||v.childAge!==null&&(typeof v.childAge!=="number"||!Number.isSafeInteger(v.childAge)||v.childAge<2||v.childAge>17))return null;
 const phone=v.phone.replace(/\D/g,"").replace(/^84(?=\d{9}$)/,"0");if(!/^0\d{9}$/.test(phone))return null;
 return {centerId:v.centerId,phone,sourceBrand:v.sourceBrand,intentKind:v.intentKind,childAge:v.childAge};
}
export function parseManualIntakeRecovery(v:unknown):ManualIntakeRecovery|null{
 if(!obj(v)||!exact(v,["centerId","key"])||!canonical(v.centerId)||!opaque(v.key))return null;
 return {centerId:v.centerId,key:v.key};
}
export function parseManualIntakeReceipt(v:unknown,centerId:string):ManualIntakeReceipt|null{
 if(!obj(v)||!exact(v,["centerId","intentId","leadId","status"])||!canonical(centerId)||v.centerId!==centerId||!canonical(v.intentId)||v.leadId!==null&&!canonical(v.leadId)||v.status!=="SUBMITTED")return null;
 return {centerId,intentId:v.intentId,leadId:v.leadId,status:"SUBMITTED"};
}
export function parseManualCenters(v:unknown,core=false):ManualIntakeCenter[]|null{
 if(!Array.isArray(v)||v.length>1000)return null;
 const seen=new Set<string>(),out:ManualIntakeCenter[]=[];
 for(const row of v){
  if(!obj(row)||!exact(row,core?["id","centerKey","displayName","timeZone","status"]:["id","displayName"])||!canonical(row.id)||typeof row.displayName!=="string"||!row.displayName.trim()||row.displayName.length>240||seen.has(row.id)||core&&(row.status!=="active"||typeof row.centerKey!=="string"||typeof row.timeZone!=="string"))return null;
  seen.add(row.id);out.push({id:row.id,displayName:row.displayName});
 }
 return out;
}
export function createLeadManualIntakeApi(fetcher:typeof fetch=fetch){
 const root="/api/bo/acquisition/households/";
 async function send(path:string,method:"GET"|"POST",expected:number,body?:ManualIntakeInput|ManualIntakeRecovery,key?:string){
  const r=await fetcher(root+path,{method,credentials:"same-origin",cache:"no-store",...(body?{headers:{"content-type":"application/json",...(key?{"idempotency-key":key}:{})},body:JSON.stringify(body)}:{})});
  const requestId=r.headers.get("x-request-id");
  if(!r.ok)throw new LeadApiError(r.status,"LEAD_MANUAL_INTAKE_REQUEST_FAILED",requestId);
  if(r.status!==expected)throw new LeadApiError(502,"LEAD_MANUAL_INTAKE_RESPONSE_INVALID",requestId);
  let value:unknown;try{const raw:unknown=await r.json();value=obj(raw)?raw.data:null;}catch{throw new LeadApiError(502,"LEAD_MANUAL_INTAKE_RESPONSE_INVALID",requestId);}
  return {value,requestId};
 }
 function requireValue<T>(value:T|null,requestId:string|null):T{if(value===null)throw new LeadApiError(502,"LEAD_MANUAL_INTAKE_RESPONSE_INVALID",requestId);return value;}
 return {
  async centers(){const {value,requestId}=await send("manual-centers","GET",200);return requireValue(parseManualCenters(value),requestId);},
  async submit(raw:ManualIntakeInput,key:string){const input=parseManualIntake(raw);if(!input||!opaque(key))throw new LeadApiError(400,"LEAD_MANUAL_INTAKE_INPUT_INVALID",null);const {value,requestId}=await send("manual-intake","POST",201,input,key);return requireValue(parseManualIntakeReceipt(value,input.centerId),requestId);},
  async recover(raw:ManualIntakeRecovery){const input=parseManualIntakeRecovery(raw);if(!input)throw new LeadApiError(400,"LEAD_MANUAL_INTAKE_INPUT_INVALID",null);const {value,requestId}=await send("manual-intake/recovery","POST",200,input);return requireValue(parseManualIntakeReceipt(value,input.centerId),requestId);}
 };
}
