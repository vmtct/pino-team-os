import type { JWTVerifyGetKey } from "jose";
import type { StaffPasswordEnv } from "./staff-password-core";
import { authenticateTeam } from "./team-auth";

type LoginResult={token:string;expiresAt:string;userId:string;staffMemberId:string|null;email:string};

export async function loginStaffWithTransition(
  request:Request,
  env:StaffPasswordEnv,
  input:{email:string;password:string},
  keyResolver?:JWTVerifyGetKey,
):Promise<LoginResult>{
  try{return await env.PINO_STAFF_PASSWORD_CORE.login(input);}
  catch(localFailure){
    if(!request.headers.get("cf-access-jwt-assertion")||!env.PINO_STAFF_PASSWORD_CORE.establishFromCloudflare)throw localFailure;
    let identity;
    try{identity=await authenticateTeam(request.headers,env,surface(request),keyResolver);}
    catch{throw localFailure;}
    if(identity.email!==input.email)throw localFailure;
    try{await env.PINO_STAFF_PASSWORD_CORE.establishFromCloudflare(identity,{password:input.password});}
    catch{throw localFailure;}
    return env.PINO_STAFF_PASSWORD_CORE.login({email:identity.email,password:input.password});
  }
}

function surface(request:Request):"BO"|"TOS"{const host=(request.headers.get("host")??new URL(request.url).hostname).split(":")[0]!.trim().toLowerCase();return host==="bo.pinohouse.art"?"BO":"TOS";}
