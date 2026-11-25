"use client";
// PAP-2358 · WFM-STAFF. Native caller seam; route activation and create command remain separate.
import {useEffect,useState,useMemo,useRef} from "react";
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
import {createNativeStaffCommand,type StaffCreateAdmission} from "./staff-native-command";
type Ready={adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>;navigation:AdapterNavigation<ManualStaffFields>};
export function StaffNativeWorkspace({principalId,createAdmission}:{principalId:string;createAdmission?:StaffCreateAdmission}){
  const [ready,setReady]=useState<Ready|null>(null);
  const [centers,setCenters]=useState<readonly StaffCenterOption[]>([]);
  const [error,setError]=useState(false),[centerError,setCenterError]=useState(false),[retry,setRetry]=useState(0);
  const current=useRef<{admission:StaffCreateAdmission|undefined;ready:Ready|null;centers:readonly StaffCenterOption[];principalId:string}>({admission:undefined,ready:null,centers:[],principalId});
  useEffect(()=>{current.current={admission:createAdmission,ready,centers,principalId};},[createAdmission,ready,centers,principalId]);
  const command=useMemo(()=>createNativeStaffCommand({
    admission:()=>current.current.admission,
    authorized:()=>{const c=current.current;return c.principalId===principalId&&c.ready?.adapter.userId===principalId&&c.ready.adapter.context.authorize("team.bo.access")===true;},
    centers:()=>current.current.centers,
  }),[principalId]);
  const personReader=useMemo(()=>createStaffPersonReader(),[ ]);
  useEffect(()=>{
    const controller=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<ManualStaffFields>|undefined;
    void createHoTddAdapter({registry:new TddRegistry(),definition:manualStaffDefinition,provider:nativeManualStaffProvider},controller.signal).then(result=>{
      adapter=result;
      if(controller.signal.aborted||result.userId!==principalId||result.scope.surface!=="HO"||!result.context.authorize("team.bo.access")){
        result.dispose();if(!controller.signal.aborted)setError(true);return;
      }
      setReady({adapter:result,navigation:browserTddNavigation("HO","staffs",manualStaffQuery)});
      void readManualStaffCenters(fetch,controller.signal).then(options=>{if(!controller.signal.aborted)setCenters(options);}).catch(()=>{if(!controller.signal.aborted)setCenterError(true);});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>{controller.abort();adapter?.dispose();};
  },[principalId,retry]);
  const restart=()=>{setReady(null);setCenters([]);setError(false);setCenterError(false);setRetry(x=>x+1);};
  return <HoWorkspace module="staffs" content={error?<p role="alert">Không tải được danh sách Staff. <button type="button" onClick={restart}>Thử lại</button></p>:ready&&ready.adapter.userId===principalId?<><StaffManualWorkspace adapter={ready.adapter} navigation={ready.navigation} centers={centers} onCreate={createAdmission&&centers.length?command.create:undefined} personReader={createAdmission?personReader:undefined} recovery={createAdmission?command:undefined} allowLogin={createAdmission==="record-and-login"} detailSlots={{
    businessForms:[staffRateProvider],
    detailProperties:(properties,_context,id)=><StaffRoleAccess key={properties.record.id} properties={staffNativeOverviewProperties(properties)} staffId={properties.record.id} active={properties.record.status==="Đang làm"} principalId={id}/>,
    detailOverview:(record,context,id)=><StaffPasswordReset staffId={record.id} displayName={String(record.name)} active={record.status==="Đang làm"} authorized={context.authorize("access.staff_password.reset")} principalId={id}/>,
  }}/>{centerError?<p role="status">Không tải được danh sách cơ sở. <button type="button" onClick={restart}>Thử lại</button></p>:null}</>:<p role="status">Đang tải Staff…</p>}/>;
}
