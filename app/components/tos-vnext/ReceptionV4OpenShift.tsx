"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faCheckCircle, faCloudArrowUp, faImage, faShieldHalved, faTrash } from "@fortawesome/free-solid-svg-icons";
import { OpsFrame } from "./OpsV4Body";
async function shrinkPhoto(file:File):Promise<string>{
 if(!file.type.startsWith("image/"))throw new Error("Chọn tệp ảnh.");
 if(file.size>15*1024*1024)throw new Error("Ảnh vượt quá 15 MB.");
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Không đọc được ảnh"));reader.readAsDataURL(file)});
}
import css from "./ops.module.css";

export default function ReceptionOpenShift(props: {
  centerName:string;shiftTime:string;
  onBypass:()=>void;
}) {
  const input=useRef<HTMLInputElement|null>(null);
  const [photo,setPhoto]=useState("");
  const [filename,setFilename]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
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
      <span className={css.badge} data-state="waiting">Chưa xác minh</span>
    </div>
    <section className={css.panel}>
      <div className={css.panelTitle}><h3>Ảnh setup không gian <b className={css.required}>*</b></h3><span>Bắt buộc</span></div>
      <div className={css.capture} data-ready={Boolean(photo)}>
        {photo?<img className={css.capturePreview} src={photo} alt="Ảnh setup quầy Tiếp Tân đã chọn"/>:<div className={css.captureEmpty}><FontAwesomeIcon icon={faCamera}/><strong>Chụp hoặc tải ảnh khu vực tiếp tân</strong><span>Thể hiện quầy, lối vào và khu vực đón học viên đã sẵn sàng.</span></div>}
        <input ref={input} aria-label="Ảnh setup không gian" data-testid="setup-photo" type="file" accept="image/*" capture="environment" onChange={e=>{void selectPhoto(e.target.files?.[0]);e.target.value="";}} hidden/>
      </div>
      <div className={`${css.inlineActions} ${css.openShiftActions}`}>
        <button className={css.secondary} type="button" disabled={busy} onClick={()=>input.current?.click()}><FontAwesomeIcon icon={photo?faImage:faCloudArrowUp}/> {photo?"Đổi ảnh":"Chụp / chọn ảnh"}</button>
        {photo?<button className={css.secondary} type="button" onClick={()=>{setPhoto("");setFilename("");setConfirmed(false);}}><FontAwesomeIcon icon={faTrash}/> Xóa ảnh</button>:null}
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
    <button type="button" className={css.primary} disabled title="Chưa xác minh quyền và contract Mở Ca">{busy?"Đang xử lý ảnh…":"Mở Ca Tiếp Tân"}</button>
    <div className={css.bypassArea}>
      <div className={css.bypassWarning}><strong>Không để gián đoạn vận hành</strong><span>Chỉ sử dụng khi chưa thể xác nhận setup. Chế độ xem không ghi nhận mở ca hoặc bypass. Xác nhận ca cần được hệ thống cho phép.</span></div>
      <button className={css.bypassButton} type="button" disabled={busy} onClick={bypass}>Xem quầy · Không xác nhận mở ca</button>
    </div>
    <div className={css.callout}><strong><FontAwesomeIcon icon={faShieldHalved}/> Chưa xác minh mở ca</strong><span>Mở ca hiện chưa khả dụng. Ảnh chỉ xem trước trong trang và chưa được gửi lên hệ thống.</span></div>
  </OpsFrame>;
}
