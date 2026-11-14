"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { readReceptionReady,confirmReceptionReady,appendReceptionEvidence,newReceptionCorrectionKey,receptionEvidencePhoto,type ReceptionReadyState,type ReceptionReadySlot,type ReceptionReadyReceipt } from "@/lib/tos-reception-ready-client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faCheckCircle, faCloudArrowUp, faImage, faShieldHalved, faTrash } from "@fortawesome/free-solid-svg-icons";
import { OpsFrame } from "./OpsV4Body";
async function shrinkPhoto(file:File):Promise<string>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Chọn ảnh JPEG, PNG hoặc WebP.");
 if(file.size>2*1024*1024)throw new Error("Ảnh vượt quá 2 MB.");
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Không đọc được ảnh"));reader.readAsDataURL(file)});
}
import css from "./ops.module.css";

function PrivateReceptionImage({slot,receiptId,assetId}:{slot:ReceptionReadySlot;receiptId:string;assetId:string}){
  const [src,setSrc]=useState(""),[error,setError]=useState(false);
  const {centerId,workDate,shiftTemplateId}=slot;
  useEffect(()=>{
    const controller=new AbortController();
    void receptionEvidencePhoto({centerId,workDate,shiftTemplateId},receiptId,assetId,controller.signal).then(v=>{if(!controller.signal.aborted)setSrc(v);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[centerId,workDate,shiftTemplateId,receiptId,assetId]);
  return src?<img className={css.capturePreview} src={src} alt="Ảnh setup đã lưu"/>:<p role="status">{error?"Không thể xác minh ảnh.":"Đang tải ảnh…"}</p>;
}
function ReadyEvidence({slot,server,onSaved}:{slot:ReceptionReadySlot;server:Extract<ReceptionReadyState,{state:"READY"}>;onSaved:(s:ReceptionReadyState)=>void}){
  const [photos,setPhotos]=useState<string[]>([]),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const lock=useRef(false),retry=useRef<{signature:string;key:string}|null>(null);
  const latest=server.history?.at(-1);
  async function select(files:FileList|null){
    if(!files||!files.length||lock.current)return;
    if(photos.length+files.length>10){setError("Tối đa 10 ảnh mỗi lượt.");return;}
    lock.current=true;setBusy(true);setError("");
    try{const values=await Promise.all(Array.from(files).map(shrinkPhoto));setPhotos(prev=>[...prev,...values]);}
    catch(e){setError(e instanceof Error?e.message:"Không đọc được ảnh.");}
    finally{lock.current=false;setBusy(false);}
  }
  async function send(){
    if(lock.current||!photos.length||!server.canAppend)return;
    const signature=JSON.stringify([server.receipt.receipt_id,server.history?.length,photos,note.trim()]);
    const key=retry.current?.signature===signature?retry.current.key:newReceptionCorrectionKey();
    retry.current={signature,key};lock.current=true;setBusy(true);setError("");
    try{const result=await appendReceptionEvidence(slot,server,photos,note,key);onSaved(result);setPhotos([]);setNote("");retry.current=null;}
    catch(e){setError(e instanceof Error?e.message:"Không thể gửi ảnh.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className={css.panel}>
    <div className={css.panelTitle}><h3>Ảnh setup đã lưu</h3><span>{latest?.verdict==="REJECTED"?"Từ chối":latest?.verdict==="APPROVED"?"Đã duyệt":latest?"Chờ duyệt":"Chưa xác minh"}</span></div>
    {latest?.verdict==="REJECTED"?<p className={css.validationError} role="status">{latest.reason}</p>:null}
    {server.history?.map(e=><div key={e.eventId}>
      <p className={css.meta}>{e.kind==="SUBMISSION"?"Gửi ảnh":e.verdict==="APPROVED"?"Đã duyệt":"Từ chối"} · {e.actorLegalFullName??"—"} · {e.occurredAt}</p>
      {e.note?<p>{e.note}</p>:null}{e.reason?<p>{e.reason}</p>:null}
      {e.privateAssetIds.map(assetId=><PrivateReceptionImage key={assetId} slot={slot} receiptId={server.receipt.receipt_id} assetId={assetId}/>)}
    </div>)}
    {server.canAppend?<div>
      <label className={css.confirmRow}><span>Bổ sung ảnh setup</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={e=>{void select(e.target.files);e.target.value="";}}/></label>
      {photos.map((p,i)=><div key={i}><img className={css.capturePreview} src={p} alt={"Ảnh bổ sung "+(i+1)}/><button className={css.secondary} disabled={busy} onClick={()=>setPhotos(a=>a.filter((_,j)=>j!==i))}>Bỏ ảnh</button></div>)}
      <label className={css.confirmRow}><span>Ghi chú</span><textarea maxLength={1000} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <button className={css.primary} type="button" disabled={busy||!photos.length} onClick={()=>void send()}>{busy?"Đang xử lý…":latest?.verdict==="REJECTED"?"Gửi bổ sung để duyệt lại":"Gửi ảnh bổ sung"}</button>
    </div>:null}
    {error?<p className={css.validationError} role="alert">{error}</p>:null}
  </section>;
}
export default function ReceptionOpenShift(props: {
  centerName:string;shiftTime:string;
  onBypass:()=>void;
  slots?:readonly ReceptionReadySlot[]; initialTemplateId?:string; onReady?:(receipt:ReceptionReadyReceipt)=>void;
}) {
  const input=useRef<HTMLInputElement|null>(null);
  const [photo,setPhoto]=useState("");
  const [filename,setFilename]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [selected,setSelected]=useState(props.initialTemplateId??props.slots?.[0]?.shiftTemplateId??"");
  const slot=props.slots?.find(s=>s.shiftTemplateId===selected);
  const [server,setServer]=useState<ReceptionReadyState|null>(null);
  const [refresh,setRefresh]=useState(0);
  const centerId=slot?.centerId,workDate=slot?.workDate,shiftTemplateId=slot?.shiftTemplateId;
  useEffect(()=>{
    if(!centerId||!workDate||!shiftTemplateId)return;
    const controller=new AbortController();
    void readReceptionReady({centerId,workDate,shiftTemplateId},controller.signal).then(value=>{
      if(!controller.signal.aborted)setServer(value);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không thể xác minh ca.");});
    return ()=>controller.abort();
  },[centerId,workDate,shiftTemplateId,refresh]);
  function choose(value:string){
    setSelected(value);setPhoto("");setFilename("");setConfirmed(false);setServer(null);setError("");
  }
  async function confirmReady(){
    if(busy||!slot||!props.onReady)return;
    if(server?.state==="READY"){props.onReady(server.receipt);return;}
    if(!server?.canConfirm||!photo||!confirmed)return;
    setBusy(true);setError("");
    try{
      const receipt=await confirmReceptionReady(slot,photo);
      props.onReady(receipt);
    }catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận ca.");setServer(null);setRefresh(v=>v+1);}
    finally{setBusy(false);}
  }
  async function selectPhoto(file?:File) {
    if (!file) return;
    setError(""); setBusy(true);
    try {
      const data=await shrinkPhoto(file);
      setPhoto(data);setFilename(file.name);
    } catch(e){setError(e instanceof Error?e.message:"Không đọc được ảnh");}
    finally{setBusy(false);}
  }
  function bypass(){
    if (busy) return;
    try { setError(""); props.onBypass(); } catch(e){ setError(e instanceof Error?e.message:"Không thể mở chế độ xem"); }
  }
  return <OpsFrame app="reception" title="Tiếp Tân" tabs={[]} tab="" onTab={()=>{}} notice={notice}>
    <div className={css.openShiftIntro}><span className={css.eyebrow}>BƯỚC 1 / 1 · CHUẨN BỊ QUẦY</span><h2 className={css.title}>Mở Ca Tiếp Tân</h2>
      <p className={css.lead}>Chụp lại không gian đã được setup trước khi bắt đầu đón học viên.</p></div>
    <div className={css.shiftContext}>
      <div className={css.shiftContextIcon}><FontAwesomeIcon icon={faCheckCircle}/></div>
      <div><small>CA TRỰC CỦA BẠN</small><strong>{props.centerName}</strong><span>Tiếp tân · {props.shiftTime}</span></div>
      <span className={css.badge} data-state="waiting">{server?.state==="READY"?"Đã mở ca":server?.state==="NOT_READY"?"Chưa mở ca":"Chưa xác minh"}</span>
    </div>
    {props.slots&&props.slots.length>1?<label className={css.confirmRow}><span>Ca trực</span><select aria-label="Chọn ca tiếp tân" value={selected} disabled={busy} onChange={e=>choose(e.target.value)}>{props.slots.map(s=><option key={s.shiftTemplateId} value={s.shiftTemplateId}>{s.label}</option>)}</select></label>:null}
    {!slot?<p className={css.meta}>Không có ca tiếp tân đã được phân công.</p>:null}
    {server?.state==="READY"&&slot?<ReadyEvidence key={JSON.stringify([slot.centerId,slot.workDate,slot.shiftTemplateId,server.receipt.receipt_id])} slot={slot} server={server} onSaved={setServer}/>:<>
    <section className={css.panel}>
      <div className={css.panelTitle}><h3>Ảnh setup không gian <b className={css.required}>*</b></h3><span>Bắt buộc</span></div>
      <div className={css.capture} data-ready={Boolean(photo)}>
        {photo?<img className={css.capturePreview} src={photo} alt="Ảnh setup quầy Tiếp Tân đã chọn"/>:<div className={css.captureEmpty}><FontAwesomeIcon icon={faCamera}/><strong>Chụp hoặc tải ảnh khu vực tiếp tân</strong><span>Thể hiện quầy, lối vào và khu vực đón học viên đã sẵn sàng.</span></div>}
        <input ref={input} aria-label="Ảnh setup không gian" data-testid="setup-photo" type="file" accept="image/*" capture="environment" onChange={e=>{void selectPhoto(e.target.files?.[0]);e.target.value="";}} hidden/>
      </div>
      <div className={`${css.inlineActions} ${css.openShiftActions}`}>
        <button className={css.secondary} type="button" disabled={busy} onClick={()=>input.current?.click()}><FontAwesomeIcon icon={photo?faImage:faCloudArrowUp}/> {photo?"Đổi ảnh":"Chụp / chọn ảnh"}</button>
        {photo?<button className={css.secondary} type="button" disabled={busy} onClick={()=>{setPhoto("");setFilename("");setConfirmed(false);}}><FontAwesomeIcon icon={faTrash}/> Xóa ảnh</button>:null}
      </div>
      {photo?<p className={css.meta}>Đã chọn: {filename} · Ảnh chỉ xem trước trong bộ nhớ của trang.</p>:null}
      {error?<div className={css.validationError} role="alert">{error}</div>:null}
    </section>
    <section className={css.panel}>
      <div className={css.panelTitle}><h3>Kiểm tra trước khi mở ca</h3><span>Checklist</span></div>
      <div className={css.checkItem}><FontAwesomeIcon icon={faCheckCircle}/><span>Quầy, lối đi và khu vực chờ sạch sẽ, sẵn sàng.</span></div>
      <div className={css.checkItem}><FontAwesomeIcon icon={faCheckCircle}/><span>Thiết bị đón tiếp và thông tin lớp trong ngày đã được kiểm tra.</span></div>
      <label className={css.confirmRow}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Tôi xác nhận đã setup xong không gian tiếp tân.</span></label>
    </section>
    </>}
    <button type="button" className={css.primary} disabled={busy||!slot||!props.onReady||(server?.state!=="READY"&&(!server?.canConfirm||!photo||!confirmed))} onClick={()=>void confirmReady()}>{busy?"Đang xử lý…":server?.state==="READY"?"Vào quầy":"Mở Ca Tiếp Tân"}</button>
    <div className={css.bypassArea}>
      <div className={css.bypassWarning}><strong>Không để gián đoạn vận hành</strong><span>Chỉ sử dụng khi chưa thể xác nhận setup. Chế độ xem không ghi nhận mở ca hoặc bypass. Xác nhận ca cần được hệ thống cho phép.</span></div>
      <button className={css.bypassButton} type="button" disabled={busy} onClick={bypass}>Xem quầy · Không xác nhận mở ca</button>
    </div>
    <div className={css.callout}><strong><FontAwesomeIcon icon={faShieldHalved}/> {server?.state==="READY"?"Đã xác nhận mở ca":"Xác minh ca trực"}</strong><span>{server?.state==="READY"?"Biên nhận được hệ thống xác nhận.":server?.canConfirm?"Ảnh chỉ được gửi khi bạn xác nhận mở ca.":"Chưa đủ điều kiện xác nhận ca."}</span></div>
  </OpsFrame>;
}
