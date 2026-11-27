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
// Page-scoped, verified private previews. Revoke every URL when the page or scope changes.
type ThumbTask={key:string;diaryId:string;evidenceId?:string};
function useDiaryThumbs(port:Port,postId:string,version:number|undefined,tasks:ThumbTask[]){
 const signature=JSON.stringify(tasks),key=postId+":"+version+":"+signature;
 const [result,setResult]=useState<{key:string;urls:Record<string,string>}|null>(null);
 useEffect(()=>{
  if(version===undefined)return;
  const ctl=new AbortController(),urls:Record<string,string>={};let alive=true;
  void (async()=>{
   for(const task of JSON.parse(signature) as ThumbTask[]){
    if(ctl.signal.aborted)return;
    try{
     let evidenceId=task.evidenceId;
     if(!evidenceId){const source=await port.photos(postId,task.diaryId,version,ctl.signal);if(source.claimState==="USED")continue;evidenceId=source.photos[0]?.id;}
     if(!evidenceId)continue;
     const blob=await port.photo(postId,task.diaryId,evidenceId,version,ctl.signal);
     ctl.signal.throwIfAborted();urls[task.key]=URL.createObjectURL(blob);
     if(alive)setResult({key,urls:{...urls}});
    }catch{if(ctl.signal.aborted)return;}
   }
  })();
  return()=>{alive=false;ctl.abort();for(const url of Object.values(urls))URL.revokeObjectURL(url);};
 },[port,postId,version,signature,key]);
 return result?.key===key?result.urls:{};
}
const DIARY_PAGE=4,PHOTO_PAGE=5;
export function NativeDiarySources({port,upload,onCompoundPending,postId,listing,readOnly,blocked,onChanged}:{port:Port;upload?:Upload;onCompoundPending:(pending:boolean)=>void;postId:string;listing:Listing;readOnly:boolean;blocked:boolean;onChanged:(s:AbortSignal)=>Promise<void>}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[recovery,setRecovery]=useState<{pending:boolean;retryPostId:string|null}|null>(null);
 const [compound,setCompound]=useState<{pending:boolean;retryPostId:string|null}|null>(null);
 const [source,setSource]=useState<{diaryId:string;photos:Photo[];version:number}|null>(null),[image,setImage]=useState<{id:string;url:string;blob:Blob}|null>(null),[target,setTarget]=useState(""),[transform,setTransform]=useState<"RAW"|"RETOUCHED">("RAW");
 const [diaryPage,setDiaryPage]=useState(0),[photoPage,setPhotoPage]=useState(0);
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
 const open=(id:string)=>run(async s=>{if(!fresh)return;clearImage();setSource(null);setTarget("");setPhotoPage(0);const data=await port.photos(postId,id,fresh.state.version,s);s.throwIfAborted();setSource({diaryId:id,photos:data.photos,version:data.version});});
 const view=(id:string)=>run(async s=>{if(!source||!fresh||source.version!==fresh.state.version)return;clearImage();const blob=await port.photo(postId,source.diaryId,id,source.version,s);s.throwIfAborted();const next=URL.createObjectURL(blob);url.current=next;setImage({id,url:next,blob});});
 const update=(op:(s:AbortSignal)=>Promise<Snapshot>)=>run(async s=>{clearImage();setSource(null);setTarget("");const next=await op(s);s.throwIfAborted();setSnapshot(next);await onChanged(s);});
 const currentSource=source&&fresh&&source.version===fresh.state.version?source:null;
 const selected=Boolean(currentSource&&fresh?.state.diaryIds.includes(currentSource.diaryId));
 const add=(file?:Blob)=>{if(!upload||!editable||!selected||!currentSource||!image||!fresh||listing.mediaCount>=5)return;update(s=>upload.start({postId,diaryId:currentSource.diaryId,evidenceId:image.id,version:fresh.state.version,transform:file?"RETOUCHED":"RAW",file},s));};
 const visibleDiaries=fresh?.diaries.slice(diaryPage*DIARY_PAGE,(diaryPage+1)*DIARY_PAGE)??[];
 const visiblePhotos=currentSource?.photos.slice(photoPage*PHOTO_PAGE,(photoPage+1)*PHOTO_PAGE)??[];
 const diaryThumbs=useDiaryThumbs(port,postId,fresh?.state.version,visibleDiaries.filter(d=>d.claimState!=="USED").map(d=>({key:d.diaryId,diaryId:d.diaryId})));
 const photoThumbs=useDiaryThumbs(port,postId,currentSource?.version,currentSource?visiblePhotos.map(p=>({key:p.id,diaryId:currentSource.diaryId,evidenceId:p.id})):[]);
 const changeDiaryPage=(next:number)=>{if(busy||active.current)return;clearImage();setSource(null);setTarget("");setPhotoPage(0);setDiaryPage(next);};
 const changePhotoPage=(next:number)=>{if(busy||active.current)return;clearImage();setTarget("");setPhotoPage(next);};
 const available=listing.attachments.filter(a=>!fresh?.state.provenance.some(p=>p.attachmentId===a.id));
 return <section className="v24-prop-section" aria-label="Diary nguồn">
  <div className="v24-section-heading"><h4>Diary nguồn</h4></div>
  {error?<p role="alert">{error}</p>:null}
  {!fresh?<p role="status">{error?"Tải lại Media để xác minh Diary.":"Đang tải Diary…"}</p>:<>
   {fresh.diaries.length===0?<p>Chưa có Diary khả dụng.</p>:<div className="pap2337-bo-diaryGrid">{visibleDiaries.map(d=><div className="pap2337-bo-diaryCard" key={d.diaryId}>{diaryThumbs[d.diaryId]?<picture><img src={diaryThumbs[d.diaryId]} alt="Ảnh xem trước Diary" width={160} height={120}/></picture>:<small>{d.claimState==="USED"?"Diary đã được dùng ở Post khác":"Chưa có ảnh xem trước đã xác minh"}</small>}<label><input type="checkbox" checked={d.claimState==="SELECTED"} disabled={!editable||d.claimState==="USED"||fresh.state.provenance.some(p=>p.diaryId===d.diaryId)} onChange={()=>update(s=>port.toggle(postId,d.diaryId,fresh.state.version,s))}/>{new Date(d.registeredAt).toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</label><small>{d.claimState==="USED"?"Đã sử dụng":d.claimState==="SELECTED"?"Đã chọn":"Khả dụng"}</small><button className="secondary-btn" type="button" disabled={busy||d.claimState==="USED"} onClick={()=>open(d.diaryId)}>Xem ảnh gốc</button></div>)}</div>}
   {fresh.diaries.length>DIARY_PAGE?<nav aria-label="Trang Diary nguồn"><button type="button" className="secondary-btn" disabled={busy||diaryPage===0} onClick={()=>changeDiaryPage(diaryPage-1)}>Trước</button> <span>{diaryPage+1}/{Math.ceil(fresh.diaries.length/DIARY_PAGE)}</span> <button type="button" className="secondary-btn" disabled={busy||(diaryPage+1)*DIARY_PAGE>=fresh.diaries.length} onClick={()=>changeDiaryPage(diaryPage+1)}>Sau</button></nav>:null}
   {currentSource?<section aria-label="Ảnh gốc Diary"><div className="v24-section-heading"><h4>Ảnh gốc</h4></div><div className="pap2337-bo-filmstrip" role="list" aria-label="Ảnh nguồn">{visiblePhotos.map((p,index)=><div className="pap2337-bo-filmItem" key={p.id} role="listitem"><button className="pap2337-bo-filmThumb" type="button" aria-label={"Ảnh "+(photoPage*PHOTO_PAGE+index+1)} aria-pressed={image?.id===p.id} disabled={busy} onClick={()=>view(p.id)}>{photoThumbs[p.id]?<picture><img src={photoThumbs[p.id]} alt={"Ảnh nguồn "+(photoPage*PHOTO_PAGE+index+1)} width={64} height={64}/></picture>:null}<span>{photoPage*PHOTO_PAGE+index+1}</span></button></div>)}</div>{currentSource.photos.length>PHOTO_PAGE?<nav aria-label="Trang ảnh nguồn"><button type="button" className="secondary-btn" disabled={busy||photoPage===0} onClick={()=>changePhotoPage(photoPage-1)}>Trước</button> <span>{photoPage+1}/{Math.ceil(currentSource.photos.length/PHOTO_PAGE)}</span> <button type="button" className="secondary-btn" disabled={busy||(photoPage+1)*PHOTO_PAGE>=currentSource.photos.length} onClick={()=>changePhotoPage(photoPage+1)}>Sau</button></nav>:null}
    {image&&currentSource.photos.some(p=>p.id===image.id)?<><picture><img src={image.url} alt="Ảnh gốc Diary đã xác minh" width={320} height={240}/></picture><button className="secondary-btn" type="button" disabled={busy} onClick={()=>run(async s=>{s.throwIfAborted();await navigator.clipboard.write([new ClipboardItem({"image/png":clipboardPng(image.blob).then(blob=>{s.throwIfAborted();return blob;})})]);})}>Sao chép ảnh</button>
     {selected&&!readOnly?<div className="pap2337-bo-composer">{upload?<><button type="button" className="secondary-btn" disabled={!editable||listing.mediaCount>=5} onClick={()=>add()}>Thêm ảnh gốc</button><label>Ảnh đã chỉnh sửa<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editable||listing.mediaCount>=5} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)add(file);}}/></label><textarea className="property-control" aria-label="Dán ảnh đã chỉnh sửa" placeholder="Dán ảnh đã chỉnh sửa tại đây" readOnly disabled={!editable||listing.mediaCount>=5} onPaste={e=>{e.preventDefault();const file=Array.from(e.clipboardData.files).find(f=>["image/png","image/jpeg","image/webp"].includes(f.type));if(file)add(file);}}/></>:null}<label>Ảnh Post<select className="property-control os-create-select" value={target} disabled={!editable} onChange={e=>setTarget(e.target.value)}><option value="">Chọn ảnh đã tải lên</option>{available.map(a=><option key={a.id} value={a.id}>Ảnh {listing.attachments.findIndex(x=>x.id===a.id)+1}</option>)}</select></label><label>Nguồn ảnh<select className="property-control os-create-select" value={transform} disabled={!editable} onChange={e=>setTransform(e.target.value==="RAW"?"RAW":"RETOUCHED")}><option value="RAW">Ảnh gốc</option><option value="RETOUCHED">Đã chỉnh sửa</option></select></label><button className="secondary-btn" type="button" disabled={!editable||!target} onClick={()=>update(s=>port.link(postId,currentSource.diaryId,image.id,target,transform,fresh.state.version,s))}>Liên kết ảnh</button></div>:null}</>:null}
   </section>:null}
   {fresh.state.provenance.length?<section aria-label="Nguồn ảnh đã xác minh">{fresh.state.provenance.map(p=><p key={p.attachmentId}>Ảnh {listing.attachments.findIndex(a=>a.id===p.attachmentId)+1} · {p.transform==="RAW"?"Ảnh gốc Diary":"Đã chỉnh sửa từ Diary"}</p>)}</section>:null}
  </>}
  {compound?.pending?<p role="status">Ảnh Diary chưa được xác minh. {compound.retryPostId===postId&&upload?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>update(s=>upload.retry(postId,s))}>Tiếp tục đúng yêu cầu ảnh Diary</button>:"Không có yêu cầu gốc. Không tải lại tự động."}</p>:null}
  {recovery?.pending&&!compound?.pending?<p role="status">Yêu cầu trước chưa rõ kết quả. {recovery.retryPostId===postId?<button className="secondary-btn" type="button" disabled={busy} onClick={()=>update(s=>port.retry(postId,s))}>Thử lại đúng yêu cầu Diary</button>:"Không tự động gửi lại."}</p>:null}
 </section>;
}
