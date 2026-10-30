"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {passDefinition,passFields,passProvider,passQuery} from "./schema";
import {HoWalkinBatchCreate} from "./HoWalkinBatchCreate";
type F=typeof passFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
/** Single canonical HO TDD table/drawer/detail; bounded create action uses Core HO BFF. */
export function HoWalkinPassTdd(){
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createHoTddAdapter({registry:new TddRegistry(),definition:passDefinition,provider:passProvider},controller.signal)
   .then(result=>{
    adapter=result;if(controller.signal.aborted){result.dispose();return;}
    setReady({adapter:result,navigation:browserTddNavigation("HO","walkinPasses",passQuery)});
   })
   .catch(()=>{if(!controller.signal.aborted)setError(true)});
  return()=>{controller.abort();adapter?.dispose()};
 },[retry]);
 const content=error?
  <p role="alert">Không tải được kho Pass. <button onClick={()=>{setReady(null);setError(false);setRetry(n=>n+1)}}>Thử lại</button></p>:
  ready?<div data-testid="ho-walkin-pass-tdd">
   <HoWalkinBatchCreate authorized={ready.adapter.context.authorize("open_studio.walkin_pass.manage")} onVerified={()=>setRefresh(n=>n+1)}/>
   <SurfaceWorkspace key={refresh} adapter={ready.adapter} navigation={ready.navigation} initialQuery={passQuery}/>
   <p role="note">Hiển thị tối đa 100 Pass gần nhất từ Core. Không suy diễn tồn kho ngoài cửa sổ này.</p>
  </div>:<p role="status">Đang tải Pass từ Core…</p>;
 return <HoWorkspace module="walkinPasses" content={content}/>;
}
