/** PAP-2386 isolated mounted native Post test. All transport is in-memory; no live authentication. */
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {TddDetail,TddPreferencePolicy} from "@/app/components/workspace-renderer/Record";
import {NativePrivateMediaPanel} from "@/app/bo/piner-posts/NativePrivateMediaPanel";
import {openNativeDraftSession,type NativeDraftSession} from "@/app/bo/piner-posts/native-draft-session";
import type {CoreDraftRow} from "@/app/bo/piner-posts/core-draft-client";
import {draftRegistry,draftSchema} from "@/app/bo/piner-posts/native-draft-binding";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/bo-authority-source/bo-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0"),C=id(1),P=id(2),D=id(3),U=id(4),E=id(5),PERSON=id(6),PATH=id(7),USED=id(8);
const stamp="2026-11-26T00:00:00Z",origin="https://bo.staging.pinohouse.art",base="/api/bo/learning/piner-posts/"+P,params=new URLSearchParams(location.search),mytime=params.has("mytime");
const png="iVBORw0KGgoAAAANSUhEUgAAAGAAAABICAIAAACGBWc0AAAAhElEQVR4nO3QQQ0AIBDAsJODYjQhCwd82aPJBCydtY8ezfeDeIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQoHCBAgQIDCAQIECBCgcIAAAQIEKBwgQIAAAQp3ATD9JGiMmC98AAAAAElFTkSuQmCC",source=new Blob([Uint8Array.from(atob(png),x=>x.charCodeAt(0))],{type:"image/png"});
let v=1,selected=false,pending=false,order:string[]|null=null,confirmCalls=0,reserveCalls=0,linkCalls=0,submitCalls=0,selectionCalls=0;
type Asset={id:string;file:Blob;version:number;postVersion:number;state:"RESERVED"|"READY";confirmKey?:string};
const assets:Asset[]=[],provenance:{attachmentId:string;attachmentVersion:number;diaryId:string;evidenceId:string;transform:string}[]=[];
const ready=()=>assets.filter(a=>a.state==="READY"),scope=()=>({postId:P,centerId:C,version:v}),claim=()=>selected?"SELECTED":"AVAILABLE",json=(data:unknown)=>Response.json({data});
const row=()=>({id:P,studentId:mytime?null:id(9),personId:PERSON,personName:"QA Synthetic Person",studentName:mytime?null:"QA Synthetic Student",centerId:C,centerName:"QA Center",caption:"Synthetic caption",programKey:mytime?"MYTIME":"AFTERSCHOOL",publisher:mytime?"MyTime by PINO":"PINO Afterschool",status:pending?"PENDING_APPROVAL":"DRAFT",version:v,mediaCount:ready().length,createdAt:stamp,updatedAt:stamp,createdBy:null,updatedBy:null});
const item=(a:Asset)=>({id:a.id,state:a.state,mimeType:a.file.type,byteSize:a.file.size,version:a.version,postVersion:a.postVersion,expiresAt:stamp});
const desc={id:E,diaryId:D,mimeType:source.type,byteSize:source.size,confirmedAt:stamp};
const fetcher:typeof fetch=async(input,init)=>{
 const url=new URL(String(input),origin),method=init?.method??"GET",path=url.pathname,h=new Headers(init?.headers);init?.signal?.throwIfAborted();
 if(url.origin!==origin)throw Error("Non-synthetic destination");
 if(path==="/api/bo/context")return json({surface:"BO",entitled:true,userId:U,permissionKeys:["team.bo.access","piner.post.view","piner.post.create","piner.post.edit","piner.post.submit","piner.post.diary.compose"]});
 if(path==="/api/bo/centers")return json([{id:C}]);
 if(url.searchParams.get("centerId")!==C)throw Error("Scope mismatch");
 if(path===base&&method==="GET")return json(row());
 if(path===base+"/attachments"&&method==="GET")return json({postVersion:v,mediaCount:ready().length,attachments:ready().map(item)});
 if(path===base+"/workflow-state"&&method==="GET")return json({...scope(),status:row().status,diaryIds:selected?[D]:[],provenance,submittedAttachmentIds:order});
 if(path===base+"/submission-state"&&method==="GET")return json({...scope(),status:row().status,submittedAttachmentIds:order});
 if(path===base+"/diaries"&&method==="GET")return json({...scope(),diaries:[{diaryId:D,pathId:PATH,registeredAt:stamp,runningClassId:null,claimState:claim()},{diaryId:USED,pathId:PATH,registeredAt:stamp,runningClassId:null,claimState:"USED"}],nextAfter:null});
 if(path===base+"/diaries/"+D+"/photos"&&method==="GET")return json({...scope(),diaryId:D,claimState:claim(),photos:[desc]});
 if(path===base+"/diaries/"+D+"/photos/"+E&&method==="GET")return json({...desc,base64:png});
 const match=assets.find(a=>path.startsWith(base+"/attachments/"+a.id+"/"));
 if(match&&path.endsWith("/preview")&&method==="GET"&&match.state==="READY")return new Response(match.file,{headers:{"content-type":match.file.type,"content-length":String(match.file.size)}});
 if(method!=="POST"||pending)throw Error("Unexpected synthetic operation "+path);
 if(path===base+"/attachments"){
  if(!(init?.body instanceof Blob)||Number(h.get("x-pino-post-version"))!==v||!selected)throw Error("Invalid synthetic reserve");
  reserveCalls++;const a:Asset={id:id(20+assets.length),file:init.body,version:1,postVersion:++v,state:"RESERVED"};assets.push(a);return json({attachment:item(a),committedPostVersion:v,committedAttachmentVersion:1,replayed:false});
 }
 if(match&&path.endsWith("/confirm")){
  const key=h.get("idempotency-key");if(!key||match.confirmKey&&key!==match.confirmKey||Number(h.get("x-pino-post-version"))!==match.postVersion-(match.state==="READY"?1:0))throw Error("Confirm drift");
  confirmCalls++;if(match.state==="READY")return json({attachment:item(match),committedPostVersion:match.postVersion,committedAttachmentVersion:2,replayed:true});
  match.confirmKey=key;match.state="READY";match.version=2;match.postVersion=++v;
  if(confirmCalls===1)throw Error("Synthetic lost confirm ACK");
  return json({attachment:item(match),committedPostVersion:v,committedAttachmentVersion:2,replayed:false});
 }
 const body=JSON.parse(String(init?.body));if(body.expectedVersion!==v)throw Error("Version mismatch");
 if(path===base+"/diary-selection"){selectionCalls++;selected=body.diaryIds.includes(D);v++;return json({diaryIds:body.diaryIds,committedVersion:v,replayed:false});}
 if(match&&path.endsWith("/diary-provenance")){
  if(!selected||body.diaryId!==D||body.evidenceId!==E||body.expectedAttachmentVersion!==2||match.state!=="READY")throw Error("Invalid provenance");
  linkCalls++;v++;provenance.push({attachmentId:match.id,attachmentVersion:2,diaryId:D,evidenceId:E,transform:body.transform});return json({attachmentId:match.id,committedVersion:v,replayed:false});
 }
 if(path===base+"/submit"){submitCalls++;order=body.attachmentIds;if(!order||order.length!==ready().length||order.some(x=>!ready().some(a=>a.id===x)))throw Error("Wrong submit order");pending=true;v++;return json({post:row(),committedVersion:v,replayed:false});}
 throw Error("Unexpected synthetic command");
};
function Fixture(){
 const [session,setSession]=useState<NativeDraftSession|null>(null),[record,setRecord]=useState<CoreDraftRow|null>(null),[error,setError]=useState(""),[tab,setTab]=useState("media");
 useEffect(()=>{const ctl=new AbortController();let own:NativeDraftSession|null=null;void openNativeDraftSession(C,"centers",ctl.signal,{origin,fetcher}).then(async s=>{own=s;const r=await s.controller.detail(P,ctl.signal);ctl.signal.throwIfAborted();setSession(s);setRecord(r);}).catch(e=>{if(!ctl.signal.aborted)setError(String(e));});return()=>{ctl.abort();own?.dispose();};},[]);
 if(error)return <p role="alert">{error}</p>;if(!record||!session)return <p>Loading synthetic fixture</p>;
 return <TddPreferencePolicy.Provider value="ephemeral"><div className="bo-workspace"><output hidden data-testid="receipt">{JSON.stringify({version:record.version,count:record.mediaCount,selectionCalls,reserveCalls,confirmCalls,linkCalls,submitCalls,order,provenance})}</output><TddDetail registry={draftRegistry} schema={draftSchema} context={session.context} record={record} subject={{type:"piner_post_draft",id:P}} onBack={()=>setTab("overview")} activeTab={tab} onTabChange={setTab} renderApprovedExtension={(_r,_ctx,t)=>t==="media"?<NativePrivateMediaPanel session={session} postId={P} onVerified={setRecord} afterschool={!mytime} readOnly={record.status!=="Nháp"} review={{caption:String(record.caption),status:String(record.status),busy:false,error:"",onEditCaption:()=>setTab("overview")}}/>:null}/></div></TddPreferencePolicy.Provider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
