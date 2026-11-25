// PAP-2358 · WFM-STAFF. Feature-owned in-memory retry lifecycle.
// An uncertain commit keeps the same key. No retained password, token, or password hash.
import type { StaffCreateCommand } from "../app/ho/staff/manual-create-contract";
import { HoManualStaffCreateError, createHoManualStaff } from "./ho-manual-staff-create-client";
import { readHoManualStaffReceipt, type HoManualStaffReadback } from "./ho-manual-staff-readback-client";
import type { HoManualStaffReceipt } from "./ho-manual-staff-create-receipt";

export type HoStaffCreatePending = {
  key:string;
  intent:string;
  centerId:string;
  withLogin:boolean;
  phase:"submitting"|"uncertain"|"reading";
};
export type HoStaffCreateState = { pending:HoStaffCreatePending|null };
export const createHoStaffCreateState=():HoStaffCreateState=>({pending:null});
function intent(command:StaffCreateCommand):string{
  return JSON.stringify([command.name,command.phone,command.email,command.gender,command.birthDate,command.centerId,command.login!==null]);
}
export class HoStaffCreatePendingError extends Error {
  constructor(readonly kind:"busy"|"different-intent"|"no-pending"){
    super("Manual Staff creation "+kind);this.name="HoStaffCreatePendingError";
  }
}
export function createHoStaffCreateFlow(state:HoStaffCreateState,options:{
  submit?:typeof createHoManualStaff;
  makeKey?:()=>string;
}={}){
  const submit=options.submit??createHoManualStaff, makeKey=options.makeKey??(()=>crypto.randomUUID());
  return async(command:StaffCreateCommand):Promise<HoManualStaffReceipt>=>{
    const prior=state.pending,signature=intent(command);
    if(prior&&prior.phase!=="uncertain")throw new HoStaffCreatePendingError("busy");
    if(prior&&prior.intent!==signature)throw new HoStaffCreatePendingError("different-intent");
    const key=prior?.key??makeKey();
    state.pending={key,intent:signature,centerId:command.centerId,withLogin:command.login!==null,phase:"submitting"};
    try{
      const receipt=await submit(command,key);
      state.pending=null;
      return receipt;
    }catch(error){
      // After an uncertain result even a later denial/conflict is not proof the first command failed.
      state.pending=prior||!(error instanceof HoManualStaffCreateError)||error.kind==="uncertain"
        ? {key,intent:signature,centerId:command.centerId,withLogin:command.login!==null,phase:"uncertain"} : null;
      throw error;
    }
  };
}

/** Explicit readback, not a new write; state must be scoped to the admitted principal. */
export async function reconcileHoStaffCreate(state:HoStaffCreateState,read=readHoManualStaffReceipt):Promise<HoManualStaffReadback>{
  const prior=state.pending;
  if(!prior)throw new HoStaffCreatePendingError("no-pending");
  if(prior.phase!=="uncertain")throw new HoStaffCreatePendingError("busy");
  state.pending={...prior,phase:"reading"};
  try{
    const result=await read(prior.centerId,prior.key,prior.withLogin);
    if(result.state==="COMMITTED"){
      if(result.receipt.centerId!==prior.centerId||(result.receipt.accessState==="PROVISIONED")!==prior.withLogin)
        throw new HoManualStaffCreateError("uncertain",502);
      state.pending=null;
    }else state.pending=prior;
    return result;
  }catch(error){state.pending=prior;throw error;}
}
