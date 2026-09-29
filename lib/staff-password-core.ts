import type { TeamAccessEnv, VerifiedTeamIdentity } from "./team-auth";
export interface StaffPasswordCoreBinding {
  establishFromCloudflare?(identity:VerifiedTeamIdentity,input:{password:string}):Promise<{state:"CREATED"|"ALREADY_CONFIGURED";loginIdentifier:string}>;
  login(input:{email:string;password:string}):Promise<{token:string;expiresAt:string;userId:string;staffMemberId:string|null;email:string}>;
  status(token:string):Promise<{userId:string;staffMemberId:string|null;email:string}>;
  logout(token:string):Promise<{revoked:true}>;
  supportStatus?(token:string):Promise<{sessionId:string;mode:"VIEW"|"ACT";reason:string;expiresAt:string;actorUserId:string;actorEmail:string;subjectUserId:string;subjectStaffMemberId:string|null;subjectEmail:string}>;
  supportLogout?(token:string):Promise<{revoked:true}>;
}

export interface StaffPasswordEnv extends TeamAccessEnv {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
}
