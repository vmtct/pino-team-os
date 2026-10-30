"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {roleDefinition,roleFields,roleProvider,roleQuery,verifyRolePermissionTabApproval} from "./schema";
import {HoRoleEditor} from "./HoRoleEditor";

type F=typeof roleFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
/** Canonical HO TDD controller; no duplicate role table/shell or generic HO mutation rights. */
export function HoRolesTdd(){
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(verifyRolePermissionTabApproval),definition:roleDefinition,provider:roleProvider},controller.signal)
    .then(result=>{
      adapter=result;
      if(controller.signal.aborted){result.dispose();return;}
      const navigation=browserTddNavigation("HO","roles",roleQuery);
      setReady({adapter:result,navigation});
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>{controller.abort();adapter?.dispose();};
 },[retry]);
 const content=error
  ? <p role="alert">Không tải được Roles. <button type="button" onClick={()=>{setReady(null);setError(false);setRetry(n=>n+1);}}>Thử lại</button></p>
  : ready
    ? <SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={roleQuery}
      detailApprovedExtension={(row,context,activeTab)=> <HoRoleEditor key={row.id} roleId={row.id}
        assignmentCount={Number(row.assignmentCount)} activeTab={activeTab}
        authorized={context.authorize("access.role.edit")} />} />
    : <p role="status">Đang tải Roles…</p>;
 return <HoWorkspace module="roles" content={content}/>;
}
