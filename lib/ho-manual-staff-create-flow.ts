// PAP-2358 · WFM-STAFF. Feature-owned in-memory retry lifecycle.
// An uncertain commit keeps the same key. No retained password, token, or password hash.
import type { StaffCreateCommand } from "../app/ho/staff/manual-create-contract";
import { HoManualStaffCreateError, createHoManualStaff } from "./ho-manual-staff-create-client";
import type { HoManualStaffReceipt } from "./ho-manual-staff-create-receipt";

export type HoStaffCreatePending = {
  key:string;
  intent:string;
  phase:"submitting"|"uncertain";
};
export type HoStaffCreateState = { pending:HoStaffCreatePending|null };
export const createHoStaffCreateState=():HoStaffCreateState=>({pending:null});
function intent(command:StaffCreateCommand):string{
  return JSON.stringify([command.name,command.phone,command.email,command.gender,command.birthDate,command.centerId,command.login!==null]);
}
export class HoStaffCreatePendingError extends Error {
  constructor(readonly kind:"busy"|"different-intent"){
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
    if(prior?.phase==="submitting")throw new HoStaffCreatePendingError("busy");
    if(prior&&prior.intent!==signature)throw new HoStaffCreatePendingError("different-intent");
    const key=prior?.key??makeKey();
    state.pending={key,intent:signature,phase:"submitting"};
    try{
      const receipt=await submit(command,key);
      state.pending=null;
      return receipt;
    }catch(error){
      // After an uncertain result even a later denial/conflict is not proof the first command failed.
      state.pending=prior||!(error instanceof HoManualStaffCreateError)||error.kind==="uncertain"
        ? {key,intent:signature,phase:"uncertain"} : null;
      throw error;
    }
  };
}
