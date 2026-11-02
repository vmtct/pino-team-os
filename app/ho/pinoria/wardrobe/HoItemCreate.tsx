"use client";
import {useState,type FormEvent} from "react";
import {slots,slotNames,uploadItem,writeItem,type Slot} from "./item-client";
/** Creation is an authorized S1 action alongside the canonical TDD Table; not a second Table shell. */
export function HoItemCreate({onCreated}:{onCreated:()=>void}){
 const [open,setOpen]=useState(false),[name,setName]=useState(""),[key,setKey]=useState("");
 const [kind,setKind]=useState<"WEARABLE"|"ACCESSORY"|"SET">("WEARABLE"),[slot,setSlot]=useState<Slot>("HAIR");
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(kind!=="SET"&&!file){setError("Chọn ảnh PNG hoặc WebP trước khi tạo Item.");return}
  if(!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(key)){setError("Item Key chỉ dùng chữ thường, số, dấu chấm, gạch ngang và gạch dưới.");return}
  setBusy(true);setError("");
  try{
   if(kind==="SET")await writeItem("","POST",{key,displayName:name,type:"SET",starterEligible:false,memberItemIds:[]});
   else if(file){const asset=await uploadItem(file);await writeItem("","POST",{key,displayName:name,type:kind,slot,asset,positionX:0,positionY:0,scale:1,rotationDegrees:null});}
   setOpen(false);setFile(null);setName("");setKey("");onCreated();
  }catch(e){setError(e instanceof Error?e.message:"Không thể tạo Item.");}finally{setBusy(false)}
 }
 return <div className="pino-item-create">
  <button type="button" className="primary-btn" aria-expanded={open} onClick={()=>setOpen(x=>!x)}>{open?"Đóng biểu mẫu":"＋ Tạo Item"}</button>
  {open?<form onSubmit={submit} className="pino-item-create-form" aria-label="Tạo Item">
    <label>Tên Item<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Item Key<input required maxLength={120} value={key} onChange={e=>setKey(e.target.value)}/></label>
    <label>Loại<select value={kind} onChange={e=>{setKind(e.target.value as "WEARABLE"|"ACCESSORY"|"SET");setFile(null)}}><option value="WEARABLE">Wearable</option><option value="ACCESSORY">Accessory</option><option value="SET">Set</option></select></label>
    {kind!=="SET"?<label>Slot<select value={slot} onChange={e=>setSlot(e.target.value as Slot)}>{slots.map(k=><option key={k} value={k}>{slotNames[k]}</option>)}</select></label>:null}
    {kind!=="SET"?<label>Asset PNG/WebP<input required type="file" accept="image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>:<p>SET không có asset riêng. Sau khi tạo, chọn Item đã Publish tại tab Thành viên và Publish.</p>}
    {error?<p role="alert">{error}</p>:null}
    <button className="primary-btn" type="submit" disabled={busy}>{busy?"Đang tạo…":"Tạo bản nháp"}</button>
   </form>:null}
 </div>;
}
