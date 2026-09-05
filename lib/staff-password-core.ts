export interface StaffPasswordCoreBinding {
  login(input:{email:string;password:string}):Promise<{token:string;expiresAt:string;userId:string;staffMemberId:string|null;email:string}>;
  status(token:string):Promise<{userId:string;staffMemberId:string|null;email:string}>;
  logout(token:string):Promise<{revoked:true}>;
}

export interface StaffPasswordEnv {
  PINO_STAFF_PASSWORD_CORE: StaffPasswordCoreBinding;
}
