/**
 * PAP-1334 / PAP-1491 SPEC-UNLOCK — narrow Center-scoped Subscription reader.
 * Deliberately separate from shared bo-api.ts and all registered HO/BO
 * TDD dependencies. Neither the old by-ID reader nor writers are fallback paths.
 */
import {BoApiError} from "./bo-api-error";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";
import type {BoLearnerSubscription} from "./bo-model";

type Reply<T> = {data?:T;error?:{message?:string;requestId?:string}};

export function subscriptionCenterDetailUrl(subscriptionId:string,centerId:string):string {
  return "/api/bo/subscriptions/"+encodeURIComponent(subscriptionId)
    +"/center-detail?centerId="+encodeURIComponent(centerId);
}

export async function readSubscriptionCenterDetail(
  subscriptionId:string,selectedCenterId:string,
):Promise<BoLearnerSubscription> {
  const response=await fetch(subscriptionCenterDetailUrl(subscriptionId,selectedCenterId),{
    method:"GET",cache:"no-store",
  });
  const raw=await response.text();
  let reply:Reply<BoLearnerSubscription>;
  try { reply=JSON.parse(raw) as Reply<BoLearnerSubscription>; }
  catch {
    throw new BoApiError(response.status,raw.trim()||"Subscription Detail response invalid",
      response.headers.get("x-request-id"),false);
  }
  if(!response.ok || reply.data===undefined) {
    if(response.status===401 && typeof window!=="undefined")void recoverInvalidStaffPasswordSession();
    throw new BoApiError(response.status,reply.error?.message||"Không thể tải thông tin gói học.",
      response.headers.get("x-request-id")??reply.error?.requestId??null,Boolean(reply.error?.message));
  }
  return reply.data;
}
