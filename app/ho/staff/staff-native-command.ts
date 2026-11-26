// PAP-2395 · WFM-STAFF. Phase1 admission and committed readback fence.
import type {StaffCreateCommand,StaffCenterOption} from "./manual-create-contract";
import {createHoStaffCreateFlow,createHoStaffCreateState,reconcileHoStaffCreate,manualStaffIntent,type HoStaffCreateState} from "@/lib/ho-manual-staff-create-flow";
import {createHoManualStaff,staffExpectedPrincipalHeader,validExpectedStaffPrincipal} from "@/lib/ho-manual-staff-create-client";
import {readHoManualStaffReceipt} from "@/lib/ho-manual-staff-readback-client";
import type {HoManualStaffReceipt} from "@/lib/ho-manual-staff-create-receipt";
import type {StaffRecoveryJournal,StaffRecoveryRecord} from "./staff-recovery-journal";
import {verifyManualStaffCommitted} from "./native-staff-provider";
export type StaffCreateAdmission="record-only";
type Committed={key:string;receipt:HoManualStaffReceipt};
export type NativeStaffOperationState=HoStaffCreateState&{busy?:boolean;restored?:boolean;committed?:Committed};
export const createNativeStaffOperationState=():NativeStaffOperationState=>createHoStaffCreateState();
function restore(state:NativeStaffOperationState,record:StaffRecoveryRecord){
 state.pending={key:record.key,intent:"",centerId:record.centerId,withLogin:false,phase:"uncertain"};
 state.restored=true;
}
export function restoreNativeStaffOperation(state:NativeStaffOperationState,journal:StaffRecoveryJournal){
 const record=journal.load();
 if(record&&!state.pending&&!state.committed)restore(state,record);
 if(state.pending&&(!record||record.key!==state.pending.key))throw Error("Staff recovery journal mismatch");
 if(state.committed&&record&&(record.key!==state.committed.key||record.centerId!==state.committed.receipt.centerId))throw Error("Staff committed journal mismatch");
}
export function createNativeStaffCommand(options:{principalId?:string;admission:()=>StaffCreateAdmission|undefined;authorized:()=>boolean;centers:()=>readonly StaffCenterOption[];submit?:typeof createHoManualStaff;read?:typeof readHoManualStaffReceipt;verify?:(receipt:HoManualStaffReceipt)=>Promise<void>;makeKey?:()=>string;state?:NativeStaffOperationState;journal?:StaffRecoveryJournal}){
 const state=options.state??createNativeStaffOperationState(),journal=options.journal;
 const makeKey=options.makeKey??(()=>crypto.randomUUID());
 const submit=options.submit??((command,key)=>createHoManualStaff(command,key,{principalId:options.principalId}));
 const read=options.read??((centerId,key,withLogin)=>readHoManualStaffReceipt(centerId,key,withLogin,{principalId:options.principalId}));
 const verify=options.verify??((receipt:HoManualStaffReceipt)=>verifyManualStaffCommitted(receipt,async(input,init)=>{
  if(!validExpectedStaffPrincipal(options.principalId))throw Error("Staff principal unavailable");
  const headers=new Headers(init?.headers);headers.set(staffExpectedPrincipalHeader,options.principalId);
  return fetch(input,{...init,headers});
 }));
 const admitted=(centerId:string)=>options.admission()==="record-only"&&options.authorized()&&options.centers().some(c=>c.id===centerId);
 function clearRejected(key:string,record:StaffRecoveryRecord|undefined){
  try{journal?.clear(key);state.restored=false;}
  catch(error){if(record)restore(state,record);throw error;}
 }
 async function confirm(){
  const committed=state.committed;
  if(!committed||!admitted(committed.receipt.centerId))throw Error("Staff committed readback not admitted");
  await verify(committed.receipt);
  if(!admitted(committed.receipt.centerId))throw Error("Staff scope changed during readback");
  journal?.clear(committed.key);
  state.committed=undefined;state.restored=false;
 }
 return {
  pending:()=>state.pending!==null||state.committed!==undefined,
  restored:()=>state.restored===true,
  committed:()=>state.committed!==undefined,
  async create(command:StaffCreateCommand){
   if(!admitted(command.centerId)||command.login!==null)throw Error("Staff create not admitted");
   if(state.busy)throw Error("Staff operation busy");
   if(state.committed)throw Error("Committed Staff operation is readback only");
   if(state.restored)throw Error("Restored operation is readback only; original receipt required");
   state.busy=true;
   try{
    const prior=state.pending,key=prior?.key??makeKey();
    if(prior&&prior.intent!==manualStaffIntent(command))throw Error("Staff recovery intent differs");
    const record=journal?.prepare(command,key);
    const dispatch=createHoStaffCreateFlow(state,{submit,makeKey:()=>key});
    let receipt:HoManualStaffReceipt;
    try{receipt=await dispatch(command);}
    catch(error){if(!state.pending)clearRejected(key,record);throw error;}
    state.committed={key,receipt};
    await confirm();
   }finally{state.busy=false;}
  },
  async readback(){
   const centerId=state.committed?.receipt.centerId??state.pending?.centerId;
   if(!centerId||!admitted(centerId)||state.busy)throw Error("Staff readback not admitted");
   state.busy=true;
   try{
    if(state.committed){await confirm();return true;}
    const key=state.pending?.key,record=journal?.load()??undefined;
    if(!key||journal&&(!record||record.key!==key||record.centerId!==centerId))throw Error("Staff recovery journal mismatch");
    const result=await reconcileHoStaffCreate(state,read);
    if(result.state==="COMMITTED"){state.committed={key,receipt:result.receipt};await confirm();return true;}
    if(!admitted(centerId))throw Error("Staff scope changed during readback");
    return false;
   }finally{state.busy=false;}
  },
 };
}