"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {boApi} from "@/lib/bo-api";
import {periodApi,money,validPeriodInput,type PayPeriod,type PeriodStaff,type PeriodStaffPage,
 type SettlementPreview} from "@/lib/bo-payroll-period-api";
import styles from "./payroll-periods.module.css";
type Center={id:string;displayName:string;status:string};
type Form={name:string;startDate:string;endDate:string};
const empty:Form={name:"",startDate:"",endDate:""};
const makeKey=()=>typeof crypto!=="undefined"&&crypto.randomUUID?
 "pay-period-"+crypto.randomUUID():"pay-period-"+Date.now()+"-"+Math.random().toString(36).slice(2);
function errorText(e:unknown){return e instanceof Error?e.message:"Không thể truy cập dữ liệu lương.";}
export default function PayrollPeriodsView(){
 const [centers,setCenters]=useState<Center[]>([]),[centerId,setCenterId]=useState("");
 const [periods,setPeriods]=useState<PayPeriod[]>([]),[periodOffset,setPeriodOffset]=useState<number|null>(null);
 const [selected,setSelected]=useState<PayPeriod|null>(null),[page,setPage]=useState<PeriodStaffPage|null>(null);
 const [staffRows,setStaffRows]=useState<PeriodStaff[]>([]),[staffOffset,setStaffOffset]=useState<number|null>(null);
 const [staffNames,setStaffNames]=useState<Record<string,string>>({});
 const [staffSearch,setStaffSearch]=useState(""),[activeStaff,setActiveStaff]=useState<PeriodStaff|null>(null);
 const [detail,setDetail]=useState<SettlementPreview|null>(null);
 const [form,setForm]=useState<Form>(empty),[editing,setEditing]=useState(false);
 const [paymentDate,setPaymentDate]=useState(""),[paymentReference,setPaymentReference]=useState("");
 const [ack,setAck]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const pendingKey=useRef<{payload:string;key:string}|null>(null);
 const fence=useRef(0);
 useEffect(()=>{let live=true;
  void boApi.centers().then(items=>{if(!live)return;const active=items.filter(x=>x.status==="active");
   setCenters(active);setCenterId(active[0]?.id??"");}).catch(e=>{if(live)setError(errorText(e));});
  void boApi.staffRecords().then(items=>{if(live)setStaffNames(Object.fromEntries(items.map(x=>[x.id,x.displayLabel])));})
   .catch(()=>{/* Staff directory is optional, Core enforces payroll ACL. */});
  return()=>{live=false;};
 },[]);
 useEffect(()=>{fence.current++;setPeriods([]);setPeriodOffset(null);setSelected(null);setPage(null);setStaffRows([]);setActiveStaff(null);
  setDetail(null);setEditing(false);setError("");setNotice("");pendingKey.current=null;
  if(!centerId)return;const id=fence.current;setLoading(true);
  void periodApi.list(centerId).then(r=>{if(id!==fence.current)return;setPeriods(r.data.data);
   setPeriodOffset(r.data.nextOffset);}).catch(e=>{if(id===fence.current)setError(errorText(e));})
   .finally(()=>{if(id===fence.current)setLoading(false);});
 },[centerId,revision]);
 useEffect(()=>{if(!selected||!centerId)return;let live=true;setLoading(true);setError("");
  void periodApi.staff(centerId,selected.id).then(r=>{if(!live)return;setPage(r.data);
   setStaffRows(r.data.rows);setStaffOffset(r.data.nextOffset);}).catch(e=>{if(live)setError(errorText(e));})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[selected,centerId,revision]);
 useEffect(()=>{if(!activeStaff||!selected||!centerId)return;let live=true;setDetail(activeStaff.preview);
  if(activeStaff.status==="DRAFT"||activeStaff.status==="PENDING"){
   void periodApi.preview(centerId,selected.id,activeStaff.staffMemberId)
    .then(r=>{if(live)setDetail(r.data);}).catch(e=>{if(live)setError(errorText(e));});
  }
  return()=>{live=false;};
 },[activeStaff,selected,centerId]);
 useEffect(()=>{const clear=()=>{fence.current++;setDetail(null);setActiveStaff(null);setPage(null);
  setStaffRows([]);setPeriods([]);setSelected(null);setRevision(x=>x+1);};
  const visibility=()=>{if(document.hidden)clear();};
  window.addEventListener("pagehide",clear);document.addEventListener("visibilitychange",visibility);
  return()=>{window.removeEventListener("pagehide",clear);document.removeEventListener("visibilitychange",visibility);};
 },[]);
 function choose(period:PayPeriod){fence.current++;setSelected(period);setActiveStaff(null);setDetail(null);setStaffSearch("");
  setPaymentDate("");setPaymentReference("");setAck(false);setEditing(false);setNotice("");setError("");}
 function edit(period:PayPeriod){fence.current++;setSelected(period);setForm({name:period.name,startDate:period.startDate,endDate:period.endDate});
  setEditing(true);setError("");}
 function fresh(){setRevision(x=>x+1);}
 async function save(e:FormEvent){e.preventDefault();if(busy||!centerId||!validPeriodInput(form))return;
  const payload=JSON.stringify({centerId,...form,periodId:editing?selected?.id:null,version:editing?selected?.version:null});
  const key=pendingKey.current?.payload===payload?pendingKey.current.key:makeKey();
  pendingKey.current={payload,key};setBusy(true);setError("");try{
   if(editing&&!selected)throw Error("Chưa chọn kỳ lương.");
   await (editing?periodApi.edit(centerId,selected!,form):periodApi.create(centerId,form,key));
   pendingKey.current=null;setEditing(false);setNotice("Core đã lưu kỳ lương.");fresh();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function morePeriods(){if(periodOffset===null||loading)return;const token=fence.current;setLoading(true);
  try{const r=await periodApi.list(centerId,periodOffset);if(token!==fence.current)return;
   setPeriods(x=>[...x,...r.data.data]);setPeriodOffset(r.data.nextOffset);}catch(e){setError(errorText(e));}finally{setLoading(false);}
 }
 async function moreStaff(){if(!selected||staffOffset===null||loading)return;
  const token=fence.current,periodId=selected.id;setLoading(true);
  try{const r=await periodApi.staff(centerId,periodId,staffOffset);
   if(token!==fence.current)return;
   setStaffRows(x=>[...x,...r.data.rows]);setStaffOffset(r.data.nextOffset);
  }catch(e){setError(errorText(e));}finally{setLoading(false);}
 }
 async function finalize(){if(!selected||!activeStaff||!detail||busy||!ack)return;
  if(!window.confirm("Chốt bất biến lương của nhân viên này? Không thể sửa trực tiếp sau khi chốt."))return;
  setBusy(true);setError("");try{
   await periodApi.finalize(centerId,selected.id,activeStaff.staffMemberId,detail,makeKey());
   setNotice("Đã chốt lương nhân viên.");setActiveStaff(null);setDetail(null);fresh();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function markPaid(){if(!activeStaff?.settlementId||!paymentDate||!paymentReference.trim()||busy)return;
  if(!window.confirm("Xác nhận đã thanh toán ngoài hệ thống? Hành động này chỉ ghi nhận trạng thái Paid, không chuyển tiền."))return;
  setBusy(true);setError("");try{
   await periodApi.paid(centerId,activeStaff.settlementId,paymentDate,paymentReference.trim(),makeKey());
   setNotice("Đã ghi nhận thanh toán.");setActiveStaff(null);setDetail(null);fresh();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 const shown=staffRows.filter(x=>(staffNames[x.staffMemberId]??x.staffMemberId)
  .toLocaleLowerCase("vi").includes(staffSearch.toLocaleLowerCase("vi")));
 return <main className={styles.page}>
  <header className={styles.heading}><small>Back Office · Workforce · Payroll</small><h1>Kỳ lương</h1>
   <p>Kỳ là bảng tổng hợp. Chốt và thanh toán độc lập theo từng nhân viên, không chốt toàn kỳ.</p></header>
  <div className={styles.toolbar}><label>Cơ sở <select value={centerId} onChange={e=>setCenterId(e.target.value)}>
   {centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
   <button type="button" onClick={()=>{setEditing(false);setForm(empty);setSelected(null);setError("");}}>Tạo kỳ lương</button>
   <button type="button" onClick={fresh} disabled={loading}>Làm mới</button></div>
  {error?<p role="alert" className={styles.error}>{error}</p>:null}
  {notice?<p role="status" className={styles.notice}>{notice}</p>:null}
  {(!selected||editing)&&<section className={styles.card}>
   <h2>{editing?"Chỉnh sửa kỳ lương":"Kỳ lương mới"}</h2>
   <form className={styles.form} onSubmit={e=>void save(e)}>
    <label>Tên kỳ<input required maxLength={120} value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label>
    <label>Bắt đầu<input type="date" required disabled={editing&&selected?.dateLocked}
     value={form.startDate} onChange={e=>setForm(x=>({...x,startDate:e.target.value}))}/></label>
    <label>Kết thúc<input type="date" required disabled={editing&&selected?.dateLocked}
     value={form.endDate} onChange={e=>setForm(x=>({...x,endDate:e.target.value}))}/></label>
    <button disabled={busy||!centerId||!validPeriodInput(form)}>{busy?"Đang lưu…":"Lưu kỳ lương"}</button>
    {editing?<button type="button" onClick={()=>setEditing(false)}>Hủy</button>:null}
   </form>{editing&&selected?.dateLocked?<p>Ngày đã khóa vì có nhân viên chốt lương. Chỉ có thể đổi tên.</p>:null}
  </section>}
  <section className={styles.card}><h2>Danh sách kỳ lương ({periods.length})</h2>
   <div className={styles.scroll}><table><thead><tr><th>Tên kỳ</th><th>Từ ngày</th><th>Đến ngày</th>
    <th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
    {periods.map(p=><tr key={p.id}><td><button className={styles.link} onClick={()=>choose(p)}>{p.name}</button></td>
     <td>{p.startDate}</td><td>{p.endDate}</td><td>{p.status==="ARCHIVED"?"Lưu trữ":p.dateLocked?"Đã có lương chốt":"Đang mở"}</td>
     <td><button type="button" onClick={()=>edit(p)} disabled={p.status==="ARCHIVED"}>Sửa</button></td></tr>)}
   </tbody></table></div>
   {!loading&&!periods.length?<p>Chưa có kỳ lương nào tại cơ sở này.</p>:null}
   {periodOffset!==null?<button type="button" onClick={()=>void morePeriods()} disabled={loading}>Tải thêm kỳ</button>:null}
  </section>
  {selected&&!editing&&<section className={styles.card}><div className={styles.toolbar}>
   <h2>{selected.name} · {selected.startDate} → {selected.endDate}</h2>
   <button type="button" onClick={()=>edit(selected)} disabled={selected.status==="ARCHIVED"}>Sửa kỳ</button></div>
   {page?<><div className={styles.metrics}>
    <span>Đã chốt: {page.periodTotals.finalizedCount}</span><span>Đã trả: {page.periodTotals.paidCount}</span>
    <span>Chờ xử lý: {page.periodTotals.pendingCount}</span><span>Tổng đã biết: {money(page.periodTotals.knownMinor)}</span>
   </div><p className={styles.hint}>Tổng FULL_PERIOD; Draft là ước tính, Finalized/Paid là snapshot. Khoản Pending chưa tính vào tổng đã biết.
    {page.periodTotals.hasUnavailable?" Có nhân viên đã lưu trữ không thể tái tính.":""}</p></>:null}
   <label>Tìm nhân viên <input value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="Tên nhân viên"/></label>
   <div className={styles.scroll}><table><thead><tr><th>Nhân viên</th><th>Trạng thái</th><th>Số tiền</th><th>Lưu ý</th></tr></thead>
    <tbody>{shown.map(row=><tr key={row.staffMemberId}><td><button className={styles.link} onClick={()=>{
     setActiveStaff(row);setAck(false);setPaymentDate("");setPaymentReference("");}}>
     {staffNames[row.staffMemberId]??row.staffMemberId}</button></td><td>{row.status}</td>
     <td>{money(row.amountMinor??row.provisionalAmountMinor)}</td><td>{row.warnings.length} cảnh báo</td></tr>)}</tbody></table></div>
   {page&&!page.totalStaffCount?<p>Không có nhân viên phát sinh trong kỳ.</p>:null}
   {staffOffset!==null?<button type="button" onClick={()=>void moreStaff()} disabled={loading}>Tải thêm nhân viên</button>:null}
   {activeStaff&&<aside className={styles.detail}><h3>{staffNames[activeStaff.staffMemberId]??activeStaff.staffMemberId}</h3>
    <p>Trạng thái: <strong>{activeStaff.status}</strong> · {money(detail?.amountMinor??activeStaff.amountMinor)}</p>
    {detail?<><p>Lương theo ngày: {money(detail.days.reduce((s,x)=>s+(x.status==="READY"?x.amountMinor??0:0),0))}</p>
     <p>Thêm giờ được duyệt: {money(detail.extraTimeMinor)} · Điều chỉnh: {money(detail.adjustmentsMinor)}</p>
     <ul>{detail.days.map(x=><li key={x.workDate}>{x.workDate}: {x.status} · {money(x.amountMinor)}</li>)}</ul>
     {detail.warnings.length?<p role="alert">Cảnh báo: {detail.warnings.join(", ")}</p>:null}
    </>:null}
    {activeStaff.status==="DRAFT"||activeStaff.status==="PENDING"?<div>
     <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
      Tôi đã kiểm tra số tiền và xác nhận các cảnh báo của nhân viên này.</label>
     <button disabled={busy||!ack||!detail||selected.status!=="ACTIVE"} onClick={()=>void finalize()}>Chốt nhân viên</button>
    </div>:null}
    {activeStaff.status==="FINALIZED"&&<div className={styles.form}>
     <label>Ngày đã trả<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label>
     <label>Chứng từ thanh toán<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/></label>
     <button disabled={busy||!paymentDate||!paymentReference.trim()} onClick={()=>void markPaid()}>Ghi nhận Paid</button>
    </div>}
    <button type="button" onClick={()=>{setActiveStaff(null);setDetail(null);}}>Đóng</button>
   </aside>}
  </section>}
 </main>;
}
