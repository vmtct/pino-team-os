export interface StaffPinResponse{status:number;body:unknown;requestId:string}
export interface StaffPinCoreBinding{
  login(input:{loginIdentifier:string;pin:string}):Promise<StaffPinResponse>;
  statusWithStaffPassword(token:string):Promise<StaffPinResponse>;
  configureWithStaffPassword(token:string,input:{pin:string}):Promise<StaffPinResponse>;
  rotateWithStaffPassword(token:string,input:{currentPin:string;pin:string}):Promise<StaffPinResponse>;
  logout(token:string):Promise<StaffPinResponse>;
}
export interface PinoriaTvCoreBinding{snapshot(centerId:string):Promise<unknown>;events(centerId:string,after:number,limit?:number):Promise<unknown>;claimWishReveal(centerId:string):Promise<{reveal:unknown;claimedAt:string}|null>;completeWishReveal(centerId:string,revealId:string):Promise<{revealId:string;completedAt:string}>;claimPresentation(centerId:string):Promise<{id:string;kind:"WISH_REVEAL"|"EGG_HATCH"|"COMPANION_RITUAL";projection:unknown;claimedAt:string}|null>;completePresentation(centerId:string,presentationId:string):Promise<{presentationId:string;completedAt:string}>}
