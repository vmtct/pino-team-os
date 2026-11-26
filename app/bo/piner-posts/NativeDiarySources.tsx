"use client";
/** PAP-2386 / PNR-APP-HUB — authorized native Diary sources inside existing Media slot. */
import {useEffect,useRef,useState} from "react";
import {clipboardPng} from "./native-review-order";
import type {NativeDraftSession} from "./native-draft-session";
type Port=NativeDraftSession["diaryComposer"];
type Upload=NativeDraftSession["diaryUpload"];
type Snapshot=Awaited<ReturnType<Port["load"]>>;
type Photo=Awaited<ReturnType<Port["photos"]>>["photos"][number];
type Listing=Awaited<ReturnType<ReturnType<NativeDraftSession["mediaController"]>["list"]>>;
export function NativeDiarySources({port,upload,onCompoundPending,postId,listing,readOnly,blocked,onChanged}:{port:Port;upload?:Upload;onCompoundPending:(pending:boolean)=>void;postId:string;listing:Listing;readOnly:boolean;blocked:boolean;onChanged:(s:AbortSignal)=>Promise<void>}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[recovery,setRecovery]=useState<{pending:boolean;retryPostId:string|null}|null>(null);
 const [compound,setCompound]=useState<{pending:boolean;retryPostId:string|null}|null>(null);
 const [source,setSource]=useState<{diaryId:string;photos:Photo[];version:number}|null>(null),[image,setImage]=useState<{id:string;url:string;blob:Blob}|null>(null),[target,setTarget]=useState(""),[transform,setTransform]=useState<"RAW"|"RETOUCHED">("RAW");
 const active=useRef<AbortController|null>(null),url=useRef<string|null>(null);
 const clearImage=()=>{if(url.current)URL.revokeObjectURL(url.current);url.current=null;setImage(null);};
 useEffect(()=>{
  const ctl=new AbortController();active.current=ctl;
  void Promise.resolve().then(async()=>{const cp=upload?await upload.pending(ctl.signal):null;ctl.signal.throwIfAborted();setCompound(cp);if(cp)onCompoundPending(cp.pending);const value=await port.load(postId,ctl.signal),pending=await port.pending(ctl.signal);ctl.signal.throwIfAborted();setSnapshot(value);setRecovery(pending);}).catch(()=>{if(!ctl.signal.aborted)setError("Không thể tải Diary nguồn.");}).finally(()=>{if(active.current===ctl)active.current=null;});
  return()=>{active.current?.abort();active.current=null;if(url.current)URL.revokeObjectURL(url.current);url.current=null;};
 },[port,upload,onCompoundPending,postId,listing.postVersion]);
 const fresh=snapshot?.state.version===listing.postVersion?snapshot:null;
 const editable=Boolean(fresh&&!readOnly&&!blocked&&!busy&&recovery&&!recovery.pending&&(!upload||compound&&!compound.pending));
 const run=(fn:(s:AbortSignal)=>Promise<void>)=>{
  if(active.current)return;const ctl=new AbortController();active.current=ctl;setBusy(true);setError("");
  void fn(ctl.signal).catch(()=>{if(!ctl.signal.aborted)setError("Không thể xác minh thao tác Diary.");}).finally(async()=>{
   if(!ctl.signal.aborted&&upload){try{const cp=await upload.pending(ctl.signal);if(!ctl.signal.aborted){setCompound(cp);onCompoundPending(cp.pending);}}catch{if(!ctl.signal.aborted){setCompound({pending:true,retryPostId:null});onCompoundPending(true);}}}
   if(!ctl.signal.aborted){try{const p=await port.pending(ctl.signal);if(!ctl.signal.aborted)setRecovery(p);}catch{if(!ctl.signal.aborted)setRecovery({pending:true,retryPostId:null});}}
   if(active.current===ctl){active.current=null;if(!ctl.signal.aborted)setBusy(false);}
  });
 };
 const open=(id:string)=>run(async s=>{if(!fresh)return;clearImage();setSource(null);setTarget("");const data=await port.photos(postId,id,fresh.state.version,s);s.throwIfAborted();setSource({diaryId:id,photos:data.photos,version:data.version});});
 const view=(id:string)=>run(async s=>{if(!source||!fresh||source.version!==fresh.state.version)return;clearImage();const blob=await port.photo(postId,source.diaryId,id,source.version,s);s.throwIfAborted();const next=URL.createObjectURL(blob);url.current=next;setImage({id,url:next,blob});});
 const update=(op:(s:AbortSignal)=>Promise<Snapshot>)=>run(async s=>{clearImage();setSource(null);setTarget("");const next=await op(s);s.throwIfAborted();setSnapshot(next);await onChanged(s);});
 const currentSource=source&&fresh&&source.version===fresh.state.version?source:null;
 const selected=Boolean(currentSource&&fresh?.state.diaryIds.includes(currentSource.diaryId));
 const add=(file?:Blob)=>{if(!upload||!editable||!selected||!currentSource||!image||!fresh||listing.mediaCount>=5)return;update(s=>upload.start({postId,diaryId:currentSource.diaryId,evidenceId:image.id,version:fresh.state.version,transform:file?"RETOUCHED":"RAW",file},s));};
 const available=listing.attachments.filter(a=>!fresh?.state.provenance.some(p=>p.attachmentId===a.id));
 return <section className="v24-prop-section" aria-label="Diary nguồn">
  <div className="v24-section-heading"><h4>Diary nguồn</h4></div>
  {error?<p role="alert">{error}</p>:null}
  {!fresh?<p role="status">{error?"Tải lại Media để xác minh Diary.":"Đang tải Diary…"}</p>:<>
   {fresh.diaries.length===0?<p>Chưa có Diary khả dụng.</p>:<div className="pap2337-bo-diaryGrid">{fresh.diaries.map(d=><div className="pap2337-bo-diaryCard" key={d.diaryId}><label><input type="checkbox" checked={d.claimState==="SELECTED"} disabled={!editable||d.claimState==="USED"||fresh.state.provenance.some(p=>p.diaryId===d.diaryId)} onChange={()=>update(s=>port.toggle(postId,d.diaryId,fresh.state.version,s))}/>{new Date(d.registeredAt).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</label><small>{d.claimState==="USED"?"Đã sử dụng":d.claimState==="SELECTED"?"Đã chọn":"Khả dụng"}</small><button className="secondary-btn" type="button" disabled={busy||d.claimState==="USED"} onClick={()=>open(d.diaryId)}>Xem ảnh gốc</button></div>)}</div>}
   {currentSource?<section aria-label="Ảnh gốc Diary"><div className="v24-section-heading"><h4>Ảnh gốc</h4></div>{currentSource.photos.map((p,index)=><button className="secondary-btn" type="button" disabled={busy} key={p.id} onClick={()=>view(p.id)}>Ảnh {index+1}</button>)}
    {image&&currentSource.photos.some(p=>p.id===image.id)?<><picture><img src={image.url} alt="Ảnh gốc Diary đã xác minh" width={320} height={240}/></picture><button className="secondary-btn" type="button" disabled={busy} onClick={()=>run(async s=>{s.throwIfAborted();await navigator.clipboard.write([new ClipboardItem({"image/png":clipboardPng(image.blob).then(blob=>{s.throwIfAborted();return blob;})})]);})}>Sao chép ảnh</button>
     {selected&&!readOnly?<div className="pap2337-bo-composer">{upload?<><button type="button" className="secondary-btn" disabled={!editable||listing.mediaCount>=5} onClick={()=>add()}>Thêm ảnh gốc</button><label>Ảnh đã chỉnh sửa<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable||listing.mediaCount>=5} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)add(file);}}/></label><textarea className="property-control" aria-label="Dán ảnh đã chỉnh sửa" placeholder="Dán ảnh đã chỉnh sửa tại đây" readOnly disabled={!editable||listing.mediaCount>=5} onPaste={e=>{e.preventDefault();const file=Array.from(e.clipboardData.files).find(f=>["image/png","image/jpeg","image/webp"].includes(f.type));if(file)add(file);}}/></>:null}<label>Ảnh Post<select className="property-control os-create-select" value={target} disabled={!editable} onChange={e=>setTarget(e.target.value)}><option value="">Chọn ảnh đã tải lên</option>{available.map(a=><option key={a.id} value={a.id}>Ảnh {listing.attachments.findIndex(x=>x.id===a.id)+1}</option>)}</select></label><label>Nguồn ảnh<select className="property-control os-create-select" value={transform} disabled={!editable} onChange={e=>setTransform(e.target.value==="RAW"?"RAW":"RETOUCHED")}><option value="RAW">Ảnh gốc</option><option value="RETOUCHED">Đã chỉnh sửa</option></select></label><button className="secondary-btn" type="button" disabled={!editable||!target} onClick={()=>update(s=>port.link(postId,currentSource.diaryId,image.id,target,transform,fresh.state.version,s))}>Liên kết ảnh</button></div>:null}</>:null}
   </section>:null}
   {fresh.state.provenance.length?<section aria-label="Nguồn ảnh đã xác minh">{fresh.state.provenance.map(p=><p key={p.attachmentId}>Ảnh {listing.attachments.findIndex(a=>a.id===p.attachmentId)+1} · {p.transform==="RAW"?"Ảnh gốc Diary":"Đã chỉnh sửa từ Diary"}</p>)}</section>:null}
  </>}
  {compound?.pending?<p role="status">Ảnh Diary chưa được xác minh. {compound.retryPostId===postId&&upload?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>update(s=>upload.retry(postId,s))}>Tiếp tục đúng yêu cầu ảnh Diary</button>:"Không có yêu cầu gốc. Không tải lại tự động."}</p>:null}
  {recovery?.pending&&!compound?.pending?<p role="status">Yêu cầu trước chưa rõ kết quả. {recovery.retryPostId===postId?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>update(s=>port.retry(postId,s))}>Thử lại đúng yêu cầu Diary</button>:"Không tự động gửi lại."}</p>:null}
 </section>;
}
