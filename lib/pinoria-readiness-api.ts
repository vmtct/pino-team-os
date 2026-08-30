export type CompanionReadiness = {
  companionId:string;
  materializationLevel:number;
  state:"GROWING"|"READY_FOR_RITUAL";
  stageFeedCount:number;
  readinessRuleKey:"FEED_2"|"FEED_5_AND_WATER_SIGIL"|null;
  version:number;
};
export type PinoriaReadinessState = {
  fruitBalance:number;
  waterSigil:{credentialId:string;awardedAt:string}|null;
  companions:CompanionReadiness[];
};
type Envelope<T>={data?:T;error?:{message?:string}};

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(`/api/tos-learning/${path}`,{cache:"no-store",...init,headers:{...(init.body?{"content-type":"application/json"}:{}),...init.headers}});
  const body=await response.json() as Envelope<T>;
  if(!response.ok||body.data===undefined)throw new Error(body.error?.message??"Không thực hiện được thao tác Hộ Linh");
  return body.data;
}
function mutation(path:string,body:Record<string,unknown>){return request<Record<string,unknown>>(path,{method:"POST",headers:{"idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)});}
export const pinoriaReadinessApi={
  state:(centerId:string,studentProfileId:string)=>request<PinoriaReadinessState>(`pinoria/companion/readiness?${new URLSearchParams({centerId,studentProfileId})}`),
  grantFruit:(centerId:string,studentProfileId:string,classroomDiaryId:string)=>mutation("pinoria/rewards/fruit/grant",{centerId,studentProfileId,classroomDiaryId}),
  awardWaterSigil:(centerId:string,studentProfileId:string,classroomDiaryId:string,assessmentNote?:string)=>mutation("pinoria/competencies/water-sigil/award",{centerId,studentProfileId,classroomDiaryId,...(assessmentNote?{assessmentNote}:{})}),
  feed:(centerId:string,studentProfileId:string,companionId:string)=>mutation("pinoria/companions/feed",{centerId,studentProfileId,companionId}),
};
