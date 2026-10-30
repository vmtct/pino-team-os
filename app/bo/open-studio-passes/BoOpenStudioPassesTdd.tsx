"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {boApi} from "@/lib/bo-api";
import type {BoCenter} from "@/lib/bo-model";
import type {BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {BoRegistrationWorkspace} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {CenterPassActions} from "./CenterPassActions";
import {passDefinition,passFields,passProvider,passQuery} from "./schema";
type F=typeof passFields;
type Ready={adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const source:BoWorkspaceSource={
 ...readApi,modules:{...readApi.modules,"open-studio-passes":{label:"Pass Trạm Nghệ Thuật",group:"Open Studio",fields:[
  {key:"code",label:"Mã Pass",type:"text",icon:"#",w:255,readonly:true},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",w:150,readonly:true},
  {key:"path",label:"Path",type:"text",icon:"▣",w:110,readonly:true},
  {key:"parent",label:"Parent ID",type:"text",icon:"@",w:280,readonly:true},
 ]}},
};
export function BoOpenStudioPassesTdd(){
 const [centers,setCenters]=useState<readonly BoCenter[]>([]);
 const [centerId,setCenterId]=useState("");
 const [centerError,setCenterError]=useState("");
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void boApi.centers().then(rows=>{
   if(!active)return;
   const valid=rows.filter(c=>/^[0-9a-f-]{36}$/i.test(c.id)&&c.status==="ACTIVE");
   setCenters(valid);setCenterId(valid.length===1?valid[0]!.id:"");
   setCenterError(valid.length?"":"Không có Center đang hoạt động được cấp quyền.");
  }).catch(()=>{if(active)setCenterError("Không tải được danh sách Center.")});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!centerId)return;
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createBoTddAdapter({registry:new TddRegistry(),definition:passDefinition,provider:passProvider,centerId:centerId,centerSource:"centers"},controller.signal)
   .then(bound=>{
    adapter=bound;if(controller.signal.aborted){bound.dispose();return}
    setReady({adapter:bound,navigation:browserTddNavigation("BO","open-studio-passes",passQuery)});
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không đủ quyền đọc Pass.")});
  return()=>{controller.abort();adapter?.dispose()};
 },[centerId,retry]);
 const content=<section data-testid="bo-open-studio-passes-tdd" aria-label="Open Studio Pass tại Center">
  <div className="property-row"><label htmlFor="bo-open-studio-center">Center</label>
   <select id="bo-open-studio-center" value={centerId} onChange={e=>{setReady(null);setError("");setCenterId(e.target.value);setRefresh(0)}}>
    <option value="">Chọn Center</option>{centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
   </select>
  </div>
  {!centerId?<p role="status">{centerError||"Chọn Center để đọc Pass."}</p>:
   error?<p role="alert">{error} <button type="button" onClick={()=>{setError("");setRetry(n=>n+1)}}>Thử lại</button></p>:
   ready?<><CenterPassActions centerId={centerId} onChanged={()=>setRefresh(n=>n+1)}/>
     <SurfaceWorkspace key={centerId+":"+refresh} adapter={ready.adapter} navigation={ready.navigation} initialQuery={passQuery}/>
     <p role="note">Danh sách tối đa 100 Pass của Center đã chọn từ Core. Không bao gồm kho chung chưa cấp.</p>
    </>:<p role="status">Đang xác thực Center và tải Pass…</p>}
 </section>;
 return <BoRegistrationWorkspace source={source} moduleKey="open-studio-passes" currentUser={{displayName:null}} content={content}/>;
}
