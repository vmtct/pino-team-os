"use client";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import {useEffect,useState} from "react";
import readApi from "@/public/bo-authority-source/school-adapters.js";
import {BoRegistrationWorkspace,type BoWorkspaceSource} from "@/app/bo/components/registration/BoRegistrationWorkspace";
import {useBoCenterSelection} from "@/app/bo/components/registration/BoCenterSelection";
import type {DirectoryCenterSource} from "@/app/bo/pinoria-avatars/centers";
import {createBoTddAdapter,type AuthenticatedSurfaceAdapter} from "@/lib/workspace-adapters";
import {SurfaceWorkspace} from "@/app/components/workspace-adapters/SurfaceWorkspace";
import {browserTddNavigation,type AdapterNavigation} from "@/lib/workspace-adapters/navigation";
import {TddRegistry} from "@/lib/workspace-schema";
import {CenterPassActions} from "./CenterPassActions";
import {passDefinition,passFields,passProvider,passQuery} from "./schema";

type F=typeof passFields;
type Ready={centerId:string;adapter:AuthenticatedSurfaceAdapter<F>;navigation:AdapterNavigation<F>};
const source:BoWorkspaceSource={
 ...readApi,modules:{...readApi.modules,"open-studio-passes":{label:"Pass Trạm Nghệ Thuật",group:"Open Studio",fields:[
  {key:"code",label:"Mã Pass",type:"text",icon:"#",w:255,readonly:true},
  {key:"status",label:"Trạng thái",type:"text",icon:"◉",w:150,readonly:true},
  {key:"path",label:"Path",type:"text",icon:"▣",w:110,readonly:true},
  {key:"parent",label:"Parent ID",type:"text",icon:"@",w:280,readonly:true},
 ]}},
};

/** PAP-1460 / Epic PAP-1316: the authenticated BO shell is the only
 * workspace Center selector. Pass/Parent business actions remain Core-bound.
 */
export function BoOpenStudioPassesTdd(){
 const center=useBoCenterSelection();
 const selected=(!center||center.loading||center.error)?"":center.selected;
 const centerSource:DirectoryCenterSource=center?.source??"centers";
 const content=<section data-testid="bo-open-studio-passes-tdd" aria-label="Open Studio Pass tại Center">
  {!center?<p role="alert">Không tìm thấy Center context của BO.</p>:
   center.loading?<p role="status">Đang xác thực cơ sở được cấp quyền…</p>:
   center.error?<p role="alert">{center.error}</p>:
   !selected?<p role="status">Chọn trung tâm tại góc trên trái để xem Pass.</p>:
   <ScopedPasses key={selected+":"+centerSource} centerId={selected} centerSource={centerSource}/>}
 </section>;
 return <BoRegistrationWorkspace source={source} moduleKey="open-studio-passes" currentUser={{displayName:null}} content={content}/>;
}

/** A Center switch unmounts the previous domain controller, TDD navigation,
 * Parent proof drawer and read adapter. An already-sent Core command remains
 * tied to its original Center and receipt; never transfer/replay across Centers.
 */
function ScopedPasses({centerId,centerSource}:{centerId:string;centerSource:DirectoryCenterSource}){
 const [ready,setReady]=useState<Ready|null>(null);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let adapter:AuthenticatedSurfaceAdapter<F>|null=null;
  void createBoTddAdapter({registry:new TddRegistry(),definition:passDefinition,provider:passProvider,
   centerId,centerSource},controller.signal).then(bound=>{
    adapter=bound;
    if(controller.signal.aborted){bound.dispose();return;}
    setReady({centerId,adapter:bound,navigation:browserTddNavigation("BO","open-studio-passes",passQuery)});
  }).catch(e=>{
    if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không đủ quyền đọc Pass.");
  });
  return ()=>{controller.abort();adapter?.dispose();};
 },[centerId,centerSource,retry]);
 if(error)return <p role="alert">{error} <button type="button" onClick={()=>{setReady(null);setError("");setRetry(n=>n+1)}}>Thử lại</button></p>;
 if(ready?.centerId!==centerId)return <p role="status">Đang xác thực quyền Center và tải Pass…</p>;
 return <>
  <CenterPassActions key={centerId} centerId={centerId} onChanged={()=>setRefresh(n=>n+1)}/>
  <SurfaceWorkspace key={centerId+":"+refresh} adapter={ready.adapter} navigation={ready.navigation} initialQuery={passQuery}/>
  <p role="note">Danh sách tối đa 100 Pass của Center đã chọn từ Core. Không bao gồm kho chung chưa cấp.</p>
 </>;
}
