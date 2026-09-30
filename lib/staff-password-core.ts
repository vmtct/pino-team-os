import type { TeamAccessEnv, VerifiedTeamIdentity } from "./team-auth";
export interface StaffPasswordCoreBinding {
  establishFromCloudflare?(identity:VerifiedTeamIdentity,input:{password:string}):Promise<{state:"CREATED"|"ALREADY_CONFIGURED";loginIdentifier:string}>;
  login(input:{email:string;password:string}):Promise<{token:string;expiresAt:string;userId:string;staffMemberId:string|null;email:string;passwordChangeRequired:boolean}>;
  status(token:string):Promise<{userId:string;staffMemberId:string|null;email:string;passwordChangeRequired:boolean}>;
  changePassword(token:string,input:{password:string}):Promise<{token:string;expiresAt:string;userId:string;staffMemberId:string|null;email:string;passwordChangeRequired:false}>;

  requestPasswordReset?(input:{email:string}):Promise<{delivery:{email:string;token:string;expiresAt:string}|null}>;
  cancelPasswordReset?(input:{token:string}):Promise<{revoked:boolean}>;
  resetPassword?(input:{token:string;password:string}):Promise<{userId:string;email:string}>;

  logout(token:string):Promise<{revoked:true}>;
}

export interface StaffPasswordEnv extends TeamAccessEnv {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
}
