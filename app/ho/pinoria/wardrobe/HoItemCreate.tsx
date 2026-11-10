"use client";
/** PAP-1700 / PAP-1097 PNR-WARD: Founder-approved HO Item Create uses canonical Dsa DrawerFrame. */
import {useState,type FormEvent} from "react";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {slots,slotNames,uploadItem,writeItem,type Slot} from "./item-client";

type ItemKind="WEARABLE"|"ACCESSORY"|"SET";
const itemKeyPattern=/^[a-z0-9][a-z0-9._-]{0,119}$/;
export function HoItemCreate({onCreated}:{onCreated:()=>void}){
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[key,setKey]=useState("");
 const [kind,setKind]=useState<ItemKind>("WEARABLE"),[slot,setSlot]=useState<Slot>("HAIR");
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 function close(){if(busy)return;setOpen(false);setError("");}
 function begin(){setName("");setKey("");setKind("WEARABLE");setSlot("HAIR");setFile(null);setError("");setOpen(true);}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  const displayName=name.trim(),itemKey=key.trim();
  if(!displayName||displayName.length>160){setError("Nhập tên Item (tối đa 160 ký tự).");return;}
  if(!itemKeyPattern.test(itemKey)){setError("Item Key chỉ dùng chữ thường, số, dấu chấm, gạch ngang và gạch dưới.");return;}
  if(kind!=="SET"&&(!file||!["image/png","image/webp"].includes(file.type)||file.size<1||file.size>10*1024*1024)){
   setError("Chọn PNG hoặc WebP tối đa 10 MB.");return;
  }
  setBusy(true);setError("");
  try{
   if(kind==="SET"){
    await writeItem("","POST",{key:itemKey,displayName,type:"SET",starterEligible:false,memberItemIds:[]});
   }else if(file){
    const asset=await uploadItem(file);
    await writeItem("","POST",{key:itemKey,displayName,type:kind,slot,asset,positionX:0,positionY:0,scale:1,rotationDegrees:null});
   }
   setOpen(false);setName("");setKey("");setFile(null);onCreated();
  }catch(e){setError(e instanceof Error?e.message:"Không thể tạo Item.");}
  finally{setBusy(false);}
 }
 const footer=<>
  <button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button>
  <button type="submit" form="pap1700-ho-create-item" className="primary-btn" disabled={busy}>{busy?"Đang tạo…":"Tạo bản nháp"}</button>
 </>;
 return <div className="pino-item-create" data-jira="PAP-1700">
  <button type="button" className="primary-btn" aria-expanded={open} onClick={begin}>＋ Tạo Item</button>
  {open?<DrawerFrame title="Tạo Item" path="Pinoria · Items" onClose={close} footer={footer}>
   <form id="pap1700-ho-create-item" className="pino-item-create-form" aria-label="Tạo Item" onSubmit={event=>{void submit(event);}} noValidate>
    <section className="pino-item-create-section" aria-label="Thông tin Item">
     <h3>THÔNG TIN ITEM</h3>
     <label>Tên Item *<input autoFocus required maxLength={160} value={name} onChange={e=>{setName(e.target.value);setError("");}} placeholder="Ví dụ: Mũ Sao Biển"/></label>
     <label>Item Key *<input required maxLength={120} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="mu-sao-bien"/><small>Chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới.</small></label>
     <label>Loại *<select value={kind} onChange={e=>{setKind(e.target.value as ItemKind);setFile(null);setError("");}}><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option><option value="SET">Set</option></select></label>
     {kind!=="SET"?<>
      <label>Slot *<select value={slot} onChange={e=>setSlot(e.target.value as Slot)}>{slots.map(k=><option key={k} value={k}>{slotNames[k]}</option>)}</select></label>
      <label>Asset PNG / WebP *<input type="file" accept="image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]??null);setError("");}}/><small>{file?file.name:"Ảnh tối đa 10 MB."}</small></label>
     </>:<p className="pino-item-create-helper">SET không có asset riêng. Tạo bản nháp trước, sau đó thêm Item đã Publish trong tab Thành viên.</p>}
     <div className="pino-item-create-state"><span>Trạng thái sau khi tạo</span><strong>DRAFT</strong><small>Không tự Publish, cấp Starter hoặc Item cho Self.</small></div>
     {error?<p role="alert" className="pino-item-create-error">{error}</p>:null}
    </section>
    <section className="pino-item-create-section" aria-label="Thông tin hệ thống">
     <h3>THÔNG TIN HỆ THỐNG</h3>
     <div className="pino-item-create-system"><span>Created Time</span><strong>—</strong><span>Created by (User)</span><strong>—</strong><span>Last Modified Time</span><strong>—</strong><span>Last Modified By (User)</span><strong>—</strong></div>
    </section>
   </form>
  </DrawerFrame>:null}
 </div>;
}
