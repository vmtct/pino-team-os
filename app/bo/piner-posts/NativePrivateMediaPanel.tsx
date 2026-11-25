"use client";
/** PAP-2134 / PAP-2172: native approved Media slot; session owns retained command. */
import {useEffect,useRef,useState} from "react";
import {privateMediaSlot,validatePrivateMediaSelection,type PrivateMediaShellState,type PrivateMediaShellActions,type PostReviewPresentation} from "./private-media-shell";
import type {DraftRuntimeSession} from "./post-preview-session";
import type {NativeDraftSession} from "./native-draft-session";
import {CoreDraftRequestError,type CoreDraftRow} from "./core-draft-client";
import {readVerifiedMediaRecord} from "./private-media-controller";
type MediaPanelSession=Pick<DraftRuntimeSession,"mediaController"|"canEditMedia"|"context"|"composer">&{controller:Pick<NativeDraftSession["controller"],"detail">};
type Controller=ReturnType<NativeDraftSession["mediaController"]>;
type Listing=Awaited<ReturnType<Controller["list"]>>;
function MediaShell({state,actions}:{state:PrivateMediaShellState;actions:PrivateMediaShellActions}){return <>{privateMediaSlot(state,actions)}</>;}
export function NativePrivateMediaPanel({session,postId,onVerified,readOnly=false,review}:{session:MediaPanelSession;postId:string;onVerified:(row:CoreDraftRow)=>void;readOnly?:boolean;review?:PostReviewPresentation}){
 const [listing,setListing]=useState<Listing|null>(null),[status,setStatus]=useState<"loading"|"ready"|"denied"|"error">("loading"),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(""),[preview,setPreview]=useState<{id:string;url:string}|undefined>();
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
   ctl.signal.throwIfAborted();setListing(data);setStatus("ready");setPending(controller.hasPending());callback.current(row);
  }).catch(()=>{if(!ctl.signal.aborted){setPending(controller?.hasPending()??false);setStatus(session.context.authorize("piner.post.view")?"error":"denied");}}).finally(()=>{if(active.current===ctl)active.current=null;});
  return()=>{active.current?.abort();active.current=null;controller?.closePreview();controllerRef.current=null;};
 },[session,postId]);
 const run=(operation:(c:Controller,s:AbortSignal)=>Promise<void>)=>{
  const c=controllerRef.current;if(!c||active.current)return;const ctl=new AbortController();active.current=ctl;setBusy(true);setError("");
  void operation(c,ctl.signal).catch(e=>{if(!ctl.signal.aborted)failure(e);}).finally(()=>{if(active.current===ctl){active.current=null;if(!ctl.signal.aborted){setPending(c.hasPending());setBusy(false);}}});
 };
 const refresh=()=>run(async(c,s)=>{c.closePreview();setPreview(undefined);await accept(await c.list(s),s);});
 const canEdit=!readOnly&&session.canEditMedia();const composer=session.composer?.(postId);
 const state:PrivateMediaShellState=status!=="ready"||!listing?{status:status==="ready"?"loading":status}:{status:"ready",rows:listing.attachments.map((a,index)=>({id:a.id,name:"Ảnh "+(index+1),bytes:a.byteSize,state:"ready"})),canEdit:canEdit&&!pending,busy,error,preview,composer:composer?.snapshot(),review};
 return <><MediaShell state={state} actions={{
  select:files=>{if(!listing)return;const invalid=validatePrivateMediaSelection(files,listing.mediaCount);if(invalid){setError(invalid);return;}run(async(c,s)=>{setPreview(undefined);for(const file of files){s.throwIfAborted();await accept(await c.upload(file,s),s);}});},
  preview:id=>run(async(c,s)=>{setPreview(undefined);const p=await c.openPreview(id,s);s.throwIfAborted();setPreview(p);}),
  closePreview:()=>{controllerRef.current?.closePreview();setPreview(undefined);},
  remove:id=>run(async(c,s)=>{setPreview(undefined);await accept(await c.remove(id,s),s);}),
  ...(composer?{toggleDiary:(id:string)=>run(async(_c,s)=>{setPreview(undefined);await accept(await composer.toggle(id,s),s);}),reorder:(id:string,offset:number)=>run(async(_c,s)=>{setPreview(undefined);await accept(await composer.reorder(id,offset,s),s);}),sourceDiary:(id:string)=>{composer.source(id);setListing(old=>old?{...old}:old);}}:{}),
  retry:refresh
 }}/>{pending&&status!=="loading"&&status!=="denied"?<section className="v24-prop-section"><p role="status">Ảnh trước chưa rõ kết quả. Thử lại đúng yêu cầu cũ trước khi thêm hoặc gỡ ảnh.</p>{canEdit?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>run(async(c,s)=>{setPreview(undefined);await accept(await c.retry(s),s);})}>Thử lại thao tác</button>:null}</section>:null}{status==="ready"&&error&&!pending?<button type="button" className="secondary-btn" disabled={busy} onClick={refresh}>Tải lại ảnh</button>:null}</>;
}
