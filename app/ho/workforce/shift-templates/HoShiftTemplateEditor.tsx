"use client";
import {useEffect,useRef,useState} from "react";
import {TosButton,TosCard} from "@pino/design-system/react";
import {AppSheet} from "@/app/components/tos-ds";
import {parseHoShiftTemplates,type HoShiftTemplateRow} from "@/lib/ho-shift-templates-read-facade";

type Mode="create"|"edit"|"status";
type Form={code:string;displayLabel:string;startLocalTime:string;endLocalTime:string};
type Props={mode:Mode;centerId:string;templateId?:string;authorized:boolean;onSaved:()=>void;createOpen?:boolean;onCreateClose?:()=>void};
type View={kind:"loading"}|{kind:"error";message:string}|{kind:"ready";template:HoShiftTemplateRow};
const empty:Form={code:"",displayLabel:"",startLocalTime:"",endLocalTime:""};
const from=(row:HoShiftTemplateRow):Form=>({
  code:row.code,displayLabel:row.displayLabel,startLocalTime:row.startLocalTime,endLocalTime:row.endLocalTime,
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hhmm=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const parsedRows=(value:unknown,centerId:string)=>{
  const rows=parseHoShiftTemplates(value,centerId);
  if(!rows)throw Error("Core trả dữ liệu Mẫu ca không hợp lệ.");
  return rows;
};
export function HoShiftTemplateEditor({mode,centerId,templateId,authorized,onSaved,createOpen,onCreateClose}:Props){
  const [localOpen,setLocalOpen]=useState(false);
  const open=createOpen??localOpen;
  const setOpen=(value:boolean)=>{if(createOpen!==undefined){if(!value)onCreateClose?.();}else setLocalOpen(value);};
  const [view,setView]=useState<View>({kind:"loading"});
  const [form,setForm]=useState<Form>(empty);
  const [targetStatus,setTargetStatus]=useState<"ACTIVE"|"INACTIVE">("ACTIVE");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [reload,setReload]=useState(0);
  const inFlight=useRef(false);
  const active=mode!=="create"||open;
  useEffect(()=>{
    if(!authorized||!active||mode==="create")return;
    const ctrl=new AbortController();
    const url="/api/ho/workforce/shift-templates?centerId="+encodeURIComponent(centerId);
    void fetch(url,{method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:ctrl.signal})
      .then(async result=>{
        if(!result.ok)throw Error(result.status===403?"Không có quyền đọc Mẫu ca.":"Không tải được Mẫu ca từ Core.");
        const rows=parsedRows(await result.json(),centerId);
        const row=rows.find(r=>r.id===templateId);
        if(!row)throw Error("Mẫu ca không còn trong Center này.");
        return row;
      }).then(row=>{
        if(ctrl.signal.aborted)return;
        setView({kind:"ready",template:row});setForm(from(row));setTargetStatus(row.status);
        setUncertain(false);setError("");
      }).catch(err=>{
        if(!ctrl.signal.aborted)setView({kind:"error",message:err instanceof Error?err.message:"Không đọc được Mẫu ca."});
      });
    return ()=>ctrl.abort();
  },[mode,centerId,templateId,authorized,active,reload]);
  const input=(field:keyof Form,value:string)=>setForm(prev=>({...prev,[field]:value}));
  const valid=Boolean(form.code.trim()&&form.displayLabel.trim()&&form.code.length<=64&&form.displayLabel.length<=160&&
    form.code===form.code.trim()&&form.displayLabel===form.displayLabel.trim()&&
    hhmm.test(form.startLocalTime)&&hhmm.test(form.endLocalTime)&&form.endLocalTime>form.startLocalTime&&uuid.test(centerId));
  const dirty=mode==="create" || view.kind!=="ready" ? valid :
    Object.entries(from(view.template)).some(([k,v])=>form[k as keyof Form]!==v);
  async function submit(){
    if(!authorized||busy||uncertain||inFlight.current||!uuid.test(centerId)||mode!=="create"&&view.kind!=="ready")return;
    if(mode!=="status"&&(!valid||!dirty))return;
    if(mode==="status"&&view.kind==="ready"&&targetStatus===view.template.status)return;
    inFlight.current=true;setBusy(true);setError("");setNotice("");
    const current=view.kind==="ready"?view.template:null;
    const payload=mode==="status"
      ? {centerId,status:targetStatus,expectedUpdatedAt:current!.updatedAt}
      : mode==="edit"
        ? {centerId,...form,expectedUpdatedAt:current!.updatedAt}
        : {centerId,...form};
    const url="/api/ho/workforce/shift-templates"+
      (mode==="create"?"":"/"+encodeURIComponent(templateId??"")+"/"+(mode==="edit"?"update":"status"));
    try{
      const response=await fetch(url,{
        method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify(payload),
      });
      if(response.status===409)throw Error("Mẫu ca đã thay đổi hoặc xung đột. Cần tải lại từ Core.");
      if([401,403,404].includes(response.status))throw Error("Không được phép thay đổi Mẫu ca tại Center này.");
      if(response.status!==(mode==="create"?201:200))throw Error("Core chưa xác nhận lưu Mẫu ca.");
      const result:unknown=await response.json();
      const row=parsedRows({data:[(result as {data?:unknown}|null)?.data]},centerId)[0];
      if(!row||(current&&row.id!==current.id)||
        Object.entries(payload).some(([k,v])=>k!=="expectedUpdatedAt"&&(row as unknown as Record<string,unknown>)[k]!==v))
        throw Error("Receipt của Mẫu ca chưa khớp Core.");
      setNotice("Đã lưu và kiểm chứng Mẫu ca trong Core.");
      if(mode==="create"){setOpen(false);setForm(empty);}
      else{setView({kind:"ready",template:row});setForm(from(row));setTargetStatus(row.status);}
      onSaved();
    }catch(err){
      setUncertain(true);
      setError((err instanceof Error?err.message:"Không xác nhận được Mẫu ca.")+
        " Tải lại dữ liệu trước khi gửi lại để tránh lặp mutation.");
    }finally{setBusy(false);inFlight.current=false;}
  }
  const fields=<div className="ho-shift-template-fields">
    {([["displayLabel","Tên mẫu ca","text"],["code","Mã mẫu ca","text"],
      ["startLocalTime","Bắt đầu","time"],["endLocalTime","Kết thúc","time"]] as const).map(([key,label,type])=>
      <div className="property-row" key={key}>
        <label htmlFor={"ho-template-"+mode+"-"+key}>{label}</label>
        <input id={"ho-template-"+mode+"-"+key} type={type} required
          maxLength={key==="displayLabel"?160:key==="code"?64:undefined}
          value={form[key]} disabled={!authorized||busy||uncertain}
          onChange={event=>input(key,event.target.value)}/>
      </div>)}
  </div>;
  const reloadButton=<TosButton type="button" variant="secondary" disabled={busy} onClick={()=>{
    setError("");setUncertain(false);setView({kind:"loading"});setReload(v=>v+1);
  }}>Tải lại từ Core</TosButton>;
  if(!authorized)return <p role="alert">Không có quyền quản lý Mẫu ca.</p>;
  if(mode==="create")return <section aria-label="Tạo mẫu ca" data-ho-shift-template-create>
    {createOpen===undefined?<TosButton type="button" variant="primary" disabled={busy} onClick={()=>{setOpen(true);setError("");setUncertain(false);}}>Tạo mẫu ca</TosButton>:null}
    {notice?<p role="status">{notice}</p>:null}
    {open?<AppSheet title="Tạo mẫu ca" onClose={()=>{if(!busy)setOpen(false);}}>
      <TosCard><form onSubmit={event=>{event.preventDefault();void submit();}}>
        <h3>Tạo mẫu ca</h3>
        <p>Áp dụng cho Center đang chọn. Ca qua đêm chưa được hỗ trợ.</p>
        {fields}
        {error?<p role="alert">{error}</p>:null}
        <div className="staff-actions">
          <TosButton type="button" variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Hủy</TosButton>
          <TosButton type="submit" variant="primary" disabled={!valid||busy||uncertain}>{busy?"Đang lưu…":"Tạo mẫu ca"}</TosButton>
        </div>
      </form></TosCard>
    </AppSheet>:null}
  </section>;
  return <section aria-label={mode==="edit"?"Chỉnh sửa mẫu ca":"Trạng thái mẫu ca"} data-ho-shift-template-editor>
    {view.kind==="loading"?<p role="status">Đang đọc Mẫu ca từ Core…</p>:null}
    {view.kind==="error"?<p role="alert">{view.message}</p>:null}
    {view.kind==="ready"?<TosCard>
      {mode==="edit"?<form onSubmit={event=>{event.preventDefault();void submit();}}>
        {fields}
        {error?<p role="alert">{error}</p>:null}
        {notice?<p role="status">{notice}</p>:null}
        <div className="staff-actions">
          {reloadButton}
          <TosButton type="submit" variant="primary" disabled={!valid||!dirty||busy||uncertain}>
            {busy?"Đang lưu…":"Lưu thay đổi"}</TosButton>
        </div>
      </form>:<div>
        <div className="property-row">
          <label htmlFor="ho-template-status">Trạng thái</label>
          <select id="ho-template-status" value={targetStatus} disabled={busy||uncertain}
            onChange={event=>setTargetStatus(event.target.value as "ACTIVE"|"INACTIVE")}>
            <option value="ACTIVE">Đang sử dụng</option>
            <option value="INACTIVE">Ngưng sử dụng</option>
          </select>
        </div>
        {error?<p role="alert">{error}</p>:null}
        {notice?<p role="status">{notice}</p>:null}
        <div className="staff-actions">
          {reloadButton}
          <TosButton type="button" variant="primary" disabled={busy||uncertain||view.template.status===targetStatus}
            onClick={()=>{void submit();}}>{busy?"Đang lưu…":"Lưu trạng thái"}</TosButton>
        </div>
      </div>}
    </TosCard>:null}
  </section>;
}
