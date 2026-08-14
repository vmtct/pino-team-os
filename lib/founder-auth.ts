import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

export interface FounderAuthConfig { teamDomain:string; audience:string; founderEmail:string }
export interface FounderActorContext { actorType:"founder"; subject:string; email?:string }
export class FounderAuthError extends Error { constructor(readonly status:401|403, message:string){super(message);this.name="FounderAuthError";} }

export async function authenticateFounder(
  headers:Headers,
  config:FounderAuthConfig,
  keyResolver?:JWTVerifyGetKey,
):Promise<FounderActorContext>{
  const token=headers.get("cf-access-jwt-assertion");
  if(!token)throw new FounderAuthError(401,"Cloudflare Access authentication is required");
  const domain=config.teamDomain.replace(/^https?:\/\//,"" ).replace(/\/$/,"");
  if(!domain||!config.audience||!config.founderEmail)throw new Error("Founder authentication is not configured");
  let payload:JWTPayload;
  try{
    ({payload}=await jwtVerify(token,keyResolver??createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`)),{
      issuer:`https://${domain}`,
      audience:config.audience,
    }));
  }catch{throw new FounderAuthError(401,"Cloudflare Access token is invalid");}
  if(typeof payload.sub!=="string"||!payload.sub)throw new FounderAuthError(401,"Cloudflare Access subject is missing");
  const email=typeof payload.email==="string"?payload.email.toLowerCase():"";
  const approvedEmails=config.founderEmail.split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(!approvedEmails.includes(email))throw new FounderAuthError(403,"Founder identity is not approved");
  return {actorType:"founder",subject:payload.sub,email};
}
