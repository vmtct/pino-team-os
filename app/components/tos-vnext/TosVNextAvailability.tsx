"use client";
import {useEffect,useState} from "react";
import {AppButton,AppSheet} from "../tos-ds";
import {workforceApi,type Availability,type ShiftTemplate,type WorkforceWindowDecision} from "@/lib/workforce-api";
import {shiftWeek} from "@/lib/tos-vnext-shift-view-model";
import styles from "./shift.module.css";

type ReadState={centerId:string;weekStart:string;weekId:string|null;window:WorkforceWindowDecision|null;submission:Availability|null};
type EditState={centerId:string;weekId:string;submission:Availability;templates:ShiftTemplate[];window:WorkforceWindowDecision};
function errorText(cause:unknown){return cause instanceof Error?cause.message:"Không thể tải dữ liệu từ Core."}

/** PAP-1136: staff-own registration, never an assigned shift. All Center and week IDs are Core-authorized. */
export function TosVNextAvailability({centerId,weekStart,weekEnd,selectedDate}:{
 centerId:string;weekStart:string;weekEnd:string;selectedDate:string
}){
 const [read,setRead]=useState<ReadState|null>(null);
 const [readError,setReadError]=useState("");
 const [edit,setEdit]=useState<EditState|null>(null);
 const [editDate,setEditDate]=useState(selectedDate);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState("");
 const [actionNotice,setActionNotice]=useState("");
 const scoped=read?.centerId===centerId&&read.weekStart===weekStart?read:null;
 const editable=Boolean(scoped?.weekId&&scoped.window?.state==="OPEN"&&scoped.window.availabilityRegistrationOpen&&scoped.submission?.status!=="VOIDED");
 const editScope=edit?.centerId===centerId&&edit.weekId===scoped?.weekId?edit:null;
 const dates=shiftWeek(weekStart);
 useEffect(()=>{
  let live=true;
  async function load(){
   try{
    const [context,weeks]=await Promise.all([workforceApi.context(),workforceApi.availabilityWeeks(centerId)]);
    if(!live)return;
    if(!context.data.staffMemberId||!context.data.centers.some(c=>c.id===centerId))throw new Error("Tài khoản chưa được cấp quyền đăng ký tại cơ sở này.");
    const matched=context.data.termWeeks.find(w=>w.startDate===weekStart&&w.endDate===weekEnd&&weeks.data.includes(w.id));
    if(!matched){setRead({centerId,weekStart,weekId:null,window:null,submission:null});return}
    const [window,submission]=await Promise.all([workforceApi.availabilityWindow(centerId,matched.id),workforceApi.availability(centerId,matched.id)]);
    if(live)setRead({centerId,weekStart,weekId:matched.id,window:window.data,submission:submission.data});
   }catch(e){if(live){setRead(null);setReadError(errorText(e))}}
  }
  void load();
  return()=>{live=false};
 },[centerId,weekStart,weekEnd]);
 async function begin(){
  if(!scoped?.weekId||!editable||busy)return;
  setBusy(true);setActionError("");setActionNotice("");
  try{
   const result=await workforceApi.availabilityDraft(centerId,scoped.weekId);
   const {submission,templates,window}=result.data;
   if(submission.centerId!==centerId||submission.termWeekId!==scoped.weekId||submission.status==="VOIDED"||window.state!=="OPEN")throw new Error("Đăng ký không còn khả dụng trong tuần và cơ sở này.");
   setEdit({centerId,weekId:scoped.weekId,submission,templates,window});
   setRead({...scoped,submission,window});setEditDate(selectedDate);setOpen(true);
  }catch(e){setActionError(errorText(e))}
  finally{setBusy(false)}
 }
 async function toggle(templateId:string){
  if(!editScope||!editable||busy||editScope.window.state!=="OPEN"||editScope.submission.status==="VOIDED")return;
  const existing=editScope.submission.items;
  const items=existing.some(x=>x.workDate===editDate&&x.shiftTemplateId===templateId)
   ? existing.filter(x=>!(x.workDate===editDate&&x.shiftTemplateId===templateId))
   : [...existing,{workDate:editDate,shiftTemplateId:templateId}];
  setBusy(true);setActionError("");setActionNotice("");
  try{
   const result=await workforceApi.replaceAvailability({centerId,termWeekId:editScope.weekId,submissionId:editScope.submission.id,expectedVersion:editScope.submission.version,items});
   if(result.data.id!==editScope.submission.id||result.data.centerId!==centerId||result.data.termWeekId!==editScope.weekId)throw new Error("Core trả về đăng ký không khớp ngữ cảnh.");
   setEdit({...editScope,submission:result.data});setRead({...scoped!,submission:result.data});setActionNotice("Đã lưu thay đổi vào Core.");
  }catch(e){setActionError(errorText(e))}
  finally{setBusy(false)}
 }
 async function submit(){
  if(!editScope||!editable||busy||editScope.submission.status==="VOIDED"||!editScope.submission.items.length)return;
  setBusy(true);setActionError("");setActionNotice("");
  try{
   const result=await workforceApi.submitAvailability({centerId,termWeekId:editScope.weekId,submissionId:editScope.submission.id,expectedVersion:editScope.submission.version});
   if(result.data.id!==editScope.submission.id||result.data.status!=="SUBMITTED")throw new Error("Core chưa xác nhận trạng thái SUBMITTED.");
   setEdit({...editScope,submission:result.data});setRead({...scoped!,submission:result.data});setActionNotice("Đã gửi đăng ký cho Manager.");
  }catch(e){setActionError(errorText(e))}
  finally{setBusy(false)}
 }
 const status=scoped?.submission?.status;
 return <>
  {readError&&<p role="alert">{readError}</p>}
  {!scoped&&!readError&&<p role="status">Đang kiểm tra đăng ký ca từ Core…</p>}
  {scoped&&!scoped.weekId&&<p>Tuần này chưa mở đăng ký ca cho nhân sự tại cơ sở.</p>}
  {scoped?.weekId&&<p role="status">Đăng ký tuần: {status==="VOIDED"?"Đã hủy":status==="SUBMITTED"?"Đã gửi cho Manager":status==="DRAFT"?"Bản nháp":"Chưa đăng ký"} · {scoped.window?.state==="OPEN"?"Đang mở":"Đã khóa"}</p>}
  {scoped?.weekId&&!editable&&<p>Đăng ký không thể chỉnh trong trạng thái hiện tại.</p>}
  {scoped?.weekId&&<AppButton disabled={!editable||busy} onClick={()=>void begin()}>{busy?"Đang tải…":status==="SUBMITTED"?"Chỉnh đăng ký ca":"Đăng ký ca"}</AppButton>}
  {actionError&&!open&&<p role="alert">{actionError}</p>}
  {open&&editScope&&<AppSheet title="Đăng ký ca tuần" onClose={()=>{if(!busy){setOpen(false);setActionError("");setActionNotice("")}}}>
    <p>Chọn ngày và ca có thể làm. Đây chưa phải lịch phân công chính thức.</p>
    <p role="status">{editScope.submission.status==="SUBMITTED"?"Đã gửi cho Manager":"Bản nháp"} · {editScope.submission.items.length} lựa chọn</p>
    <div className={styles.weekTrack} role="group" aria-label="Ngày đăng ký ca">
     {dates.map(day=><AppButton key={day.date} variant={editDate===day.date?"primary":"quiet"} aria-pressed={editDate===day.date} disabled={busy} onClick={()=>setEditDate(day.date)}>{day.label} {day.date.slice(-2)}</AppButton>)}
    </div>
    <p>Ca có thể đăng ký ngày {editDate}</p>
    {!editScope.templates.length&&<p>Chưa có Shift Template khả dụng.</p>}
    {editScope.templates.map(t=>{
      const selected=editScope.submission.items.some(x=>x.workDate===editDate&&x.shiftTemplateId===t.id);
      return <AppButton key={t.id} variant={selected?"primary":"secondary"} aria-pressed={selected} disabled={busy||!editable} onClick={()=>void toggle(t.id)}>{selected?"✓ ":""}{t.displayLabel} · {t.startLocalTime}–{t.endLocalTime}</AppButton>;
    })}
    <AppButton disabled={busy||!editable||!editScope.submission.items.length} onClick={()=>void submit()}>{busy?"Đang lưu…":editScope.submission.status==="SUBMITTED"?"Gửi lại cho Manager":"Gửi cho Manager"}</AppButton>
    {actionNotice&&<p role="status">{actionNotice}</p>}
    {actionError&&<p role="alert">{actionError}</p>}
  </AppSheet>}
 </>;
}
