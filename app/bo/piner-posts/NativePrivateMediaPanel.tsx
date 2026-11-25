"use client";
/** PAP-2134 / PAP-2172: native approved Media slot; session owns retained command. */
import {useEffect,useRef,useState} from "react";
import {privateMediaSlot,validatePrivateMediaSelection,type PrivateMediaShellState,type PrivateMediaShellActions,type PostReviewPresentation} from "./private-media-shell";
import type {DraftRuntimeSession} from "./post-preview-session";
import type {NativeDraftSession} from "./native-draft-session";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import {readVerifiedMediaRecord} from "./private-media-controller";
type MediaPanelSession=Pick<DraftRuntimeSession,"mediaController"|"canEditMedia"|"context"|"composer"|"submitReview"|"canSubmit">&{controller:Pick<NativeDraftSession["controller"],"detail">};
type Controller=ReturnType<NativeDraftSession["mediaController"]>;
type Listing=Awaited<ReturnType<Controller["list"]>>;
function MediaShell({state,actions}:{state:PrivateMediaShellState;actions:PrivateMediaShellActions}){return <>{privateMediaSlot(state,actions)}</>;}
export function NativePrivateMediaPanel({session,postId,onVerified,readOnly=false,review}:{session:MediaPanelSession;postId:string;onVerified:(row:CoreDraftRow)=>void;readOnly?:boolean;review?:PostReviewPresentation}){
 const [listing,setListing]=useState<Listing|null>(null),[status,setStatus]=useState<"loading"|"ready"|"denied"|"error">("loading"),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(""),[preview,setPreview]=useState<{id:string;url:string}|undefined>();
 const [authoredOrder,setAuthoredOrder]=useState<{signature:string;ids:string[]}|null>(null),[workflowPending,setWorkflowPending]=useState<{pending:boolean;retryPostId:string|null}|null>(null);
 const controllerRef=useRef<Controller|null>(null),active=useRef<AbortController|null>(null),callback=useRef(onVerified);
 useEffect(()=>{callback.current=onVerified;},[onVerified]);
 async function accept(data:Listing,signal:AbortSignal){
  const row=await readVerifiedMediaRecord(data,postId,session.controller.detail,signal);
  signal.throwIfAborted();setListing(data);setStatus("ready");callback.current(row);
 }
 function failure(e:unknown){
  controllerRef.current?.closePreview();setPreview(undefined);
  setError(e instanceof CoreDraftRequestError&&e.status===409?"Post đã thay đổi. Tải lại trước khi thao tác tiếp.":"Không thể xác minh kết quả thao tác ảnh.");
  if(!session.context.authorize("piner.post.view")||e instanceof CoreDraftRequestError&&[401,403,404].includes(e.status)){setListing(null);setStatus("denied");}
  else if(!listing)setStatus("error");
 }
 useEffect(()=>{
  const ctl=new AbortController();active.current=ctl;let controller:Controller|null=null;
  void Promise.resolve().then(async()=>{
   ctl.signal.throwIfAborted();controller=session.mediaController(postId);controllerRef.current=controller;
   const data=await controller.list(ctl.signal);
   const row=await readVerifiedMediaRecord(data,postId,session.controller.detail,ctl.signal);
   const recovery=session.submitReview&&session.canSubmit?.()?await session.submitReview.pending(ctl.signal):null;
   ctl.signal.throwIfAborted();setListing(data);setStatus("ready");setPending(controller.hasPending());setWorkflowPending(recovery);callback.current(row);
  }).catch(()=>{if(!ctl.signal.aborted){setPending(controller?.hasPending()??false);setStatus(session.context.authorize("piner.post.view")?"error":"denied");}}).finally(()=>{if(active.current===ctl)active.current=null;});
  return()=>{active.current?.abort();active.current=null;controller?.closePreview();controllerRef.current=null;};
 },[session,postId]);
 const run=(operation:(c:Controller,s:AbortSignal)=>Promise<void>)=>{
  const c=controllerRef.current;if(!c||active.current)return;const ctl=new AbortController();active.current=ctl;setBusy(true);setError("");
  void operation(c,ctl.signal).catch(e=>{if(!ctl.signal.aborted)failure(e);}).finally(()=>{if(active.current===ctl){active.current=null;if(!ctl.signal.aborted){setPending(c.hasPending());setBusy(false);}}});
 };
 const refresh=()=>run(async(c,s)=>{c.closePreview();setPreview(undefined);await accept(await c.list(s),s);});
 const nativeReview=session.submitReview&&session.canSubmit?.()?session.submitReview:null;
 const signature=listing?.attachments.map(a=>a.id).sort().join(",")??"";
 const order=authoredOrder?.signature===signature?authoredOrder.ids:listing?.attachments.map(a=>a.id)??[];
 const canEdit=!readOnly&&session.canEditMedia()&&!workflowPending?.pending;const composer=session.composer?.(postId);
 const submitNative=(retry:boolean)=>run(async(_c,s)=>{
  if(!nativeReview||!listing)return;
  try{const row=retry?await nativeReview.retry(postId,s):await nativeReview.submit(postId,listing.postVersion,order,s);s.throwIfAborted();callback.current(row);}
  finally{if(!s.aborted){try{const state=await nativeReview.pending(s);s.throwIfAborted();setWorkflowPending(state);}catch{if(!s.aborted)setWorkflowPending({pending:true,retryPostId:null});}}}
 });
 const moveImage=(id:string,delta:number)=>{const next=[...order],i=next.indexOf(id),j=i+delta;if(i<0||j<0||j>=next.length||busy||readOnly||workflowPending?.pending)return;[next[i],next[j]]=[next[j]!,next[i]!];setAuthoredOrder({signature,ids:next});};
 const state:PrivateMediaShellState=status!=="ready"||!listing?{status:status==="ready"?"loading":status}:{status:"ready",rows:listing.attachments.map((a,index)=>({id:a.id,name:"Ảnh "+(index+1),bytes:a.byteSize,state:"ready"})),canEdit:canEdit&&!pending,busy,error,preview,composer:composer?.snapshot(),review};
 return <><MediaShell state={state} actions={{
  select:files=>{if(!listing)return;const invalid=validatePrivateMediaSelection(files,listing.mediaCount);if(invalid){setError(invalid);return;}run(async(c,s)=>{setPreview(undefined);for(const file of files){s.throwIfAborted();await accept(await c.upload(file,s),s);}});},
  preview:id=>run(async(c,s)=>{setPreview(undefined);const p=await c.openPreview(id,s);s.throwIfAborted();setPreview(p);}),
  closePreview:()=>{controllerRef.current?.closePreview();setPreview(undefined);},
  remove:id=>run(async(c,s)=>{setPreview(undefined);await accept(await c.remove(id,s),s);}),
  ...(composer?{toggleDiary:(id:string)=>run(async(_c,s)=>{setPreview(undefined);await accept(await composer.toggle(id,s),s);}),reorder:(id:string,offset:number)=>run(async(_c,s)=>{setPreview(undefined);await accept(await composer.reorder(id,offset,s),s);}),sourceDiary:(id:string)=>{composer.source(id);setListing(old=>old?{...old}:old);}}:{}),
  retry:refresh
 }}/>{nativeReview&&status==="ready"&&listing&&review?<section className="v24-prop-section" aria-label="Xem trước bài đăng">
 <div className="v24-section-heading"><h4>Xem trước &amp; gửi duyệt</h4></div>
 <p>{review.caption.trim()||"Chưa có caption."}</p>
 {readOnly?<p role="status">Bài đăng đang chờ HO duyệt.</p>:<><ol aria-label="Thứ tự ảnh gửi duyệt">{order.map((id,index)=><li key={id}><span>Ảnh {listing.attachments.findIndex(a=>a.id===id)+1}{index===0?" · Ảnh bìa":""}</span>{" "}<button className="secondary-btn" type="button" disabled={busy||Boolean(workflowPending?.pending)||index===0} aria-label={"Chuyển ảnh "+(index+1)+" lên"} onClick={()=>moveImage(id,-1)}>↑</button>{" "}<button className="secondary-btn" type="button" disabled={busy||Boolean(workflowPending?.pending)||index===order.length-1} aria-label={"Chuyển ảnh "+(index+1)+" xuống"} onClick={()=>moveImage(id,1)}>↓</button></li>)}</ol>
 <button className="primary-btn" type="button" disabled={busy||pending||workflowPending===null||workflowPending.pending||!order.length||!review.caption.trim()} onClick={()=>submitNative(false)}>Gửi duyệt</button></>}
 {workflowPending?.pending?<><p role="status">Yêu cầu trước chưa rõ kết quả. Cần xác minh trước khi thao tác tiếp.</p>{workflowPending.retryPostId===postId?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>submitNative(true)}>Thử lại yêu cầu gửi duyệt</button>:<p>Không có yêu cầu gốc trong phiên này. Không gửi lại tự động.</p>}</>:null}
 </section>:null}{pending&&status!=="loading"&&status!=="denied"?<section className="v24-prop-section"><p role="status">Ảnh trước chưa rõ kết quả. Thử lại đúng yêu cầu cũ trước khi thêm hoặc gỡ ảnh.</p>{canEdit?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>run(async(c,s)=>{setPreview(undefined);await accept(await c.retry(s),s);})}>Thử lại thao tác</button>:null}</section>:null}{status==="ready"&&error&&!pending?<button type="button" className="secondary-btn" disabled={busy} onClick={refresh}>Tải lại ảnh</button>:null}</>;
}
