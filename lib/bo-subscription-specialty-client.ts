/**
 * PAP-1496 / PAP-1491 SPEC-UNLOCK — narrow Subscription Specialty client.
 * Intentionally isolated from shared lib/bo-api.ts: do not widen HO/BO
 * module dependencies or shared TDD/DSA admission ownership.
 */
import {BoApiError} from "./bo-api-error";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";
import type {BoSubscriptionSpecialtyGrant,BoSubscriptionSpecialtyRead} from "./bo-subscription-specialty-model";

type Reply<T>={data?:T;error?:{message?:string;requestId?:string}};
async function call<T>(method:"GET"|"POST"|"PATCH",path:string,body?:unknown,key?:string):Promise<T>{
 const response=await fetch("/api/bo/"+path,{
  method,cache:"no-store",
  ...(method!=="GET"?{
   headers:{"content-type":"application/json","idempotency-key":key??""},
   body:JSON.stringify(body),
  }:{}),
 });
 let payload:Reply<T>;
 const raw=await response.text();
 try{payload=JSON.parse(raw) as Reply<T>;}catch{
  throw new BoApiError(response.status,raw.trim()||"BO Subscription Specialty response invalid",response.headers.get("x-request-id"),false);
 }
 if(!response.ok||payload.data===undefined){
  if(response.status===401&&typeof window!=="undefined")void recoverInvalidStaffPasswordSession();
  throw new BoApiError(response.status,payload.error?.message||"Không thể thực hiện thao tác Chuyên đề.",
   response.headers.get("x-request-id")??payload.error?.requestId??null,Boolean(payload.error?.message));
 }
 return payload.data;
}
const prefix=(subscriptionId:string,centerId:string)=>
 "subscriptions/"+encodeURIComponent(subscriptionId)+"?centerId="+encodeURIComponent(centerId);
const route=(subscriptionId:string,centerId:string,suffix:string)=>
 "subscriptions/"+encodeURIComponent(subscriptionId)+"/"+suffix+"?centerId="+encodeURIComponent(centerId);
export const subscriptionSpecialtyClient={
 read:(subscriptionId:string,centerId:string)=>
  call<BoSubscriptionSpecialtyRead>("GET",route(subscriptionId,centerId,"specialties")),
 create:(subscriptionId:string,centerId:string,body:{specialtyId:string;effectiveFrom:string;expectedVersion:0},key:string)=>
  call<BoSubscriptionSpecialtyGrant>("POST",route(subscriptionId,centerId,"specialty-grants"),body,key),
 complete:(subscriptionId:string,grantId:string,centerId:string,body:{completed:boolean;expectedVersion:number},key:string)=>
  call<BoSubscriptionSpecialtyGrant>("PATCH",route(subscriptionId,centerId,
   "specialty-grants/"+encodeURIComponent(grantId)+"/completion"),body,key),
};
export {BoApiError};
