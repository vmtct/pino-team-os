"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {createHoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {billDefinition,billFields,billProvider,billQuery,verifyBillExtension} from "./schema";
import {BillDomain} from "./BillDomain";
type F=typeof billFields;
export function HoBillsTdd() {
  const [ready,setReady]=useState<{adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>}|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
    void createHoTddAdapter({registry:new TddRegistry(verifyBillExtension),definition:billDefinition,provider:billProvider},controller.signal)
      .then(value=>{adapter=value;if(controller.signal.aborted){value.dispose();return;}
        setReady({adapter:value,navigation:browserTddNavigation("HO","bills",billQuery)});})
      .catch(()=>{if(!controller.signal.aborted)setError("Không thể xác minh quyền HO Bills.");});
    return ()=>{controller.abort();adapter?.dispose();};
  },[retry]);
  return <HoWorkspace module="bills" content={<section aria-label="Bills">
    {error?<p role="alert">{error} <button type="button" className="secondary-btn" onClick={()=>{setError("");setReady(null);setRetry(n=>n+1);}}>Thử lại</button></p>
      :ready?<SurfaceWorkspace key={revision} adapter={ready.adapter} navigation={ready.navigation} initialQuery={billQuery}
        detailApprovedExtension={(row,_context,tab)=><BillDomain key={row.id+":"+tab} id={row.id} tab={tab} onSaved={()=>setRevision(n=>n+1)}/>}/>
      :<p role="status">Đang xác minh quyền HO…</p>}
  </section>}/>;
}
