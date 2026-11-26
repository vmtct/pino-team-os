"use client";
// PAP-2358 · WFM-STAFF. Native caller seam; route activation and create command remain separate.
import {useEffect,useState,useMemo} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {HoWorkspace} from "../HoWorkspace";
import {StaffManualWorkspace} from "./StaffManualWorkspace";
import {StaffRoleAccess} from "./StaffRoleAccess";
import {StaffPasswordReset} from "./StaffPasswordReset";
import {staffRateProvider} from "./staff-rate-provider";
import {manualStaffDefinition,manualStaffQuery,type ManualStaffFields,type StaffCenterOption} from "./manual-create-contract";
import {nativeManualStaffProvider} from "./native-staff-provider";
import {readManualStaffCenters} from "./manual-staff-centers";
import {staffNativeOverviewProperties} from "./staff-native-overview";

import {createStaffPersonReader} from "./staff-person-reader";
import {createNativeStaffCommand,createNativeStaffOperationState,restoreNativeStaffOperation,type StaffCreateAdmission} from "./staff-native-command";
import {createStaffRecoveryJournal,type StaffRecoveryJournal} from "./staff-recovery-journal";
type Ready={adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>;navigation:AdapterNavigation<ManualStaffFields>;signal:AbortSignal};
export function StaffNativeWorkspace({principalId,createAdmission}:{principalId:string;createAdmission?:StaffCreateAdmission}){
  const [ready,setReady]=useState<Ready|null>(null);
  const [centers,setCenters]=useState<readonly StaffCenterOption[]>([]);
  const [error,setError]=useState(false),[centerError,setCenterError]=useState(false),[retry,setRetry]=useState(0);
  const [operationState]=useState(createNativeStaffOperationState);
  const [journal,setJournal]=useState<StaffRecoveryJournal|null>(null),[journalError,setJournalError]=useState(false);
  const command=useMemo(()=>createNativeStaffCommand({
    principalId,state:operationState,...(journal?{journal}:{}),
    admission:()=>createAdmission,
    authorized:()=>!!ready&&!ready.signal.aborted&&ready.adapter.userId===principalId&&ready.adapter.context.authorize("team.bo.access")===true,
    centers:()=>centers,
  }),[operationState,createAdmission,ready,centers,principalId,journal]);
  const personReader=useMemo(()=>createStaffPersonReader(),[]);
  useEffect(()=>{
    const controller=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>|undefined;
    void createHoTddAdapter({registry:new TddRegistry(),definition:manualStaffDefinition,provider:nativeManualStaffProvider},controller.signal).then(result=>{
      adapter=result;
      if(controller.signal.aborted||result.userId!==principalId||result.scope.surface!=="HO"||!result.context.authorize("team.bo.access")){
        result.dispose();if(!controller.signal.aborted)setError(true);return;
      }
      if(createAdmission){
        try{
          const next=createStaffRecoveryJournal(window.sessionStorage,principalId);
          restoreNativeStaffOperation(operationState,next);
          setJournal(next);setJournalError(false);
        }catch{setJournal(null);setJournalError(true);}
      }else{setJournal(null);setJournalError(false);}
      setReady({adapter:result,navigation:browserTddNavigation("HO","staffs",manualStaffQuery),signal:controller.signal});
      void readManualStaffCenters(fetch,controller.signal).then(options=>{if(!controller.signal.aborted)setCenters(options);}).catch(()=>{if(!controller.signal.aborted)setCenterError(true);});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>{controller.abort();adapter?.dispose();};
  },[principalId,retry,createAdmission,operationState]);
  const restart=()=>{setReady(null);setCenters([]);setError(false);setCenterError(false);setRetry(x=>x+1);};
  return <HoWorkspace module="staffs" content={error?<p role="alert">Không tải được danh sách Staff. <button type="button" onClick={restart}>Thử lại</button></p>:ready&&ready.adapter.userId===principalId?<><StaffManualWorkspace adapter={ready.adapter} navigation={ready.navigation} centers={centers} onCreate={createAdmission&&journal&&(centers.length||command.pending())?command.create:undefined} personReader={createAdmission?personReader:undefined} recovery={createAdmission&&journal?command:undefined} allowLogin={false} detailSlots={{
    businessForms:[staffRateProvider],
    detailProperties:(properties,_context,id)=><StaffRoleAccess key={properties.record.id} properties={staffNativeOverviewProperties(properties)} staffId={properties.record.id} active={properties.record.status==="Đang làm"} principalId={id}/>,
    detailOverview:(record,context,id)=><StaffPasswordReset staffId={record.id} displayName={String(record.name)} active={record.status==="Đang làm"} authorized={context.authorize("access.staff_password.reset")} principalId={id}/>,
  }}/>{journalError?<p role="alert">Không thể xác minh nhật ký yêu cầu tạo Staff. Tạm khóa tạo nhân sự.</p>:null}{centerError?<p role="status">Không tải được danh sách cơ sở. <button type="button" onClick={restart}>Thử lại</button></p>:null}</>:<p role="status">Đang tải Staff…</p>}/>;
}
