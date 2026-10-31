"use client";
import {useEffect,useRef,useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import type {HoTermWeekRow} from "@/lib/ho-global-termweeks-read-facade";

type Form={code:string;ordinal:string;startDate:string;endDate:string;rhythmKey:string};
type State={kind:"loading"}|{kind:"error";message:string}|{kind:"ready";week:HoTermWeekRow};
const from=(w:HoTermWeekRow):Form=>({code:w.code,ordinal:String(w.ordinal),
 startDate:w.startDate,endDate:w.endDate,rhythmKey:w.rhythmKey});
function validateRow(body:unknown,id:string):HoTermWeekRow{
 const rows=(body as {data?:unknown}|null)?.data;
 if(!Array.isArray(rows))throw Error("Dữ liệu Global TermWeek không hợp lệ.");
 const row:unknown=rows.find(x=>x&&typeof x==="object"&&x.id===id);
 if(!row||typeof row!=="object")throw Error("Global TermWeek không còn khả dụng.");
 const w=row as HoTermWeekRow;
 if(typeof w.updatedAt!=="string"||typeof w.code!=="string"||
  !Number.isSafeInteger(w.ordinal)||typeof w.startDate!=="string"||
  typeof w.endDate!=="string"||typeof w.rhythmKey!=="string")
  throw Error("Thông tin tuần từ Core không hợp lệ.");
 return w;
}
/** PAP-1198 metadata editor inside TDD approved business tab, never a second Detail shell. */
export function HoGlobalWeekUpdateEditor({termWeekId,authorized,onSaved}:{
 termWeekId:string;authorized:boolean;onSaved:()=>void;
}){
 const [state,setState]=useState<State>({kind:"loading"});
 const [form,setForm]=useState<Form|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [requiresReload,setRequiresReload]=useState(false);
 const [retry,setRetry]=useState(0);
 const inFlight=useRef(false);
 useEffect(()=>{
  if(!authorized)return;
  const controller=new AbortController();

  void fetch("/api/ho/workforce/global-termweeks",{
   method:"GET",credentials:"same-origin",cache:"no-store",
   redirect:"error",signal:controller.signal,
  }).then(async res=>{
   if(!res.ok)throw Error(res.status===403?"Không có quyền đọc Global TermWeek.":"Không tải được tuần từ Core.");
   return validateRow(await res.json(),termWeekId);
  }).then(week=>{if(!controller.signal.aborted){setState({kind:"ready",week});setForm(from(week));}})
   .catch(e=>{if(!controller.signal.aborted)setState({
    kind:"error",message:e instanceof Error?e.message:"Không tải được tuần.",
   });});
  return()=>controller.abort();
 },[termWeekId,authorized,retry]);
 const set=(key:keyof Form,value:string)=>setForm(v=>v?{...v,[key]:value}:v);
 const ordinal=Number(form?.ordinal);
 const valid=Boolean(form&&form.code.trim()&&form.code.trim().length<=96&&
  Number.isSafeInteger(ordinal)&&ordinal>0&&
  /^\d{4}-\d{2}-\d{2}$/.test(form.startDate)&&
  /^\d{4}-\d{2}-\d{2}$/.test(form.endDate)&&
  form.startDate<=form.endDate&&/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(form.rhythmKey));
 const dirty=Boolean(form&&state.kind==="ready"&&
  Object.entries(from(state.week)).some(([key,value])=>form[key as keyof Form]!==value));
 async function save(){
  if(!authorized||!valid||!dirty||state.kind!=="ready"||!form||
   busy||inFlight.current||requiresReload)return;
  inFlight.current=true;setBusy(true);setError("");setNotice("");
  const wanted={code:form.code.trim(),ordinal,startDate:form.startDate,
   endDate:form.endDate,rhythmKey:form.rhythmKey,expectedUpdatedAt:state.week.updatedAt};
  try{
   const res=await fetch("/api/ho/workforce/global-termweeks/"+encodeURIComponent(termWeekId)+"/update",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
    body:JSON.stringify(wanted),
   });
   if(res.status===409)throw Error("Tuần đã thay đổi hoặc đụng dữ liệu lịch sử. Tải lại để kiểm tra.");
   if([401,403,404].includes(res.status))throw Error("Không có quyền sửa Global TermWeek.");
   if(!res.ok)throw Error("Core chưa xác nhận cập nhật tuần.");
   const data:unknown=await res.json();
   const updated=(data as {data?:unknown}|null)?.data as HoTermWeekRow|undefined;
   if(!updated||updated.id!==termWeekId||
    updated.updatedAt===wanted.expectedUpdatedAt||
    updated.code!==wanted.code||updated.ordinal!==wanted.ordinal||
    updated.startDate!==wanted.startDate||updated.endDate!==wanted.endDate||
    updated.rhythmKey!==wanted.rhythmKey)
    throw Error("Core chưa xác nhận đúng thông tin tuần.");
   setState({kind:"ready",week:updated});setForm(from(updated));
   setNotice("Đã lưu và đối chiếu dữ liệu Global TermWeek trên Core.");onSaved();
  }catch(e){
   setRequiresReload(true);
   setError((e instanceof Error?e.message:"Chưa xác minh kết quả.")+
    " Cần tải lại trước khi gửi lại để tránh ghi trùng.");
  }finally{setBusy(false);inFlight.current=false;}
 }
 return <section aria-label="Chỉnh sửa Global TermWeek" data-ho-global-week-update>
  <h3>Chỉnh sửa tuần</h3>
  {!authorized?<p role="alert">Không có quyền quản lý Global TermWeek.</p>:
   state.kind==="loading"?<p role="status">Đang tải thông tin Core…</p>:
   state.kind==="error"?<p role="alert">{state.message}
    <button type="button" onClick={()=>{setState({kind:"loading"});setRetry(x=>x+1);}}>Thử lại</button></p>:
   form?<TosCard><form onSubmit={e=>{e.preventDefault();void save();}}>
    <p role="note">Term và ID của tuần không thể chuyển. Các thay đổi có lịch sử phân công sẽ bị Core kiểm tra.</p>
    <div className="property-row"><label htmlFor="ho-week-edit-code">Mã tuần</label>
     <input id="ho-week-edit-code" required maxLength={96} value={form.code} disabled={busy||requiresReload}
      onChange={e=>set("code",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-edit-ordinal">Thứ tự</label>
     <input id="ho-week-edit-ordinal" type="number" min="1" step="1" required
      value={form.ordinal} disabled={busy||requiresReload} onChange={e=>set("ordinal",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-edit-start">Bắt đầu</label>
     <input id="ho-week-edit-start" type="date" value={form.startDate} required
      disabled={busy||requiresReload} onChange={e=>set("startDate",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-edit-end">Kết thúc</label>
     <input id="ho-week-edit-end" type="date" value={form.endDate} required
      disabled={busy||requiresReload} onChange={e=>set("endDate",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-edit-rhythm">Nhịp</label>
     <input id="ho-week-edit-rhythm" required maxLength={96} value={form.rhythmKey}
      disabled={busy||requiresReload} onChange={e=>set("rhythmKey",e.target.value.toUpperCase())}/></div>
    {notice?<p role="status">{notice}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    <div className="staff-actions">
     <TosButton type="button" variant="secondary" disabled={busy}
      onClick={()=>{if(state.kind==="ready"){setForm(from(state.week));setError("");}}}>Hủy thay đổi</TosButton>
     <TosButton type="submit" variant="primary" disabled={!dirty||!valid||busy||requiresReload}>
      {busy?"Đang lưu…":"Lưu tuần"}</TosButton>
     {requiresReload?<button type="button" onClick={()=>location.reload()}>Tải lại tuần</button>:null}
    </div>
   </form></TosCard>:null}
 </section>;
}
