"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {boApi} from "@/lib/bo-api";
import {reviewApi,ReviewApiError,decisionPayload,localClock,reviewedAmount,
  type ReviewedException,type ReviewStatus} from "@/lib/bo-payroll-extra-review-api";
import styles from "./payroll-extra-review.module.css";

type Center={id:string;displayName:string;status:string};
type Mode="FULL"|"PARTIAL"|"REJECTED";
const dateLocal=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",
  month:"2-digit",day:"2-digit"}).format(new Date());
const startFrom=(date:string)=>new Date(Date.parse(date+"T00:00:00Z")-30*86400000).toISOString().slice(0,10);
const label=(status:ReviewStatus)=>({
  PENDING:"Chờ duyệt",WITHDRAWN:"Đã rút",APPROVED:"Đã duyệt",REJECTED:"Từ chối",
})[status];
const errorText=(x:unknown)=>{
  if(x instanceof ReviewApiError){
    if(x.status===403)return "Tài khoản không có quyền xem/duyệt ngoại lệ lương tại cơ sở này.";
    if(x.status===409)return "Dữ liệu đã thay đổi hoặc khoản lương đã chốt. Hãy tải lại trước khi duyệt.";
    if(x.status===401)return "Phiên BO hết hạn. Đăng nhập lại.";
    return x.message;
  }
  return x instanceof Error?x.message:"Không thể tải dữ liệu Core.";
};
const key=()=>{
  if(typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function")
    return "pay-review-"+crypto.randomUUID();
  return "pay-review-"+Date.now().toString(36)+"-"+Math.floor(Math.random()*1e9).toString(36);
};
export default function PayrollExtraReviewView(){
  const [centers,setCenters]=useState<Center[]>([]),[centerId,setCenterId]=useState("");
  const [staffNames,setStaffNames]=useState<Record<string,string>>({});
  const [fromDate,setFromDate]=useState(()=>startFrom(dateLocal())),[toDate,setToDate]=useState(dateLocal);
  const [status,setStatus]=useState<ReviewStatus|"ALL">("PENDING");
  const [rows,setRows]=useState<ReviewedException[]>([]),[total,setTotal]=useState(0);
  const [offset,setOffset]=useState<number|null>(null),[selected,setSelected]=useState<ReviewedException|null>(null);
  const [mode,setMode]=useState<Mode>("FULL"),[from,setFrom]=useState(""),[to,setTo]=useState("");
  const [reason,setReason]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[revision,setRevision]=useState(0);
  const pending=useRef<{signature:string;key:string}|null>(null);
  useEffect(()=>{
    let live=true;
    void boApi.centers().then(items=>{
      if(!live)return;
      const active=items.filter(x=>x.status==="active");
      setCenters(active);setCenterId(active[0]?.id??"");
      if(!active.length){setError("Chưa có Center được cấp quyền.");setLoading(false);}
    }).catch((e:unknown)=>{if(live){setError(errorText(e));setLoading(false);}});
    void boApi.staffRecords().then(items=>{
      if(live)setStaffNames(Object.fromEntries(items.map(item=>[item.id,item.displayLabel])));
    }).catch(()=>{/* Staff directory permission is optional; review remains Core-gated. */});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!centerId)return;
    let live=true;setLoading(true);setError("");
    void reviewApi.list({centerId,startDate:fromDate,endDate:toDate,
      ...(status==="ALL"?{}:{status}),limit:50,offset:0})
      .then(result=>{
        if(!live)return;
        setRows(result.data.data);setTotal(result.data.total);setOffset(result.data.nextOffset);
        setSelected(current=>current?result.data.data.find(row=>row.id===current.id)??null:null);
      }).catch((e:unknown)=>{
        if(!live)return;setRows([]);setTotal(0);setOffset(null);setError(errorText(e));
      }).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[centerId,fromDate,toDate,status,revision]);
  function open(row:ReviewedException){
    setSelected(row);setMode("FULL");setFrom(localClock(row.requestedStartAt));
    setTo(localClock(row.requestedEndAt));setReason("");setError("");setNotice("");pending.current=null;
  }
  async function decide(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(saving||!selected||selected.status!=="PENDING")return;
    try{
      const body=decisionPayload(selected,mode,from,to,reason),signature=JSON.stringify(body);
      const idempotency=pending.current?.signature===signature?pending.current.key:key();
      pending.current={signature,key:idempotency};setSaving(true);setError("");setNotice("");
      const result=await reviewApi.decide(body,idempotency);
      setSelected(result.data);setRows(current=>current.map(x=>x.id===result.data.id?result.data:x));
      setNotice(result.data.status==="APPROVED"?"Core đã ghi quyết định duyệt.":"Core đã ghi quyết định từ chối.");
      pending.current=null;
      // An approved/rejected request leaves the PENDING filter. Show the exact terminal receipt.
      setStatus("ALL");setRevision(x=>x+1);
    }catch(e){setError(errorText(e));}finally{setSaving(false);}
  }
  async function more(){
    if(offset===null||loading)return;
    setLoading(true);
    try{
      const response=await reviewApi.list({centerId,startDate:fromDate,endDate:toDate,
        ...(status==="ALL"?{}:{status}),limit:50,offset});
      setRows(current=>[...current,...response.data.data]);
      setTotal(response.data.total);setOffset(response.data.nextOffset);
    }catch(e){setError(errorText(e));}finally{setLoading(false);}
  }
  return <main className={styles.page}>
    <header className={styles.heading}><small>Back Office · Workforce · Payroll</small>
      <h1>Duyệt tính thêm giờ</h1>
      <p>Chỉ khoản được duyệt mới có thể cộng vào lương. Không được ghi đè chấm công hoặc sửa lương đã chốt.</p>
    </header>
    <section className={styles.filters} aria-label="Bộ lọc">
      <label>Cơ sở<select value={centerId} onChange={e=>setCenterId(e.target.value)}>
        {centers.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}
      </select></label>
      <label>Từ ngày<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label>
      <label>Đến ngày<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
      <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value as ReviewStatus|"ALL")}>
        <option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option>
        <option value="REJECTED">Từ chối</option><option value="WITHDRAWN">Đã rút</option>
        <option value="ALL">Tất cả</option></select></label>
      <button type="button" className={styles.secondary} onClick={()=>setRevision(x=>x+1)}>Làm mới</button>
    </section>
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    {notice?<p role="status" className={styles.success}>{notice}</p>:null}
    <div className={styles.columns}>
      <section className={styles.list} aria-label="Danh sách yêu cầu">
        <h2>Danh sách ({total})</h2>
        {loading&&!rows.length?<p>Đang tải dữ liệu Core…</p>:null}
        {!loading&&!rows.length?<p>Không có yêu cầu phù hợp.</p>:null}
        {rows.map(row=><button key={row.id} type="button"
          className={styles.row+(selected?.id===row.id?" "+styles.selected:"")}
          aria-pressed={selected?.id===row.id} onClick={()=>open(row)}>
          <span><strong>{row.workDate}</strong><small>{staffNames[row.staffMemberId]??row.staffMemberId.slice(0,12)+"…"}</small></span>
          <span>{localClock(row.requestedStartAt)} – {localClock(row.requestedEndAt)}</span>
          <em>{label(row.status)}</em>
        </button>)}
        {offset!==null?<button className={styles.secondary} type="button" disabled={loading}
          onClick={()=>void more()}>Tải thêm</button>:null}
      </section>
      <aside className={styles.detail} aria-label="Chi tiết ngoại lệ">
        {!selected?<p>Chọn một yêu cầu để xem chi tiết và quyết định.</p>:<>
          <div className={styles.detailHead}><h2>{selected.workDate}</h2><span>{label(selected.status)}</span></div>
          <dl className={styles.facts}>
            <div><dt>Nhân viên</dt><dd>{staffNames[selected.staffMemberId]??"Nhân viên"} · {selected.staffMemberId}</dd></div>
            <div><dt>Phân ca</dt><dd>{selected.assignmentId}</dd></div>
            <div><dt>Giờ yêu cầu</dt><dd>{localClock(selected.requestedStartAt)} – {localClock(selected.requestedEndAt)}</dd></div>
            <div><dt>Lý do nhân viên</dt><dd>{selected.requestReason}</dd></div>
          </dl>
          {selected.decision?<section className={styles.complete}>
            <h3>Quyết định đã ghi</h3>
            <p>{label(selected.status)} · {selected.decision.reason}</p>
            {selected.decision.type==="APPROVED"?<>
              <p>{localClock(selected.decision.startAt)} – {localClock(selected.decision.endAt)}
                {" · "}{selected.decision.minutes} phút</p>
              <strong>{reviewedAmount(selected.decision.amountMinor)}</strong>
            </>:null}
            <small>Reviewer: {selected.decision.reviewerId}</small>
            <small>Thời điểm: {selected.decision.reviewedAt}</small>
            <p>Quyết định này bất biến, không thể duyệt lại.</p>
          </section>:selected.status==="WITHDRAWN"
            ?<p>Nhân viên đã rút yêu cầu, không được duyệt.</p>:
            <form className={styles.form} onSubmit={event=>void decide(event)}>
              <fieldset disabled={saving}><legend>Quyết định</legend>
                {([["FULL","Duyệt toàn bộ"],["PARTIAL","Duyệt một phần"],["REJECTED","Từ chối"]] as const)
                  .map(([value,caption])=><label key={value}>
                    <input type="radio" checked={mode===value} onChange={()=>{setMode(value);pending.current=null;}}/>
                    {caption}</label>)}
              </fieldset>
              {mode==="PARTIAL"?<div className={styles.times}>
                <label>Giờ bắt đầu<input type="time" required value={from} onChange={e=>setFrom(e.target.value)}/></label>
                <label>Giờ kết thúc<input type="time" required value={to} onChange={e=>setTo(e.target.value)}/></label>
              </div>:null}
              <label>Lý do quyết định<textarea value={reason} rows={4} required minLength={10} maxLength={1000}
                onChange={e=>setReason(e.target.value)} placeholder="Căn cứ duyệt hoặc từ chối…"/></label>
              <p>Core kiểm tra giờ chuẩn, trùng khoảng, khóa lương và mức lương hiệu lực; giao diện không tự tính tiền.</p>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving?"Đang xử lý…":mode==="REJECTED"?"Xác nhận từ chối":"Xác nhận duyệt"}
              </button>
            </form>}
        </>}
      </aside>
    </div>
  </main>;
}
