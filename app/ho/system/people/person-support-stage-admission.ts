/** PAP-1523: synthetic UI admission after canonical server-side HO authorization.
 * This predicate never authenticates a user or creates a support session. */
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import type {BoShellContext} from "@/lib/bo-shell-gate";
import {READ,VIEW_AS} from "./schema";

export function admitPersonSupportFixture(environment:string|undefined,hostname:string,enabled:string|undefined,context:BoShellContext|null) {
 const admitted=context?.entitled===true&&typeof context.userId==="string"&&context.userId.length>0;
 return decideM1Preview({
  environment,hostname,surface:"HO",requested:true,featureEnabled:enabled==="1",
  authenticated:admitted,surfaceAuthorized:admitted,
  featureReviewAuthorized:admitted&&context.permissionKeys.includes(VIEW_AS),
  scopeAuthorized:admitted&&context.permissionKeys.includes(READ)
 }).allowed;
}