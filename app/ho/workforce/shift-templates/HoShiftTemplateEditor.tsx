"use client";
import {useEffect,useId,useRef,useState} from "react";
import {TosButton,TosCard,DrawerFrame} from "@pino/design-system/react";
import {parseHoShiftTemplates,type HoShiftTemplateRow} from "@/lib/ho-shift-templates-read-facade";
import {HoCreateRecovery,createRecoveryMessage,type CreatePayload} from "@/lib/ho-shift-template-create-recovery";

type Mode="create"|"edit"|"status";
type Form={code:string;displayLabel:string;startLocalTime:string;endLocalTime:string};
type Props={mode:Mode;centerId:string;centers?:readonly {id:string;name:string}[];templateId?:string;authorized:boolean;onSaved:()=>void;createOpen?:boolean;onCreateClose?:()=>void};
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
export function HoShiftTemplateEditor({mode,centerId,templateId,authorized,onSaved,createOpen,onCreateClose,centers=[]}:Props){
  const formId=useId();

  const [createScope,setCreateScope]=useState(centerId==="ALL"?"GLOBAL":centerId);
  const selectedScope=mode==="create"?createScope:centerId;
  const scope={scopeType:selectedScope==="GLOBAL"?"GLOBAL" as const:"CENTER" as const,centerId:selectedScope==="GLOBAL"?null:selectedScope};
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
  const [createRecovery,setCreateRecovery]=useState(()=>new HoCreateRecovery());
  const [reload,setReload]=useState(0);
  const inFlight=useRef(false);
  const createForm=useRef<HTMLFormElement>(null);
  const createLocked=mode==="create"&&createRecovery.locked;
  const blocked=uncertain||createLocked;
  const active=mode!=="create"||open;
  // Follow the current list Center for a new draft, never rewrite an unresolved Core attempt.
  useEffect(()=>{
    if(mode==="create"&&!createRecovery.locked)
      setCreateScope(centerId==="ALL"?"GLOBAL":centerId);
  },[mode,centerId,createRecovery]);
  useEffect(()=>{
    if(mode==="create"&&open&&!busy&&createRecovery.locked)
      createForm.current?.querySelector<HTMLButtonElement>("[data-create-recovery]")?.focus();
  },[mode,open,busy,createRecovery]);
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
    hhmm.test(form.startLocalTime)&&hhmm.test(form.endLocalTime)&&form.endLocalTime>form.startLocalTime&&(selectedScope==="GLOBAL"||uuid.test(selectedScope)));
  const dirty=mode==="create" || view.kind!=="ready" ? valid :
    Object.entries(from(view.template)).some(([k,v])=>form[k as keyof Form]!==v);
  function finishCreate(){
    if(createRecovery.state!=="committed")return;
    setNotice("Đã đọc và kiểm chứng Mẫu ca trong Core.");
    setOpen(false);setForm(empty);setTargetStatus("ACTIVE");setError("");
    setCreateRecovery(new HoCreateRecovery());onSaved();
  }
  async function recoverCreate(){
    if(!authorized||busy||inFlight.current)return;
    inFlight.current=true;setBusy(true);
    try{
      await createRecovery.reconcile();
      setError(createRecoveryMessage(createRecovery));finishCreate();
    }finally{setBusy(false);inFlight.current=false;}
  }
  async function submit(){
    if(!authorized||busy||uncertain||inFlight.current||!(selectedScope==="GLOBAL"||uuid.test(selectedScope))||mode!=="create"&&view.kind!=="ready")return;
    if(mode==="create"&&!createRecovery.canSubmit)return;
    if(mode!=="status"&&(!valid||!dirty))return;
    if(mode==="status"&&view.kind==="ready"&&targetStatus===view.template.status)return;
    inFlight.current=true;setBusy(true);setError("");setNotice("");
    if(mode==="create"){
      try{
        await createRecovery.submit({...scope,...form,status:targetStatus} satisfies CreatePayload);
        setError(createRecoveryMessage(createRecovery));finishCreate();
      }finally{setBusy(false);inFlight.current=false;}
      return;
    }
    const current=view.kind==="ready"?view.template:null;
    const payload=mode==="status"
      ? {...scope,status:targetStatus,expectedUpdatedAt:current!.updatedAt}
      : {...scope,...form,expectedUpdatedAt:current!.updatedAt};
    const url="/api/ho/workforce/shift-templates"+
      "/"+encodeURIComponent(templateId??"")+"/"+(mode==="edit"?"update":"status");
    try{
      const response=await fetch(url,{
        method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify(payload),
      });
      if(response.status===409)throw Error("Mẫu ca đã thay đổi hoặc xung đột. Cần tải lại từ Core.");
      if([401,403,404].includes(response.status))throw Error("Không được phép thay đổi Mẫu ca tại Center này.");
      if(response.status!==200)throw Error("Core chưa xác nhận lưu Mẫu ca.");
      const result:unknown=await response.json();
      const row=parsedRows({data:[(result as {data?:unknown}|null)?.data]},selectedScope)[0];
      if(!row||(current&&row.id!==current.id)||
        Object.entries(payload).some(([k,v])=>k!=="expectedUpdatedAt"&&(row as unknown as Record<string,unknown>)[k]!==v))
        throw Error("Receipt của Mẫu ca chưa khớp Core.");
      setNotice("Đã lưu và kiểm chứng Mẫu ca trong Core.");
      setView({kind:"ready",template:{...current,...row}});setForm(from(row));setTargetStatus(row.status);
      onSaved();
    }catch(err){
      setUncertain(true);
      setError((err instanceof Error?err.message:"Không xác nhận được Mẫu ca.")+
        " Tải lại dữ liệu trước khi gửi lại để tránh lặp mutation.");
    }finally{setBusy(false);inFlight.current=false;}
  }
  const fields=<div>
    <div className="property-row"><label htmlFor="ho-template-scope">Phạm vi / Center</label><select id="ho-template-scope" value={selectedScope} disabled={mode!=="create"||busy||blocked} onChange={event=>setCreateScope(event.target.value)}><option value="GLOBAL">GLOBAL — mọi Center</option>{centers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    {([["displayLabel","Tên mẫu ca","text"],["code","Mã mẫu ca","text"],
      ["startLocalTime","Bắt đầu","time"],["endLocalTime","Kết thúc","time"]] as const).map(([key,label,type])=>
      <div className="property-row" key={key}>
        <label htmlFor={"ho-template-"+mode+"-"+key}>{label}</label>
        <input id={"ho-template-"+mode+"-"+key} type={type} required
          maxLength={key==="displayLabel"?160:key==="code"?64:undefined}
          value={form[key]} disabled={!authorized||busy||blocked||((key==="startLocalTime"||key==="endLocalTime")&&view.kind==="ready"&&((view.template.assignmentCount??0)>0||(view.template.availabilityCount??0)>0))}
          onChange={event=>input(key,event.target.value)}/>
      </div>)}
  </div>;
  const reloadButton=<TosButton type="button" variant="secondary" disabled={busy} onClick={()=>{
    setError("");setUncertain(false);setView({kind:"loading"});setReload(v=>v+1);
  }}>Tải lại từ Core</TosButton>;
  if(!authorized)return mode==="create"&&!open?null:<p role="alert">Không có quyền quản lý Mẫu ca.</p>;
  if(mode==="create")return <section aria-label="Tạo mẫu ca" data-ho-shift-template-create>
    {createOpen===undefined?<TosButton type="button" variant="primary" disabled={busy} onClick={()=>setOpen(true)}>Tạo mẫu ca</TosButton>:null}
    {notice?<p role="status">{notice}</p>:null}
    {open?<DrawerFrame surface="ho" title="Tạo mẫu ca" onClose={()=>{if(!busy)setOpen(false);}} footer={<>
      <TosButton type="button" variant="secondary" disabled={busy} onClick={()=>setOpen(false)}>Hủy</TosButton>
      <TosButton type="submit" form={formId} variant="primary" aria-busy={busy} disabled={!valid||busy||!createRecovery.canSubmit}>{busy?"Đang xử lý…":createRecovery.state==="absent"?"Thử lại cùng yêu cầu":"Tạo"}</TosButton>
    </>}>
      <form ref={createForm} id={formId} aria-busy={busy} onSubmit={event=>{event.preventDefault();void submit();}}>

        {fields}
        <div className="property-row"><label htmlFor="ho-create-template-status">Trạng thái</label><select id="ho-create-template-status" value={targetStatus} disabled={busy||createLocked} onChange={event=>setTargetStatus(event.target.value as "ACTIVE"|"INACTIVE")}><option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Ngưng sử dụng</option></select></div>
        {error?<p role="alert">{error}</p>:null}
        {createRecovery.diagnostic?<p role="status">{createRecovery.diagnostic}{createRecovery.key?" · Mã yêu cầu: "+createRecovery.key:""}</p>:null}
        {createLocked?<TosButton data-create-recovery type="button" variant="secondary" disabled={busy} aria-busy={busy} onClick={()=>{void recoverCreate();}}>Kiểm tra từ Core</TosButton>:null}
      </form>
    </DrawerFrame>:null}
  </section>;
  return <section aria-label={mode==="edit"?"Chỉnh sửa mẫu ca":"Trạng thái mẫu ca"} data-ho-shift-template-editor>
    {view.kind==="loading"?<p role="status">Đang đọc Mẫu ca từ Core…</p>:null}
    {view.kind==="error"?<p role="alert">{view.message}</p>:null}
    {view.kind==="ready"?<TosCard>
       {mode==="edit"?<form id={formId} aria-label="Chỉnh sửa mẫu ca" onSubmit={event=>{event.preventDefault();void submit();}}>
         {fields}
         {error?<p role="alert">{error}</p>:null}
         {notice?<p role="status">{notice}</p>:null}
         <div className="staff-actions">
           {reloadButton}
           <TosButton type="submit" variant="primary" disabled={!valid||!dirty||busy||uncertain}>
             {busy?"Đang lưu…":"Lưu thay đổi"}
           </TosButton>
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