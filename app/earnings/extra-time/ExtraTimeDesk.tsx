"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {TosShell} from "@/app/components/tos-shell";
import {TOS_SHIFT_FOOTER} from "@/app/components/tos-shell/navigation";
import {workforceApi,type WorkforceContext} from "@/lib/workforce-api";
import {
  availableExtraTimeWindows,createExtraTimePayload,extraTimeApi,
  ExtraTimeApiError,formatVietnamTime,type EligibleTimeWindow,type OwnExtraTimeRequest,
} from "@/lib/tos-payroll-extra-time-api";
import styles from "./extra-time.module.css";

type Tab="create"|"history";
type Center=WorkforceContext["centers"][number];
const daysAgo=(amount:number)=>new Date(Date.now()-amount*86400000).toISOString().slice(0,10);
const dateInCenter=(zone:string)=>new Intl.DateTimeFormat("en-CA",{
  timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",
}).format(new Date());
function nextKey():string{
  if(typeof crypto!=="undefined" && typeof crypto.randomUUID==="function")
    return "pay-extra-"+crypto.randomUUID();
  return "pay-extra-"+Date.now().toString(36)+"-"+Math.floor(Math.random()*1e9).toString(36);
}
function getError(error:unknown):string{
  if(error instanceof ExtraTimeApiError) {
    const detail=(error.code+" "+error.message).toUpperCase();
    if(error.status===403)return "Tài khoản chưa được cấp quyền gửi yêu cầu tại cơ sở này.";
    if(detail.includes("ALREADY_PAID_STANDARD"))
      return "Khoảng thời gian này đã nằm trong giờ công chuẩn được tính.";
    if(detail.includes("SOURCE_NOT_ELIGIBLE"))
      return "Giờ yêu cầu phải nằm trong check-in/out đã hoàn tất của ca được phân công.";
    if(detail.includes("OVERLAP"))return "Khoảng giờ này bị trùng yêu cầu đang chờ duyệt.";
    if(error.status===409)return "Dữ liệu giờ công đã thay đổi. Tải lại rồi thử tiếp.";
    return error.message;
  }
  return error instanceof Error?error.message:"Không thể tải dữ liệu yêu cầu tính thêm giờ.";
}
function presetClock(window:EligibleTimeWindow|null):{from:string;to:string}{
  if(!window)return {from:"",to:""};
  const from=formatVietnamTime(window.checkInAt);
  const max=formatVietnamTime(window.checkOutAt);
  const [hours,minutes]=from.split(":").map(Number);
  const next=Number.isFinite(hours)&&Number.isFinite(minutes)
    ?Math.min(hours*60+minutes+15,23*60+59):0;
  const suggested=String(Math.floor(next/60)).padStart(2,"0")+":"+String(next%60).padStart(2,"0");
  return {from,to:suggested>max?max:suggested};
}
function niceDate(value:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ?value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4):value;
}
function statusName(status:OwnExtraTimeRequest["status"]){
  return status==="PENDING"?"Đang chờ duyệt":"Đã rút yêu cầu";
}

