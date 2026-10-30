"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import { useEffect, useState } from "react";
import { createHoTddAdapter, type AuthenticatedSurfaceAdapter } from "@/lib/workspace-adapters";
import { browserTddNavigation, type AdapterNavigation } from "@/lib/workspace-adapters/navigation";
import { TddRegistry } from "@/lib/workspace-schema";
import { SurfaceWorkspace } from "@/app/components/workspace-adapters/SurfaceWorkspace";
import { HoWorkspace } from "@/app/ho/HoWorkspace";
import { termWeekDefinition,termWeekFields,termWeekProvider,termWeekQuery,verifyGlobalWeekExtensionApproval } from "./schema";
import { HoGlobalWeekLockEditor } from "./HoGlobalWeekLockEditor";
type F=typeof termWeekFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
export function HoTermWeeksTdd(){
  const [ready,setReady]=useState<Ready|null>(null);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
    void createHoTddAdapter({
      registry:new TddRegistry(verifyGlobalWeekExtensionApproval),
      definition:termWeekDefinition,provider:termWeekProvider,
    },controller.signal).then(result=>{
      adapter=result;
      if(controller.signal.aborted){result.dispose();return;}
      const navigation=browserTddNavigation("HO","termWeeks",termWeekQuery);
      setReady({adapter:result,navigation});
    }).catch(()=>{
      if(!controller.signal.aborted)setError(true);
    });
    return ()=>{controller.abort();adapter?.dispose();};
  },[retry]);
  const content=error
    ? <p role="alert">Không tải được Global TermWeek. <button type="button" onClick={()=>{
      setReady(null);setError(false);setRetry(v=>v+1);
    }}>Thử lại</button></p>
    :ready
      ?<SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={termWeekQuery}
        detailApprovedExtension={(row,context,activeTab,_principalId,onSaved)=>
          activeTab==="registration-lock"
            ? <HoGlobalWeekLockEditor key={row.id} termWeekId={row.id}
              authorized={context.authorize("operating_cycle.global_week.lock")} onSaved={onSaved} />
            : null}
      />
      :<p role="status">Đang tải Global TermWeek…</p>;
  return <HoWorkspace module="termWeeks" content={content}/>;
}
