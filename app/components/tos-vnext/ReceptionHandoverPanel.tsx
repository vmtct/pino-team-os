"use client";
import {useEffect,useRef,useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCheck,faShieldHalved} from "@fortawesome/free-solid-svg-icons";
import {tosReceptionHouseApi,pickupProof,type PickupScope,type PickupOption,type ReceptionHouseCheckOutInput} from "@/lib/tos-reception-house-api";
import css from "./ops.module.css";

type Intent={input:ReceptionHouseCheckOutInput;key:string};
export function ReceptionHandoverPanel({scope,onDone}:{scope:PickupScope;onDone:()=>void}){
 const key=JSON.stringify(scope);
 return <Handover key={key} scope={scope} onDone={onDone}/>;
}
function Handover({scope,onDone}:{scope:PickupScope;onDone:()=>void}){
 const [options,setOptions]=useState<PickupOption[]|null>(null),[selected,setSelected]=useState(""),[verified,setVerified]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[epoch,setEpoch]=useState(0),[locked,setLocked]=useState(false);
 const intent=useRef<Intent|null>(null),flight=useRef(false),mounted=useRef(false);
 const {centerId,studentProfileId,expectedVisitId,expectedVersion}=scope;
 useEffect(()=>{
  mounted.current=true;const c=new AbortController();
  void tosReceptionHouseApi.pickupOptions({centerId,studentProfileId,expectedVisitId,expectedVersion},c.signal).then(x=>{if(!c.signal.aborted)setOptions(x);}).catch(()=>{if(!c.signal.aborted)setError("Chưa xác minh được người đón.");});
  return()=>{mounted.current=false;c.abort();};
 },[centerId,studentProfileId,expectedVisitId,expectedVersion,epoch]);
 const chosen=options?.find(x=>x.relationshipId===selected);
 async function submit(){
  if(flight.current||!chosen||!verified)return;
  flight.current=true;setBusy(true);setError("");
  try{
   const command=intent.current??{input:{...scope,pickupProof:pickupProof(chosen),checkedOutAt:new Date().toISOString(),reason:"Guardian handover"},key:crypto.randomUUID()};
   intent.current=command;setLocked(true);
   await tosReceptionHouseApi.checkOut(command.input,command.key);
   if(mounted.current)onDone();
  }catch{if(mounted.current)setError("Chưa xác minh được bàn giao. Kiểm tra lại trạng thái trước khi tiếp tục.");}
  finally{flight.current=false;if(mounted.current)setBusy(false);}
 }
 return <>
  <div className={css.callout}><strong><FontAwesomeIcon icon={faShieldHalved}/> Xác minh người đón</strong><span>Chỉ bàn giao cho Parent/Guardian đang có hiệu lực. Xác minh danh tính trực tiếp.</span></div>
  {options===null?<p role="status">{error?"Chưa tải được":"Đang xác minh..."}</p>:options.length===0?<p role="status">Không có người đón hợp lệ.</p>:<label className={css.fieldLabel}>Người đón<select className={css.input} value={selected} disabled={busy||locked} onChange={e=>{setSelected(e.target.value);setVerified(false);}}><option value="">Chọn người đón</option>{options.map(o=><option key={o.relationshipId} value={o.relationshipId}>{o.displayName} · {o.relationshipType==="PARENT"?"Phụ huynh":"Người giám hộ"}</option>)}</select></label>}
  <label className={css.fieldLabel}><span><input type="checkbox" disabled={!chosen||busy||locked} checked={verified} onChange={e=>setVerified(e.target.checked)}/> Đã xác minh danh tính trực tiếp</span></label>
  <button type="button" className={css.primary} disabled={!chosen||!verified||busy} onClick={()=>void submit()}><FontAwesomeIcon icon={faCheck}/> {busy?"Đang xác minh...":"Checkout & bàn giao"}</button>
  {error&&<div role="alert">{error}{!locked&&<button type="button" className={css.secondary} onClick={()=>{setError("");setOptions(null);setSelected("");setVerified(false);setEpoch(v=>v+1);}}>Tải lại</button>}</div>}
 </>;
}
