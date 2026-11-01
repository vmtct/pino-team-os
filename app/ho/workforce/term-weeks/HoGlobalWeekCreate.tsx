"use client";
import {useEffect,useRef,useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import {AppSheet} from "@/app/components/tos-ds";
type GlobalTerm={id:string;name:string;startDate:string;endDate:string};
type Catalog={terms:GlobalTerm[]};
type Form={termId:string;code:string;ordinal:string;startDate:string;endDate:string;rhythmKey:string};
const empty:Form={termId:"",code:"",ordinal:"",startDate:"",endDate:"",rhythmKey:""};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parseCatalog(body:unknown):Catalog{
 const data=(body as {data?:unknown}|null)?.data as {terms?:unknown}|undefined;
 if(!data||!Array.isArray(data.terms)||data.terms.some(x=>!x||typeof x!=="object"||
  !uuid.test(String(x.id))||typeof x.name!=="string"||
  typeof x.startDate!=="string"||typeof x.endDate!=="string"))
  throw Error("Danh mục Term toàn cục từ Core không hợp lệ.");
 return {terms:data.terms as GlobalTerm[]};
}
/** PAP-1198: HO Founder-only create action beside the canonical TDD journey, no shadow table. */
export function HoGlobalWeekCreate({authorized,onVerified}:{authorized:boolean;onVerified:()=>void}){
 const [open,setOpen]=useState(false);
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [form,setForm]=useState<Form>(empty);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [needsReadback,setNeedsReadback]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{
  if(!open||!authorized)return;
  const controller=new AbortController();
  void fetch("/api/ho/workforce/global-termweeks?catalog=1",{
   method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal,
  }).then(async r=>{if(!r.ok)throw Error("Không tải được danh mục Global Term.");return parseCatalog(await r.json());})
   .then(value=>{if(!controller.signal.aborted){setCatalog(value);setError("");}})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Danh mục không khả dụng.");});
  return ()=>controller.abort();
 },[open,authorized]);
 const ordinal=Number(form.ordinal);
 const parent=catalog?.terms.find(t=>t.id===form.termId);
 const valid=Boolean(parent&&form.code.trim()&&form.code.length<=96&&
  Number.isSafeInteger(ordinal)&&ordinal>0&&
  /^\d{4}-\d{2}-\d{2}$/.test(form.startDate)&&
  /^\d{4}-\d{2}-\d{2}$/.test(form.endDate)&&
  form.startDate<=form.endDate&&form.startDate>=parent.startDate&&form.endDate<=parent.endDate&&
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(form.rhythmKey));
 const set=(key:keyof Form,value:string)=>setForm(prev=>({...prev,[key]:value}));
 async function create(){
  if(!authorized||!valid||busy||inFlight.current||needsReadback)return;
  inFlight.current=true;setBusy(true);setError("");setNotice("");
  const wanted={termId:form.termId,code:form.code.trim(),ordinal,
   startDate:form.startDate,endDate:form.endDate,rhythmKey:form.rhythmKey};
  try{
   const response=await fetch("/api/ho/workforce/global-termweeks",{
    method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
    headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
    body:JSON.stringify(wanted),
   });
   if(response.status===409)throw Error("TermWeek trùng hoặc thay đổi đồng thời; cần tải lại danh sách.");
   if([401,403,404].includes(response.status))throw Error("Không có quyền quản lý Global TermWeek.");
   if(response.status!==201)throw Error("Core chưa xác nhận tạo TermWeek.");
   const body:unknown=await response.json();
   const row=(body as {data?:unknown}|null)?.data as Record<string,unknown>|undefined;
   if(!row||!uuid.test(String(row.id))||
    Object.entries(wanted).some(([key,value])=>row[key]!==value))
    throw Error("TermWeek đã gửi nhưng receipt chưa khớp Core.");
   setOpen(false);setForm(empty);setCatalog(null);
   setNotice("Đã tạo và xác minh Global TermWeek trong Core.");
   onVerified();
  }catch(e){
   setNeedsReadback(true);
   setError((e instanceof Error?e.message:"Không xác nhận được kết quả.")+
    " Tải lại danh sách trước khi gửi yêu cầu mới để tránh tạo trùng.");
  }finally{setBusy(false);inFlight.current=false;}
 }
 return <section aria-label="Tạo Global TermWeek" data-ho-global-termweek-create>
  <TosCard><div className="ho-walkin-controls-row">
   <div><h3>Global TermWeek</h3><p>Tuần chung toàn hệ thống; mỗi Center lập Shift Plan độc lập.</p></div>
   <TosButton type="button" variant="primary" disabled={!authorized||needsReadback}
    onClick={()=>{setCatalog(null);setError("");setOpen(true);}}>Tạo tuần</TosButton>
  </div></TosCard>
  {!authorized?<p role="note">Chỉ tài khoản có quyền quản lý Global TermWeek mới tạo được tuần.</p>:null}
  {notice?<p role="status">{notice}</p>:null}
  {needsReadback?<p role="alert">{error} <button type="button" onClick={()=>location.reload()}>Tải lại danh sách</button></p>:null}
  {open?<AppSheet title="Tạo Global TermWeek" onClose={()=>{if(!busy)setOpen(false);}}>
   <TosCard><form onSubmit={event=>{event.preventDefault();void create();}}>
    <h3>Tuần mới</h3>
    {!catalog?<p role="status">Đang tải danh mục Global Term…</p>:null}
    {catalog&&catalog.terms.length===0?<p role="alert">Chưa có Global Term. Tạo Term ở Operating Cycle trước.</p>:null}
    <div className="property-row"><label htmlFor="ho-week-term">Global Term</label>
     <select id="ho-week-term" required value={form.termId} disabled={busy||!catalog}
      onChange={e=>set("termId",e.target.value)}>
      <option value="">Chọn Global Term</option>
      {catalog?.terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select>
    </div>
    <div className="property-row"><label htmlFor="ho-week-code">Mã tuần</label>
     <input id="ho-week-code" required maxLength={96} value={form.code}
      disabled={busy} onChange={e=>set("code",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-ordinal">Thứ tự</label>
     <input id="ho-week-ordinal" type="number" min="1" step="1" required value={form.ordinal}
      disabled={busy} onChange={e=>set("ordinal",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-start">Bắt đầu</label>
     <input id="ho-week-start" type="date" required value={form.startDate} disabled={busy}
      min={parent?.startDate} max={parent?.endDate} onChange={e=>set("startDate",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-end">Kết thúc</label>
     <input id="ho-week-end" type="date" required value={form.endDate} disabled={busy}
      min={parent?.startDate} max={parent?.endDate} onChange={e=>set("endDate",e.target.value)}/></div>
    <div className="property-row"><label htmlFor="ho-week-rhythm">Nhịp</label>
     <input id="ho-week-rhythm" required placeholder="BUILD" value={form.rhythmKey}
      disabled={busy} maxLength={96} onChange={e=>set("rhythmKey",e.target.value.toUpperCase())}/></div>
    {error?<p role="alert">{error}</p>:null}
    <div className="staff-actions">
     <TosButton type="button" variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Hủy</TosButton>
     <TosButton type="submit" variant="primary" disabled={!valid||busy||needsReadback}>
      {busy?"Đang tạo…":"Tạo và kiểm chứng"}</TosButton>
    </div>
   </form></TosCard>
  </AppSheet>:null}
 </section>;
}
