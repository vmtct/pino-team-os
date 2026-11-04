"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import {BoRegistrationWorkspace} from "../components/registration/BoRegistrationWorkspace";
import {useBoCenterSelection} from "../components/registration/BoCenterSelection";
import {useBoStagingUser} from "../components/registration/BoRuntimeBoundary";
import {unifiedBoWorkspaceSource} from "../architecture/bo-unified-workspace-source";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {TddRegistry} from "@/lib/workspace-schema";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {billError} from "@/lib/bo-bills-api";
import {billFields,billDefinition,billProvider,billQuery} from "./schema";
import {BillDraftEditor} from "./BillDraftEditor";

type F=typeof billFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const source={...unifiedBoWorkspaceSource,modules:{...unifiedBoWorkspaceSource.modules,bills:{label:"Bills",group:"TÀI CHÍNH",fields:billFields.map(f=>({key:f.key,label:f.label,type:f.type,icon:f.icon,w:f.width,readonly:true}))}}};
export function BoBillsTdd(){
 const center=useBoCenterSelection(),user=useBoStagingUser();
 const selected=center?.selected??"";
 return <BoRegistrationWorkspace source={source} moduleKey="bills" currentUser={{displayName:user?.displayName??null}} content={
  center&&!center.loading&&!center.error&&selected?<BillsAtCenter key={selected} centerId={selected} centerSource={center.source}/>:<p role={center?.error?"alert":"status"}>{center?.error||"Chọn cơ sở để xem Bills."}</p>
 }/>;
}
function BillsAtCenter({centerId,centerSource}:{centerId:string;centerSource:"centers"|"workforce/planning/bootstrap"}){
 const [ready,setReady]=useState<Ready|null>(null),[error,setError]=useState(""),[revision,setRevision]=useState(0),[editor,setEditor]=useState<{id?:string}|null>(null);
 useEffect(()=>{const ctl=new AbortController();let bound:AuthenticatedSurfaceAdapter<F>|null=null;
  void createBoTddAdapter({registry:new TddRegistry(),definition:billDefinition,provider:billProvider,centerId,centerSource},ctl.signal).then(adapter=>{bound=adapter;if(ctl.signal.aborted){adapter.dispose();return;}setReady({adapter,navigation:browserTddNavigation("BO","bills",billQuery)});}).catch(e=>{if(!ctl.signal.aborted)setError(billError(e));});
  return()=>{ctl.abort();bound?.dispose();};
 },[centerId,centerSource,revision]);
 const refresh=()=>{setReady(null);setError("");setRevision(n=>n+1);};
 return <section aria-label="Bills tại Center">
  {error?<p role="alert">{error} <button type="button" className="secondary-btn" onClick={refresh}>Thử lại</button></p>:ready?<><SurfaceWorkspace adapter={ready.adapter} navigation={ready.navigation} initialQuery={billQuery}
   actionBindings={{"bill.create":{kind:"navigation",run:()=>setEditor({})}}}
   detailOverview={row=>row.status==="Bản nháp"&&ready.adapter.context.authorize("billing.manage")?<button className="primary-btn" type="button" onClick={()=>setEditor({id:row.id})}>Sửa Draft / Phát hành</button>:null}/>
   <p role="note">Danh s?ch t?i ?a 100 Draft v? Bill đã phát hành t? Draft, m?i c?p nh?t g?n ??y. Bills c? ngo?i Draft ch?a c? API danh s?ch.</p></>:<p role="status">Đang xác minh quyền và tải Bills…</p>}
  {editor?<BillDraftEditor centerId={centerId} id={editor.id} onClose={()=>{setEditor(null);refresh();}} onSaved={()=>{}}/>:null}
 </section>;
}