export default function ExtraTimeDesk(){
  const [centers,setCenters]=useState<Center[]>([]);
  const [centerId,setCenterId]=useState("");
  const [windows,setWindows]=useState<EligibleTimeWindow[]>([]);
  const [selectedKey,setSelectedKey]=useState("");
  const [requests,setRequests]=useState<OwnExtraTimeRequest[]>([]);
  const [tab,setTab]=useState<Tab>("create");
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[reason,setReason]=useState("");
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[success,setSuccess]=useState("");
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const [loadingMore,setLoadingMore]=useState(false);
  const attempt=useRef<{signature:string;key:string}|null>(null);
  const chosen=useMemo(()=>windows.find(w=>w.key===selectedKey)??null,[windows,selectedKey]);
  const center=centers.find(c=>c.id===centerId)??null;

  useEffect(()=>{
    let live=true;
    void workforceApi.context().then(({data})=>{
      if(!live)return;
      setCenters(data.centers);setCenterId(data.centers[0]?.id??"");
      if(!data.centers.length)setError("Chưa có Center được phân quyền trong tài khoản.");
    }).catch((failure:unknown)=>{if(live){setError(getError(failure));setLoading(false);}});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!center)return;
    let live=true;
    setLoading(true);setError("");setSuccess("");
    const endDate=dateInCenter(center.timeZone);
    void Promise.all([
      workforceApi.schedule({centerId,startDate:daysAgo(60),endDate}),
      workforceApi.history({centerId,startDate:daysAgo(60),endDate}),
      extraTimeApi.ownHistory(centerId),
    ]).then(([scheduled,attendance,history])=>{
      if(!live)return;
      const choices=availableExtraTimeWindows(scheduled.data,attendance.data,centerId);
      setWindows(choices);setRequests(history.data.data);setNextOffset(history.data.nextOffset);
      setSelectedKey(choices[0]?.key??"");
      const initial=presetClock(choices[0]??null);setFrom(initial.from);setTo(initial.to);
    }).catch((failure:unknown)=>{if(live)setError(getError(failure));})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[centerId,center]);

  function selectWindow(key:string){
    setSelectedKey(key);setError("");setSuccess("");
    const selected=windows.find(w=>w.key===key)??null;
    const next=presetClock(selected);
    setFrom(next.from);setTo(next.to);
    attempt.current=null;
  }
  async function refreshHistory(){
    const result=await extraTimeApi.ownHistory(centerId);
    setRequests(result.data.data);setNextOffset(result.data.nextOffset);
  }
  async function loadMore(){
    if(nextOffset===null||!centerId)return;
    setLoadingMore(true);
    try{
      const result=await extraTimeApi.ownHistory(centerId,undefined,50,nextOffset);
      setRequests(existing=>[...existing,...result.data.data]);setNextOffset(result.data.nextOffset);
    }catch(failure){setError(getError(failure));}
    finally{setLoadingMore(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(saving)return;
    setError("");setSuccess("");
    try{
      const payload=createExtraTimePayload(chosen??undefined,centerId,from,to,reason);
      const signature=JSON.stringify(payload);
      const key=attempt.current?.signature===signature?attempt.current.key:nextKey();
      attempt.current={signature,key};setSaving(true);
      await extraTimeApi.request(payload,key);
      await refreshHistory();
      setReason("");setTab("history");setSuccess("Đã gửi yêu cầu. Chỉ thời gian được BO duyệt mới có thể cộng vào lương.");
      attempt.current=null;
    }catch(failure){setError(getError(failure));}
    finally{setSaving(false);}
  }
  return <TosShell title="Ca làm" theme="shift" footerItems={TOS_SHIFT_FOOTER}
    activeFooterId="income" compactAppHeader backHref="/earnings"
    appIconSrc="https://pub-892fa79b018d4d2f9b0808189dd2ce46.r2.dev/AppIcon/shift.png">
    <main className={styles.stack}>
      <header className={styles.intro}>
        <span>YÊU CẦU NGOÀI GIỜ</span>
        <h2>Tính thêm giờ công</h2>
        <p>Gửi khoảng thời gian đã làm nhưng chưa được tính trong giờ công chuẩn.</p>
      </header>
      {centers.length>1?<label className={styles.label}>Cơ sở
        <select value={centerId} onChange={e=>setCenterId(e.target.value)}>
          {centers.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
      </label>:null}
      <div className={styles.tabs} role="tablist" aria-label="Yêu cầu tính thêm giờ">
        <button type="button" role="tab" aria-selected={tab==="create"}
          className={tab==="create"?styles.selected:""} onClick={()=>setTab("create")}>Tạo yêu cầu</button>
        <button type="button" role="tab" aria-selected={tab==="history"}
          className={tab==="history"?styles.selected:""} onClick={()=>setTab("history")}>Lịch sử yêu cầu</button>
      </div>
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      {success?<p className={styles.success} role="status">{success}</p>:null}
      {loading?<p className={styles.notice}>Đang tải ca làm và dữ liệu yêu cầu từ Core…</p>:tab==="create"?
        <form className={styles.card} onSubmit={event=>void submit(event)}>
          <label className={styles.label}>Ngày làm việc
            <select value={selectedKey} onChange={event=>selectWindow(event.target.value)}
              required disabled={!windows.length||saving}>
              {windows.length?windows.map(w=><option key={w.key} value={w.key}>
                {niceDate(w.workDate)} · {w.label.split(" · ").slice(1).join(" · ")}
              </option>):<option value="">Chưa có ca đã checkout</option>}
            </select>
          </label>
          {chosen?<div className={styles.reference}>
            <strong>Giờ check-in/out ghi nhận</strong>
            <span>{formatVietnamTime(chosen.checkInAt)} – {formatVietnamTime(chosen.checkOutAt)}</span>
            <small>Yêu cầu cần thuộc giờ thực tế đã làm. Manager có thể duyệt một phần.</small>
          </div>:<p className={styles.notice}>Không có ca đã checkout trong 60 ngày gần đây để gửi yêu cầu.</p>}
          <div className={styles.grid}>
            <label className={styles.label}>Từ lúc
              <input type="time" step={60} required value={from} onChange={e=>setFrom(e.target.value)}
                disabled={!chosen||saving}/>
            </label>
            <label className={styles.label}>Đến lúc
              <input type="time" step={60} required value={to} onChange={e=>setTo(e.target.value)}
                disabled={!chosen||saving}/>
            </label>
          </div>
          <label className={styles.label}>Lý do làm thêm
            <textarea value={reason} minLength={10} maxLength={1000} required rows={4}
              placeholder="Mô tả công việc thực tế đã thực hiện…" disabled={!chosen||saving}
              onChange={event=>setReason(event.target.value)}/>
          </label>
          <p className={styles.notice}>Yêu cầu đang chờ không tự cộng vào lương. Giờ chuẩn đã tính sẽ không tính lần nữa.</p>
          <button type="submit" className={styles.primary} disabled={!chosen||saving}>
            {saving?"Đang gửi…":"Gửi yêu cầu duyệt"}
          </button>
        </form>:
        <section className={styles.history} aria-label="Lịch sử yêu cầu của tôi">
          {requests.length?requests.map(row=><article key={row.id} className={styles.card}>
            <div className={styles.row}><strong>{niceDate(row.workDate)}</strong>
              <span className={styles.badge}>{statusName(row.status)}</span></div>
            <strong className={styles.hours}>{formatVietnamTime(row.startAt)} – {formatVietnamTime(row.endAt)}</strong>
            <p>{row.reason}</p>
            <small>Gửi lúc {new Date(row.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</small>
          </article>):<div className={styles.card}><p>Chưa có yêu cầu tính thêm giờ.</p></div>}
          {nextOffset!==null?<button type="button" className={styles.secondary} disabled={loadingMore}
            onClick={()=>void loadMore()}>{loadingMore?"Đang tải…":"Xem thêm yêu cầu"}</button>:null}
          <button type="button" className={styles.secondary} onClick={()=>setTab("create")}>
            + Tạo yêu cầu mới
          </button>
        </section>}
      <Link href="/earnings" className={styles.back}>← Trở lại Thu nhập</Link>
    </main>
  </TosShell>;
}
