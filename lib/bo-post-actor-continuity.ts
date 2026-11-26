/** PAP-2386 / PNR-APP-HUB: expected actor binds intent, never grants access. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding} from "./bo-core";
import type {TeamCredential} from "./team-auth";
export const POST_EXPECTED_ACTOR="x-pino-expected-actor";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function verifyPostActor(request:Request,binding:BoAccessCoreBinding,credential:TeamCredential,centerId:string,permission:string):Promise<200|400|401|403|503>{
 const actor=request.headers.get(POST_EXPECTED_ACTOR);
 if(!actor||!uuid.test(actor))return 400;
 if(credential.kind==="support")return 403;
 const result=await callBoAccessCoreWithCredential(binding,{method:"GET",path:"context",resource:{centerId}},credential);
 if(result.status===401||result.status===403)return result.status;
 if(result.status!==200)return 503;
 const data=(result.body as {data?:{userId?:unknown;surface?:unknown;entitled?:unknown;permissionKeys?:unknown}}|null)?.data;
 if(!data||data.surface!=="BO"||data.entitled!==true||data.userId!==actor||!Array.isArray(data.permissionKeys)||!data.permissionKeys.includes("piner.post.view")||!data.permissionKeys.includes(permission))return 403;
 return 200;
}
