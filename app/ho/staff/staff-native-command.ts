// PAP-2358 · WFM-STAFF. Caller admission and operation lifecycle; not route activation.
import type {StaffCreateCommand,StaffCenterOption} from "./manual-create-contract";
import {createHoStaffCreateFlow,createHoStaffCreateState,reconcileHoStaffCreate,manualStaffIntent,type HoStaffCreateState} from "@/lib/ho-manual-staff-create-flow";
import type {createHoManualStaff} from "@/lib/ho-manual-staff-create-client";
import type {readHoManualStaffReceipt} from "@/lib/ho-manual-staff-readback-client";
import type {StaffRecoveryJournal,StaffRecoveryRecord} from "./staff-recovery-journal";
export type StaffCreateAdmission="record-only"|"record-and-login";
export type NativeStaffOperationState=HoStaffCreateState&{busy?:boolean;restored?:boolean;reentry?:boolean};
export const createNativeStaffOperationState=():NativeStaffOperationState=>createHoStaffCreateState();
function restore(state:NativeStaffOperationState,record:StaffRecoveryRecord){
 state.pending={key:record.key,intent:"",centerId:record.centerId,withLogin:record.withLogin,...(record.existingPersonId?{existingPersonId:record.existingPersonId}:{}),phase:"uncertain"};
 state.restored=true;state.reentry=false;
}
export function restoreNativeStaffOperation(state:NativeStaffOperationState,journal:StaffRecoveryJournal){
 const record=journal.load();
 if(record&&!state.pending)restore(state,record);
 if(state.pending&&(!record||record.key!==state.pending.key))throw Error("Staff recovery journal mismatch");
}
export function createNativeStaffCommand(options:{admission:()=>StaffCreateAdmission|undefined;authorized:()=>boolean;centers:()=>readonly StaffCenterOption[];submit?:typeof createHoManualStaff;read?:typeof readHoManualStaffReceipt;makeKey?:()=>string;state?:NativeStaffOperationState;journal?:StaffRecoveryJournal}){
 const state=options.state??createNativeStaffOperationState(),journal=options.journal;
 const makeKey=options.makeKey??(()=>crypto.randomUUID());
 function clear(key:string,record:StaffRecoveryRecord|undefined){
  try{journal?.clear(key);state.restored=false;state.reentry=false;}
  catch(error){if(record)restore(state,record);throw error;}
 }
 return {
  pending:()=>state.pending!==null,
  restored:()=>state.restored===true,
  async create(command:StaffCreateCommand){
   const admission=options.admission();
   if(!admission||!options.authorized()||!options.centers().some(c=>c.id===command.centerId)||(command.login!==null&&admission!=="record-and-login"))throw Error("Staff create not admitted");
   if(state.busy)throw Error("Staff operation busy");
   if(state.restored&&!state.reentry)throw Error("Check original receipt first");
   state.busy=true;
   try{
    const prior=state.pending,key=prior?.key??makeKey();
    if(prior&&!state.restored&&prior.intent!==manualStaffIntent(command))throw Error("Staff recovery intent differs");
    const record=await journal?.prepare(command,key);
    if(state.restored&&prior)prior.intent=manualStaffIntent(command);
    const submit=createHoStaffCreateFlow(state,{...(options.submit?{submit:options.submit}:{}),makeKey:()=>key});
    try{await submit(command);}
    catch(error){if(!state.pending)clear(key,record);throw error;}
    clear(key,record);
   }finally{state.busy=false;}
  },
  async readback(){
   if(!options.admission()||!options.authorized()||state.busy)throw Error("Staff readback not admitted");
   state.busy=true;
   try{
    const key=state.pending?.key,record=journal?.load()??undefined;
    if(journal&&(!record||record.key!==key))throw Error("Staff recovery journal mismatch");
    const result=await reconcileHoStaffCreate(state,options.read);
    if(result.state==="COMMITTED"){if(key)clear(key,record);return true;}
    if(state.restored)state.reentry=true;
    return false;
   }finally{state.busy=false;}
  },
 };
}
