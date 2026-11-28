/** PAP-2153 / PNR-WORLD: authenticated synthetic Staging review boundary, never live grants. */
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import type {BoShellContext} from "@/lib/bo-shell-gate";
import type {AvatarAuthority} from "./avatar-dsa-data";
import {WORLD_PERMISSIONS} from "./SelfWorldNative";
import {avatarWorldReviewMarker} from "./avatar-world-m1-fixture";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function requestedAvatarWorldFixture(query:Record<string,string|string[]|undefined>){
 return query.record===avatarWorldReviewMarker&&Object.keys(query).every(key=>key==="record"||key==="centerId")&&(query.centerId===undefined||(typeof query.centerId==="string"&&uuid.test(query.centerId)));
}
export function admitAvatarWorldStage(input:{environment:string|undefined;hostname:string;enabled:string|undefined;query:Record<string,string|string[]|undefined>;actor:BoShellContext|null;selectedCenterId:string;authority:AvatarAuthority|null}){
 const {actor,authority,selectedCenterId,query}=input;
 const authenticated=actor?.surface==="BO"&&actor.entitled===true&&typeof actor.userId==="string"&&actor.userId.trim().length>0;
 const scoped=authenticated&&!!authority&&uuid.test(selectedCenterId)&&authority.centerId===selectedCenterId&&authority.principalId===actor.userId&&(query.centerId===undefined||query.centerId===selectedCenterId);
 const required=WORLD_PERMISSIONS.slice(0,3);
 return decideM1Preview({environment:input.environment,hostname:input.hostname,surface:"BO",requested:requestedAvatarWorldFixture(query),featureEnabled:input.enabled==="1",authenticated,surfaceAuthorized:authenticated&&actor.permissionKeys.includes("team.bo.access"),featureReviewAuthorized:scoped&&required.every(key=>authority.grants.has(key)),scopeAuthorized:scoped}).allowed;
}
