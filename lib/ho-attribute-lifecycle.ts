/** PAP-1906: UI projection of Core's forward-only Definition transition contract. */
import type {AttributeDefinition} from "./ho-attribute-model";
type Status=AttributeDefinition["status"];
export function nextLifecycle(scope:AttributeDefinition["scope"],status:Status):Status|null {
 if(status==="DRAFT")return scope==="CENTER"?"PILOT":scope==="GLOBAL"?"ACTIVE":null;
 if(status==="PILOT")return scope==="CENTER"?"ACTIVE":null;
 if(status==="ACTIVE"&&(scope==="CENTER"||scope==="GLOBAL"))return "DEPRECATED";
 if(status==="DEPRECATED"&&(scope==="CENTER"||scope==="GLOBAL"))return "ARCHIVED";
 return null;
}
export function lifecyclePayload(detail:AttributeDefinition,selectedCenterId:string,raw:unknown){
 const targetStatus=nextLifecycle(detail.scope,detail.status);
 if(!targetStatus||raw!==targetStatus||!selectedCenterId||
    (detail.scope==="CENTER"&&detail.centerId!==selectedCenterId))return null;
 return {selectedCenterId,expectedRevision:detail.revision,targetStatus,
   ...(detail.scope==="GLOBAL"&&detail.status==="DRAFT"?{confirmGlobalActivation:true as const}:{})};
}
