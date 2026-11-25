// PAP-2358 · WFM-STAFF. Caller admission and single operation lifecycle; not route activation.
import type {StaffCreateCommand,StaffCenterOption} from "./manual-create-contract";
import {createHoStaffCreateFlow,createHoStaffCreateState,reconcileHoStaffCreate,type HoStaffCreateState} from "@/lib/ho-manual-staff-create-flow";
import type {createHoManualStaff} from "@/lib/ho-manual-staff-create-client";
import type {readHoManualStaffReceipt} from "@/lib/ho-manual-staff-readback-client";
export type StaffCreateAdmission="record-only"|"record-and-login";
export function createNativeStaffCommand(options:{admission:()=>StaffCreateAdmission|undefined;authorized:()=>boolean;centers:()=>readonly StaffCenterOption[];submit?:typeof createHoManualStaff;read?:typeof readHoManualStaffReceipt;makeKey?:()=>string;state?:HoStaffCreateState}){
  const state=options.state??createHoStaffCreateState();
  const submit=createHoStaffCreateFlow(state,{...(options.submit?{submit:options.submit}:{}),...(options.makeKey?{makeKey:options.makeKey}:{})});
  return {
    pending:()=>state.pending!==null,
    async create(command:StaffCreateCommand){
      const admission=options.admission();
      if(!admission||!options.authorized()||!options.centers().some(c=>c.id===command.centerId)||(command.login!==null&&admission!=="record-and-login"))throw Error("Staff create not admitted");
      await submit(command);
    },
    async readback(){
      if(!options.admission()||!options.authorized())throw Error("Staff readback not admitted");
      return (await reconcileHoStaffCreate(state,options.read)).state==="COMMITTED";
    },
  };
}
