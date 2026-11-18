/** PAP-1035: exact Subscription/Center scoped transport. No generic writer fallback. */
import {BoApiError} from "./bo-api-error";
import type {BoEnrollmentRecord,BoEnrollmentPlacementState,BoEnrollmentCapacity} from "./bo-enrollment-contract";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Scope={subscriptionId:string;centerId:string};
type Command={commandEffectiveLocalDate:string;policyEffectiveAt:string;plannedEntryLocalTime?:string;plannedDurationMinutes?:number};
type Capacity={runningClassId:string;targetLocalDate:string;plannedEntryLocalTime?:string;plannedDurationMinutes?:number};
const bad=()=>new BoApiError(502,"Core trả dữ liệu Enrollment không hợp lệ.",null);
export function scopedEnrollmentClient(scope:Scope,fetcher:typeof fetch=fetch){
 if(!uuid.test(scope.subscriptionId)||!uuid.test(scope.centerId))throw new BoApiError(403,"Gói học chưa được xác thực theo cơ sở.",null);
 const root="/api/bo/subscriptions/"+scope.subscriptionId+"/enrollment/";
 async function call<T>(suffix:string,query:Record<string,string|number|undefined>,signal?:AbortSignal,body?:unknown,key?:string):Promise<T>{
  signal?.throwIfAborted();
  const params=new URLSearchParams({centerId:scope.centerId});
  for(const [k,v] of Object.entries(query))if(v!==undefined)params.set(k,String(v));
  if(body!==undefined&&(!key||key.length<8||key.length>128))throw bad();
  const response=await fetcher(root+suffix+"?"+params,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",redirect:"error",signal,
   ...(body===undefined?{}:{headers:{"content-type":"application/json","idempotency-key":key!},body:JSON.stringify(body)})});
  signal?.throwIfAborted();
  let payload:{data?:T;error?:{message?:string}};
  try{payload=await response.json();}catch{throw new BoApiError(response.status,"Enrollment response invalid",response.headers.get("x-request-id"));}
  if(!response.ok)throw new BoApiError(response.status,payload?.error?.message??"Không thể xử lý Enrollment.",response.headers.get("x-request-id"));
  if(!payload||payload.data===undefined||payload.data===null||response.status!==(body===undefined?200:201))throw bad();
  return payload.data;
 }
 return {
  list:async(signal?:AbortSignal)=>{
   const rows=await call<BoEnrollmentRecord[]>("list",{},signal);
   if(!Array.isArray(rows)||rows.some(r=>!r||r.subscriptionId!==scope.subscriptionId||!uuid.test(r.id)||!uuid.test(r.runningClassId)))throw bad();
   return rows;
  },
  placement:async(targetLocalDate:string,signal?:AbortSignal)=>{
   const row=await call<BoEnrollmentPlacementState>("placement",{targetLocalDate},signal);
   if(row.subscriptionId!==scope.subscriptionId||row.targetLocalDate!==targetLocalDate||!Number.isSafeInteger(row.effectiveEnrollmentCount)||!Number.isSafeInteger(row.weeklySessionCommitment))throw bad();
   return row;
  },
  capacity:(input:Capacity,signal?:AbortSignal)=>call<BoEnrollmentCapacity>("capacity",{...input},signal),
  attach:(body:Command&{runningClassId:string;effectiveFromLocalDate:string},key:string,signal?:AbortSignal)=>call<unknown>("attach",{},signal,body,key),
  transfer:(id:string,body:Command&{destinationRunningClassId:string;transferLocalDate:string;reason:string},key:string,signal?:AbortSignal)=>{
   if(!uuid.test(id))throw bad();
   return call<unknown>("transfer/"+id,{},signal,body,key);
  }
 };
}
