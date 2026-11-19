/** PAP-2172 isolated synthetic UI review; not a production route or alternate prototype. */
import {useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {TddRenderer} from "@/app/components/workspace-renderer/Renderer";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {TddDetail,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import type {SlotLoaders} from "@/app/components/workspace-renderer/Slots";
import {TddRegistry,type AuthorizationContext,type TableQuery} from "@/lib/workspace-schema";
import {postDefinition,postModule,postQuery,POST_PREVIEW_READ,type PostFields} from "@/app/bo/piner-posts/schema";
import {privateMediaSlot,validatePrivateMediaSelection,type PrivateMediaRow,type PrivateMediaShellState} from "@/app/bo/piner-posts/private-media-shell";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const registry=new TddRegistry();
const schema=registry.register({...postDefinition,detail:{...postDefinition.detail,businessTabs:postDefinition.detail.businessTabs.filter(x=>x.id==="media")}});
const context:AuthorizationContext={surface:"BO",centerId:"019d2000-0001-7000-8000-000000000001",authorize:p=>p===POST_PREVIEW_READ};
type Item=PrivateMediaRow&{url:string};
function Fixture(){
 const [rows,setRows]=useState<Item[]>([]),[tab,setTab]=useState("media"),[preview,setPreview]=useState<string|null>(null),[error,setError]=useState(""),[mode,setMode]=useState("edit");
 const [position,setPosition]=useState<"table"|"drawer"|"detail">("table");const [query,setQuery]=useState<TableQuery<PostFields>>(postQuery);
 const current=useRef<Item[]>([]); const nextId=useRef(0);
 useEffect(()=>()=>{current.current.forEach(item=>URL.revokeObjectURL(item.url));current.current=[];},[]);
 const record=useMemo(()=>({id:"qa-post-media",name:"QA Minh Khang",caption:"",author:"PINO Afterschool",status:"Nháp",center:"Synthetic Center A",source:rows.length?"Upload trực tiếp":"Chưa có",mediaCount:rows.length,commentCount:0,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null}),[rows.length]);
 const loaders=useMemo<SlotLoaders>(()=>({"posts-local-content":async(slot,rec,ctx,signal)=>{
  signal.throwIfAborted();if(ctx!==context||rec.id!=="qa-post-media"||slot.id!=="media")throw Error("fixture scope");
  const active=rows.find(r=>r.id===preview);
  const state:PrivateMediaShellState=mode==="denied"?{status:"denied"}:mode==="error"?{status:"error"}:mode==="loading"?{status:"loading"}:{status:"ready",rows,canEdit:mode==="edit",busy:mode==="pending",error,...(active?{preview:{id:active.id,url:active.url}}:{})};
  return privateMediaSlot(state,{
   select(files){if(mode!=="edit")return;const reason=validatePrivateMediaSelection(files,current.current.length);setError(reason??"");if(reason)return;
    const added=files.map(f=>({id:"qa-media-"+(++nextId.current),name:f.name,bytes:f.size,state:"ready" as const,url:URL.createObjectURL(f)}));current.current=[...current.current,...added];setRows(current.current);},
   preview(id){if(current.current.some(r=>r.id===id))setPreview(id);},closePreview(){setPreview(null);},
   remove(id){if(mode!=="edit")return;const item=current.current.find(r=>r.id===id);if(!item)return;URL.revokeObjectURL(item.url);current.current=current.current.filter(r=>r.id!==id);setRows(current.current);setPreview(old=>old===id?null:old);setError("");},
   retry(){setMode("edit");}
  });
 }}),[mode,rows,preview,error]);
 return <TddPreferencePolicy.Provider value="ephemeral"><div className="bo-workspace"><section className="v24-prop-section"><p>QA local · Private Media · Không kết nối Core</p><label>Trạng thái mẫu <select aria-label="Trạng thái mẫu" value={mode} onChange={e=>{setMode(e.target.value);setPreview(null);setError("");}}>{["edit","read-only","pending","loading","error","denied"].map(v=><option key={v}>{v}</option>)}</select></label></section>{position==="detail"?<TddDetail registry={registry} schema={schema} context={context} record={record} subject={{type:"local-post",id:record.id}} activeTab={tab} onTabChange={setTab} onBack={()=>{setTab("overview");setPreview(null);setPosition("table");}} loaders={loaders}/>:<><TddRenderer view={{kind:"table",props:{registry,schema,context,rows:[record],query,status:"ready",onQueryChange:setQuery,onOpen:()=>setPosition("drawer")}}}/>{position==="drawer"?<BoQuickView module={postModule} moduleKey="piner-posts" record={record} onClose={()=>setPosition("table")} onDetail={()=>{setTab("overview");setPosition("detail");}}/>:null}</>}</div></TddPreferencePolicy.Provider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
