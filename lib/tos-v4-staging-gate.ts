/** PAP-938: staging presentation entry, never a new authentication mechanism. */
import {teamCredentialFromHeaders,type TeamAccessEnv} from "./team-auth";
import {callWorkforceCoreWithCredential,type WorkforceCoreBinding} from "./workforce-core";
import {tosV4StagingHost} from "./tos-v4-staging-host";
export {TOS_V4_STAGING_HOSTS} from "./tos-v4-staging-host";
export class TosV4GateError extends Error{constructor(readonly status:number,readonly code:string){super(code)}}
export type TosV4GateEnv=TeamAccessEnv&{APP_ENV?:string;PINO_WORKFORCE_CORE:WorkforceCoreBinding};
export async function authorizeTosV4Staging(headers:Headers,env:TosV4GateEnv){
 if(env.APP_ENV!=="staging"||!tosV4StagingHost(headers.get("host")||""))throw new TosV4GateError(404,"STAGING_ONLY");
 const credential=await teamCredentialFromHeaders(headers,env,"TOS");
 let result;
 try{result=await callWorkforceCoreWithCredential(env.PINO_WORKFORCE_CORE,{method:"GET",path:"/context"},credential)}catch{throw new TosV4GateError(503,"CORE_UNAVAILABLE")}
 const body=result.body as {data?:{userId?:unknown;staffMemberId?:unknown;centers?:unknown};error?:{code?:string}};
 if(result.status!==200)throw new TosV4GateError(result.status,body?.error?.code||"TOS_CONTEXT_DENIED");
 if(!body?.data||typeof body.data.userId!=="string"||!body.data.userId||typeof body.data.staffMemberId!=="string"||!body.data.staffMemberId||!Array.isArray(body.data.centers))throw new TosV4GateError(403,"TOS_CONTEXT_INVALID");
 return body.data;
}
