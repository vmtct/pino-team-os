// PAP-2365: canonical real record navigation, no preview or fallback.
import {parseNativePlanQuery} from "./product-plan-native-binding";
import {isPlanId} from "./product-plan-native-contract";
import {planHost} from "./product-plan-http-contract";
import {PLAN_READ} from "./schema";
export function productPlanStageQuery(environment:unknown,hostname:string,query:Record<string,string|string[]|undefined>){
 if(environment!=="staging"||hostname!==planHost)return null;
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(query)){
  if(typeof value==="string")params.append(key,value);
  else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 return parseNativePlanQuery(params);
}
export function productPlanActorAllowed(actor:{userId:unknown;entitled:boolean;permissionKeys:readonly string[]}):actor is typeof actor&{userId:string}{
 return actor.entitled&&isPlanId(actor.userId)&&actor.permissionKeys.includes("team.bo.access")&&actor.permissionKeys.includes(PLAN_READ);
}
