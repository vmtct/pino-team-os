"use client";
/** PAP-1700 / PAP-1097 PNR-WARD: Founder-approved HO Item Create uses canonical Dsa DrawerFrame. */
import {useState,type FormEvent} from "react";
import "@/app/components/pinoria-item/item-calibration.css";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {slots,slotNames,uploadItem,writeItem,type Slot,type ItemRarity,parseItemRarityLabel,itemRarityLabel} from "./item-client";

type ItemKind="WEARABLE"|"ACCESSORY"|"SET";
const itemKeyPattern=/^[a-z0-9][a-z0-9._-]{0,119}$/;
export function HoItemCreate({onCreated,onClose}:{onCreated:()=>void;onClose:()=>void}){
 const [name,setName]=useState(""),[key,setKey]=useState("");
 const [kind,setKind]=useState<ItemKind>("WEARABLE"),[slot,setSlot]=useState<Slot>("HAIR");
 const [checkInItem,setCheckInItem]=useState(false),[rarity,setRarity]=useState<ItemRarity|null>(null);
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 function close(){if(busy)return;onClose();}

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
    const created=await writeItem("","POST",{key:itemKey,displayName,type:kind,slot,asset,positionX:0,positionY:0,scale:1,rotationDegrees:null,checkInItem,...(rarity===null?{}:{rarity})});
    if(rarity!==null&&(created.type==="SET"||created.rarity!==rarity))throw Error("Item đã tạo nhưng rarity chưa được xác minh. Tải lại danh sách; không tạo lại.");
   }
   onCreated();
  }catch(e){setError(e instanceof Error?e.message:"Không thể tạo Item.");}
  finally{setBusy(false);}
 }
 const footer=<>
  <button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button>
  <button type="submit" form="pap1700-ho-create-item" className="primary-btn" disabled={busy}>{busy?"Đang tạo…":"Tạo bản nháp"}</button>
 </>;
 return <div className="pino-item-create" data-jira="PAP-1700">

  <DrawerFrame title="Tạo Item" path="Pinoria · Items" onClose={close} footer={footer}>
   <form id="pap1700-ho-create-item" className="pino-item-create-form" aria-label="Tạo Item" onSubmit={event=>{void submit(event);}} noValidate>
    <section className="pino-item-create-section" aria-label="Thông tin Item">
     <h3>THÔNG TIN ITEM</h3>
     <label>Tên Item *<input required maxLength={160} value={name} onChange={e=>{setName(e.target.value);setError("");}} placeholder="Ví dụ: Mũ Sao Biển"/></label>
     <label>Item Key *<input required maxLength={120} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="mu-sao-bien"/><small>Chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới.</small></label>
     <label>Loại *<select value={kind} onChange={e=>{setKind(e.target.value as ItemKind);setCheckInItem(false);setRarity(null);setFile(null);setError("");}}><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option><option value="SET">Set</option></select></label>
     {kind!=="SET"?<>
      <div data-item-drawer-key="checkInItem" data-item-field-type="boolean"><span id="pap2073-check-in-label">Check-in Item</span><label className="option-item pap2073-check-in-option"><input type="checkbox" aria-labelledby="pap2073-check-in-label" checked={checkInItem} disabled={busy} onChange={event=>setCheckInItem(event.target.checked)}/><span>{checkInItem?"Yes":"No"}</span></label></div>
      <label>Rarity<select value={itemRarityLabel(rarity)} disabled={busy} onChange={e=>setRarity(parseItemRarityLabel(e.target.value))}>{["Chưa cấu hình","3★","4★","5★"].map(v=><option key={v}>{v}</option>)}</select><small>Chỉ Item đã Publish có rarity mới được dùng trong Wish.</small></label>
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
  </DrawerFrame>
 </div>;
}
