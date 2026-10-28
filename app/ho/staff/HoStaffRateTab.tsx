"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {BoDataGrid,type BoDataGridColumn} from "@/app/bo/components/data-grid";
import styles from "./HoStaffRateTab.module.css";
type Rate={id:string;staffMemberId:string;effectiveFrom:string;periodUntilExclusive:string|null;amountMinor:number;currency:"VND";note:string|null;version:number};
type Row={id:string;from:string;until:string|null;amountMinor:number;note:string|null};
const money=new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0});
const date=new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
const display=(value:string)=>date.format(new Date(value+"T00:00:00Z"));
const dayBefore=(value:string)=>new Date(Date.parse(value+"T00:00:00Z")-86400000).toISOString().slice(0,10);
const columns:BoDataGridColumn<Row>[]=[
 {key:"effectiveFrom",header:"Ngày hiệu lực",minWidth:126,width:136,render:x=><strong>{display(x.from)}</strong>},
 {key:"effectiveUntil",header:"Ngày kết thúc",minWidth:130,width:140,render:x=>x.until?display(x.until):"—"},
 {key:"amount",header:"Mức lương",minWidth:145,width:155,render:x=><strong>{money.format(x.amountMinor)} ₫/giờ</strong>},
 {key:"note",header:"Lý do",minWidth:245,width:330,render:x=>x.note||"—"},
];
const errorText=(status:number)=>status===401?"Phiên đăng nhập đã hết hạn.":status===403?"Bạn không có quyền xem hoặc quản lý mức lương.":status===409?"Ngày hiệu lực đã tồn tại.":status===404?"Không tìm thấy hồ sơ Staff.":status===400?"Dữ liệu chưa hợp lệ.": "Không thể kết nối dịch vụ Rate lương.";
/** HO-only typed business tab embedded in the shared TDD DetailFrame. Never used by BO. */
export function HoStaffRateTab({staffId}:{staffId:string}){
 const [records,setRecords]=useState<Rate[]>([]);
 const [revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [amount,setAmount]=useState("");
 const [effectiveFrom,setEffectiveFrom]=useState("");
 const [note,setNote]=useState("");
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const url="/api/ho/staff/"+encodeURIComponent(staffId)+"/compensation";
 useEffect(()=>{
  const controller=new AbortController();
  setRecords([]);setError("");setLoading(true);
  const conceal=()=>{if(document.visibilityState==="hidden")setRecords([])};
  const hide=()=>setRecords([]);
  document.addEventListener("visibilitychange",conceal);window.addEventListener("pagehide",hide);
  void (async()=>{
   try{
    const response=await fetch(url,{cache:"no-store",credentials:"same-origin",signal:controller.signal});
    if(!response.ok)throw new Error(errorText(response.status));
    const body=await response.json() as {data?:Rate[]};
    if(!Array.isArray(body.data)||body.data.some(x=>!x||x.staffMemberId!==staffId||!Number.isSafeInteger(x.amountMinor)))throw new Error("Lịch sử Rate không hợp lệ.");
    if(!controller.signal.aborted)setRecords(body.data);
   }catch(e){if(!controller.signal.aborted){setRecords([]);setError(e instanceof Error?e.message:"Không tải được lịch sử Rate.");}}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>{controller.abort();document.removeEventListener("visibilitychange",conceal);window.removeEventListener("pagehide",hide)};
 },[staffId,revision,url]);
 const rows=useMemo<Row[]>(()=>records.slice().sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))
  .map(x=>({id:x.id,from:x.effectiveFrom,until:x.periodUntilExclusive?dayBefore(x.periodUntilExclusive):null,amountMinor:x.amountMinor,note:x.note})),[records]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(saving)return;
  setNotice("");
  const rate=Number(amount);
  if(!Number.isSafeInteger(rate)||rate<1||rate>1_000_000_000_000||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)||!note.trim()||note.trim().length>500){setNotice("Kiểm tra mức lương, ngày hiệu lực và lý do.");return;}
  setSaving(true);
  try{
   const result=await fetch(url,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({amountMinor:rate,effectiveFrom,note:note.trim()})});
   if(!result.ok)throw new Error(errorText(result.status));
   setAmount("");setEffectiveFrom("");setNote("");
   setNotice("Đã lưu mức lương.");setRevision(x=>x+1);
  }catch(e){setNotice(e instanceof Error?e.message:"Không thể lưu mức lương.");}
  finally{setSaving(false);}
 }
 return <div className={styles.workspace} data-tdd-slot="ho-staff-rate" aria-label="Rate lương HO">
  <section className="v24-prop-section" aria-label="Mức lương mới">
   <div className="v24-section-heading"><h4>Mức lương mới</h4><span className={styles.staffId}>Staff · {staffId}</span></div>
   <form className={styles.form} onSubmit={event=>void submit(event)}>
    <label>Mức lương <span className={styles.rateWrap}><input type="number" min={1} step={1} required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Nhập mức lương" disabled={saving}/><span aria-hidden="true">₫/giờ</span></span></label>
    <label>Hiệu lực từ <input type="date" required value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)} disabled={saving}/></label>
    <label className={styles.reason}>Lý do<textarea rows={2} maxLength={500} required value={note} onChange={e=>setNote(e.target.value)} placeholder="Lý do điều chỉnh mức lương…" disabled={saving}/></label>
    <div className={styles.actions}><button className="primary-btn" type="submit" disabled={saving||loading||Boolean(error)}>{saving?"Đang lưu…":"Lưu mức lương"}</button></div>
   </form>
   {notice?<p className={styles.feedback} role="status">{notice}</p>:null}
  </section>
  <section className="v24-prop-section" aria-label="Lịch sử Rate">
   <div className="v24-section-heading"><h4>Lịch sử Rate</h4></div>
   {error?<p role="alert">{error} <button type="button" onClick={()=>setRevision(x=>x+1)}>Thử lại</button></p>:<div className={styles.grid}><BoDataGrid caption="Lịch sử Rate" showToolbar={false} rows={rows} columns={columns} rowKey={x=>x.id} state={loading?"loading":"ready"} emptyTitle="Chưa có mức lương" emptyMessage="Hãy lưu mức lương mới để tạo mốc đầu tiên."/></div>}
  </section>
 </div>;
}
