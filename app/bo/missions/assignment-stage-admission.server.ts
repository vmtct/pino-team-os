/** PAP-2425: server-owned staging review admission, not mounted yet.
 * Existing BO auth and BFF independently authorize; only synthetic review scope leaves this function.
 */
import { authorizeBoShell } from "@/lib/bo-shell-gate";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";
import { decideM1Preview } from "@/lib/m1-preview/admission.server";
import { parseMissionAssignment } from "@/lib/bo-mission-assignments";
import { loadAuthorizedDirectoryCenters } from "@/app/bo/pinoria-avatars/centers";
import { parseAssignmentStageReview } from "./assignment-stage-admission";
const host = "bo.staging.pinohouse.art";
import {hasAssignmentStageReviewPermissions} from "./assignment-stage-route";
export async function authorizeAssignmentStageReview(input: {url:URL; headers:Headers; env:BoReadEnv; featureEnabled:boolean}) {
  if (typeof window !== "undefined") throw Error("Server admission only");
  const {url,headers,env,featureEnabled} = input;
  const route = parseAssignmentStageReview(url);
  if (!route || headers.get("host") !== host || env.APP_ENV !== "staging" || featureEnabled !== true) throw Error("Mission review disabled");
  const actor = await authorizeBoShell(headers,env);
  if (!actor.entitled || !hasAssignmentStageReviewPermissions(actor.permissionKeys)) throw Error("Mission review denied");
  const controller = new AbortController();
  const read:typeof fetch = async (resource,init) => {
    const path = new URL(String(resource),url.origin);
    if(path.origin !== url.origin || !["/api/bo/centers","/api/bo/workforce/planning/bootstrap"].includes(path.pathname) || path.search || path.hash || init?.method !== "GET") throw Error("Unexpected Center read");
    return handleBoOperationalReadRequest(new Request(path,{method:"GET",headers,signal:controller.signal}),env,path.pathname.slice("/api/bo/".length));
  };
  try {
    const choices = await loadAuthorizedDirectoryCenters(read,controller.signal);
    if (!choices.centers.some(center=>center.id===route.centerId)) throw Error("Mission review Center denied");
    const path = "learning/mission-assignments";
    const proofUrl = new URL("/api/bo/"+path+"?"+new URLSearchParams({centerId:route.centerId,limit:"1",offset:"0"}),url.origin);
    const response = await handleBoOperationalReadRequest(new Request(proofUrl,{method:"GET",headers,signal:controller.signal}),env,path);
    if (!response.ok) throw Error("Mission review scope denied");
    const body:unknown = await response.json();
    if(!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data) || body.data.length>1) throw Error("Mission review scope invalid");
    for(const row of body.data) parseMissionAssignment(row,route.centerId);
    const current=await authorizeBoShell(headers,env);
    const currentChoices=await loadAuthorizedDirectoryCenters(read,controller.signal);
    const admission=decideM1Preview({environment:env.APP_ENV,hostname:host,surface:"BO",requested:true,featureEnabled,authenticated:current.entitled,surfaceAuthorized:current.userId===actor.userId,featureReviewAuthorized:hasAssignmentStageReviewPermissions(current.permissionKeys),scopeAuthorized:currentChoices.centers.some(center=>center.id===route.centerId)});
    if(!admission.allowed) throw Error("Mission review admission denied");
    return Object.freeze({actorId:actor.userId,centerId:route.centerId,centerSource:currentChoices.source});
  } finally {controller.abort();}
}
