/** PAP-2134 integration test only: all actor/Center/Media responses synthetic, no network transport. */
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {TddDetail,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {NativePrivateMediaPanel} from "@/app/bo/piner-posts/NativePrivateMediaPanel";
import {draftRegistry,draftSchema} from "@/app/bo/piner-posts/native-draft-binding";
import {coreDraftClient,type CoreDraftRow} from "@/app/bo/piner-posts/core-draft-client";
import {createPrivateMediaController} from "@/app/bo/piner-posts/private-media-controller";
import {privatePostMediaClient} from "@/app/bo/piner-posts/private-media-client";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
const C="01900000-0000-7000-8000-000000000001",P="01900000-0000-7000-8000-000000000002",A="01900000-0000-7000-8000-000000000003",S="01900000-0000-7000-8000-000000000005";
let version=1,state="NONE",size=0,confirmKey:string|null=null,confirmCalls=0,reserveCalls=0,stored:Blob|null=null;
const readonly=new URLSearchParams(location.search).has("readonly");
const json=(data:unknown)=>Response.json({data});
const row=()=>({id:P,studentId:S,centerId:C,studentName:"QA Synthetic Student",centerName:"QA Center",caption:"Synthetic caption",status:"DRAFT",publisher:"PINO Afterschool",version,mediaCount:state==="READY"?1:0,createdAt:"2026-11-19T00:00:00Z",updatedAt:"2026-11-19T00:00:00Z",createdBy:null,updatedBy:null});
const item=(v:number,p:number)=>({id:A,state,mimeType:"image/png",byteSize:size,version:v,postVersion:p,expiresAt:"2026-11-19T14:00:00Z"});
const fetcher:typeof fetch=async(input,init)=>{
 const url=new URL(String(input),"http://synthetic.invalid"),method=init?.method??"GET";init?.signal?.throwIfAborted();
 if(url.origin!=="http://synthetic.invalid")throw Error("Unexpected synthetic origin");
 if(url.searchParams.get("centerId")!==C)throw Error("Unexpected synthetic Center");
 const base="/api/bo/learning/piner-posts/"+P,media=base+"/attachments";
 if(url.pathname===base&&method==="GET")return json(row());
 if(url.pathname===media&&method==="GET")return json({postVersion:version,mediaCount:state==="READY"?1:0,attachments:state==="READY"?[item(2,3)]:[]});
 if(method==="POST"&&readonly)throw Error("Unexpected readonly write");
 const h=new Headers(init?.headers);
 if(url.pathname===media&&method==="POST"){
  reserveCalls++;if(state!=="NONE"||h.get("x-pino-post-version")!=="1"||!(init?.body instanceof Blob))throw Error("Unexpected reserve");
  stored=init.body;size=stored.size;state="RESERVED";version=2;return json({attachment:item(1,2),committedPostVersion:2,committedAttachmentVersion:1,replayed:false});
 }
 if(url.pathname===media+"/"+A+"/confirm"&&method==="POST"){
  confirmCalls++;const key=h.get("idempotency-key");if(h.get("x-pino-post-version")!=="2"||h.get("x-pino-attachment-version")!=="1"||!key||confirmKey!==null&&key!==confirmKey)throw Error("Confirm key/version drift");
  confirmKey=key;state="READY";version=3;if(confirmCalls===1)throw Error("Synthetic lost response after commit");
  return json({attachment:item(2,3),committedPostVersion:3,committedAttachmentVersion:2,replayed:true});
 }
 if(url.pathname===media+"/"+A+"/preview"&&method==="GET"&&stored&&state==="READY")return new Response(stored,{headers:{"content-type":"image/png","content-length":String(size)}});
 if(url.pathname===media+"/"+A+"/revoke"&&method==="POST"&&state==="READY"){
  state="REVOKED";version=4;stored=null;return json({attachment:item(3,4),committedPostVersion:4,committedAttachmentVersion:3,replayed:false});
 }
 throw Error("Unexpected synthetic operation");
};
const context:AuthorizationContext={surface:"BO",centerId:C,authorize:permission=>permission==="piner.post.view"||(!readonly&&permission==="piner.post.edit")};
const media=createPrivateMediaController(privatePostMediaClient(C,P,fetcher),write=>!write||!readonly);
const controller=coreDraftClient(C,fetcher);
const session={context,controller,canEditMedia:()=>!readonly,mediaController:(postId:string)=>{if(postId!==P)throw Error("Synthetic scope mismatch");return media;}};
function Fixture(){
 const [record,setRecord]=useState<CoreDraftRow|null>(null),[tab,setTab]=useState("media"),[error,setError]=useState("");
 useEffect(()=>{const ctl=new AbortController();void controller.detail(P,ctl.signal).then(r=>{if(!ctl.signal.aborted)setRecord(r);}).catch(e=>{if(!ctl.signal.aborted)setError(String(e));});return()=>{ctl.abort();media.dispose();};},[]);
 if(error)return <p role="alert">{error}</p>;
 if(!record)return <p>Loading synthetic fixture</p>;
 return <TddPreferencePolicy.Provider value="ephemeral"><div className="bo-workspace"><output data-testid="receipt">{JSON.stringify({version:record.version,count:record.mediaCount,reserveCalls,confirmCalls})}</output><TddDetail registry={draftRegistry} schema={draftSchema} context={context} record={record} subject={{type:"piner_post_draft",id:P}} onBack={()=>setTab("overview")} activeTab={tab} onTabChange={setTab} renderApprovedExtension={(_r,_ctx,t)=>t==="media"?<NativePrivateMediaPanel session={session} postId={P} onVerified={setRecord}/>:null}/></div></TddPreferencePolicy.Provider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
