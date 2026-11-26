/** PAP-2358 isolated synthetic browser fixture. No product route or real auth. */
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {TddRegistry} from "../../lib/workspace-schema";
import {manualStaffDefinition} from "../../app/ho/staff/manual-create-contract";
import {StaffManualCreateDrawer} from "../../app/ho/staff/StaffManualCreateDrawer";
import {createStaffPersonReader} from "../../app/ho/staff/staff-person-reader";
import {createNativeStaffCommand,createNativeStaffOperationState,restoreNativeStaffOperation} from "../../app/ho/staff/staff-native-command";
import {createStaffRecoveryJournal} from "../../app/ho/staff/staff-recovery-journal";
if(location.origin!=="https://staff-create-test.invalid")throw Error("Synthetic origin only");
const centers=[{id:"019a0000-0000-7000-8000-000000000001",label:"QA Center"}];
const schema=new TddRegistry().register({...manualStaffDefinition,data:{id:"pap2358-fixture",list:async()=>({rows:[],total:0}),detail:async()=>null}});
const journal=createStaffRecoveryJournal(sessionStorage,"qa-principal");
const state=createNativeStaffOperationState();
restoreNativeStaffOperation(state,journal);
const admission="record-only" as const;
const command=createNativeStaffCommand({admission:()=>admission,authorized:()=>true,centers:()=>centers,state,journal});
const reader=createStaffPersonReader();
function Fixture(){
 const [open,setOpen]=useState(false),[closed,setClosed]=useState(0);
 return <><button type="button" onClick={()=>setOpen(true)}>{command.restored()?"Khôi phục yêu cầu tạo Staff":"Tạo nhân sự"}</button><p data-testid="closed">{closed}</p>
 {open?<StaffManualCreateDrawer schema={schema} context={{surface:"HO",authorize:()=>true}} centers={centers} personReader={reader} allowLogin={false} recovery={command} onCreate={command.create} onClose={()=>{setOpen(false);setClosed(c=>c+1);}}/>:null}</>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
