import type{VerifiedWorkforceIdentity}from"./workforce-auth";
export interface StaffPinResponse{status:number;body:unknown;requestId:string}
export interface StaffPinCoreBinding{login(input:{loginIdentifier:string;pin:string}):Promise<StaffPinResponse>;configure(identity:VerifiedWorkforceIdentity,input:{userId:string;pin:string}):Promise<StaffPinResponse>;logout(token:string):Promise<StaffPinResponse>}
export interface PinoriaTvCoreBinding{snapshot(centerId:string):Promise<unknown>;events(centerId:string,after:number,limit?:number):Promise<unknown>}
