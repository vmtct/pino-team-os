import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface VerifiedWorkforceIdentity { provider:"cloudflare_access";subject:string;email:string;issuer:string;audience:string[];expiresAt:number }
export class WorkforceAuthError extends Error { constructor(readonly status:401|503,message:string){super(message);this.name="WorkforceAuthError";} }

export async function authenticateWorkforce(headers:Headers,config:{teamDomain:string;audience:string},keyResolver?:JWTVerifyGetKey):Promise<VerifiedWorkforceIdentity>{
  const token=headers.get("cf-access-jwt-assertion");
  if(!token)throw new WorkforceAuthError(401,"Cloudflare Access authentication is required");
  const domain=config.teamDomain.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!domain||!config.audience)throw new WorkforceAuthError(503,"Workforce authentication is not configured");
  try{
    const {payload}=await jwtVerify(token,keyResolver??createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`)),{issuer:`https://${domain}`,audience:config.audience});
    if(typeof payload.sub!=="string"||!payload.sub||typeof payload.email!=="string"||!payload.email||typeof payload.exp!=="number")throw new Error("claims");
    const aud=Array.isArray(payload.aud)?payload.aud:typeof payload.aud==="string"?[payload.aud]:[];
    return{provider:"cloudflare_access",subject:payload.sub,email:payload.email.trim().toLowerCase(),issuer:`https://${domain}`,audience:aud,expiresAt:payload.exp};
  }catch{throw new WorkforceAuthError(401,"Cloudflare Access token is invalid");}
}
