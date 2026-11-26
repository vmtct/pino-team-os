// PAP-2358 · WFM-STAFF. Native HO command client, not mounted.
// Caller owns the opaque operation key across uncertain results; never persist the password.
import type { StaffCreateCommand } from "../app/ho/staff/manual-create-contract";
import { parseHoManualStaffReceipt, type HoManualStaffReceipt } from "./ho-manual-staff-create-receipt";

export class HoManualStaffCreateError extends Error {
  constructor(readonly kind:"invalid"|"denied"|"conflict"|"uncertain",readonly status:number|null){
    super("Manual Staff creation "+kind);
    this.name="HoManualStaffCreateError";
  }
}
export async function createHoManualStaff(command:StaffCreateCommand,key:string,
  options:{signal?:AbortSignal;fetcher?:typeof fetch}={}):Promise<HoManualStaffReceipt>{
  if(command.login!==null||!/^[a-zA-Z0-9:_-]{8,120}$/.test(key))throw new HoManualStaffCreateError("invalid",400);
  const {login: _login, ...record}=command;
  if(_login!==null)throw new HoManualStaffCreateError("invalid",400);
  let response:Response;
  try{
    response=await (options.fetcher??fetch)("/api/ho/staff/create",{
      method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
      headers:{"content-type":"application/json","idempotency-key":key},
      body:JSON.stringify(record),...(options.signal?{signal:options.signal}:{}),
    });
  }catch{throw new HoManualStaffCreateError("uncertain",null);}
  if(response.status!==201){
    const kind=response.status===400?"invalid":[401,403,404].includes(response.status)?"denied":response.status===409?"conflict":"uncertain";
    throw new HoManualStaffCreateError(kind,response.status);
  }
  const receipt=parseHoManualStaffReceipt(await response.json().catch(()=>null),command.centerId);
  if(!receipt||(command.existingPersonId!==undefined&&receipt.personId!==command.existingPersonId))throw new HoManualStaffCreateError("uncertain",502);
  return receipt;
}
