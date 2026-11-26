/** PAP-2395: offline mounted actual HO adapter and Staff workspace. Never imported by product routes. */
import {createRoot} from "react-dom/client";
import {createHoTddAdapter} from "../../lib/workspace-adapters";
import {browserTddNavigation} from "../../lib/workspace-adapters/navigation";
import {TddRegistry} from "../../lib/workspace-schema";
import {StaffManualWorkspace} from "../../app/ho/staff/StaffManualWorkspace";
import {manualStaffDefinition,manualStaffQuery} from "../../app/ho/staff/manual-create-contract";
import {nativeManualStaffProvider} from "../../app/ho/staff/native-staff-provider";
import {readManualStaffCenters} from "../../app/ho/staff/manual-staff-centers";
import {createStaffPersonReader} from "../../app/ho/staff/staff-person-reader";
import {createNativeStaffCommand,createNativeStaffOperationState,restoreNativeStaffOperation} from "../../app/ho/staff/staff-native-command";
import {createStaffRecoveryJournal} from "../../app/ho/staff/staff-recovery-journal";
if(location.origin!=="https://ho.staging.pinohouse.art"||location.pathname!=="/ho/staff")throw Error("Offline fixture origin");
const root=createRoot(document.getElementById("root")!);
async function mount(){
 const signal=new AbortController().signal;
 const adapter=await createHoTddAdapter({registry:new TddRegistry(),definition:manualStaffDefinition,provider:nativeManualStaffProvider},signal);
 if(adapter.userId!=="synthetic-founder")throw Error("Wrong fixture principal");
 const centers=await readManualStaffCenters(fetch,signal);
 const journal=createStaffRecoveryJournal(sessionStorage,adapter.userId),state=createNativeStaffOperationState();
 restoreNativeStaffOperation(state,journal);
 const command=createNativeStaffCommand({admission:()=>"record-only",authorized:()=>adapter.context.authorize("team.bo.access"),centers:()=>centers,state,journal});
 root.render(<StaffManualWorkspace adapter={adapter} navigation={browserTddNavigation("HO","staffs",manualStaffQuery)} centers={centers} onCreate={command.create} recovery={command} allowLogin={false} personReader={createStaffPersonReader()}/>);
}
void mount().catch(error=>root.render(<p role="alert">{String(error)}</p>));