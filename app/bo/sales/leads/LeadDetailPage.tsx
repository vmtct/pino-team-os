"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./lead-household.module.css";
import { InlineProperty, type InlineKey } from "./InlineProperty";

type Member = { id: string; name: string; role: string; roles?: string[]; age: string; program?: string; path?: string };
type Lead = { id: string; name: string; phone: string; program: string; path: string; members: Member[]; createdAt: string; updatedAt: string; source: string; status: string; relationships?: {id:string;from:string;to:string;label:string;status:"CONFIRMED"|"DECLARED"}[] };
const example: Lead = { id: "lead-001", name: "Nguyễn Thị Minh Anh", phone: "090 123 4567", program: "Afterschool", path: "Hội họa", members: [{id:"m1",name:"Nguyễn Thị Minh Anh",role:"Parent",age:""},{id:"m2",name:"Nguyễn Gia Hân",role:"Student",age:"8"}], createdAt:"22/11/2026 · 09:30",updatedAt:"23/11/2026 · 08:45",source:"Website",status:"ACTIVE" };
const tabs = ["Tổng quan","Thành viên","Quan hệ khai báo","Lịch sử"] as const;
type Tab = typeof tabs[number];
function Property({label,value}:{label:string;value:string}) {return <div className={styles.field}><span>{label}</span><strong>{value||"—"}</strong></div>;}
export function LeadDetailPage({leadId, preview = false}:{leadId:string;preview?:boolean}) {
  const [lead,setLead]=useState<Lead|null>(leadId==="lead-001"?example:null);
  const [tab,setTab]=useState<Tab>("Tổng quan");
  const [feedback,setFeedback]=useState("");
  const [convertOpen,setConvertOpen]=useState(false);
  const convertTrigger=useRef<HTMLButtonElement>(null);
  const [convertTargets,setConvertTargets]=useState<Record<string,boolean>>({});
  const [convertError,setConvertError]=useState("");
  const [personModes,setPersonModes]=useState<Record<string,string>>({});
  const [personIds,setPersonIds]=useState<Record<string,string>>({});
  const [canonicalNames,setCanonicalNames]=useState<Record<string,string>>({});
  const [actorSelections,setActorSelections]=useState<Record<string,boolean>>({});
  const [guardianSelections,setGuardianSelections]=useState<Record<string,boolean>>({});
  const [contactMode,setContactMode]=useState("NEW");
  const [contactPersonId,setContactPersonId]=useState("");
  const [contactCanonical,setContactCanonical]=useState("");
  const [contactActors,setContactActors]=useState<Record<string,boolean>>({Parent:true,Student:false,Guest:false});
  const saveField=(key:InlineKey,value:string):string|null=>{
    if(!lead)return "Không tìm thấy Lead.";
    if(key==="name"&&!value)return "Vui lòng nhập họ tên.";
    const normalized=key==="phone"?value.replace(/\D/g,""):value;
    if(key==="phone"&&!/^0\d{9}$/.test(normalized))return "Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.";
    try{
      const stored=JSON.parse(sessionStorage.getItem("pino-leads-m1")||"[]") as Lead[];
      if(key==="phone"&&stored.some(x=>x.id!==lead.id&&x.phone.replace(/\D/g,"")===normalized))return "Số điện thoại đã thuộc Lead khác.";
      const updated={...lead,[key]:normalized,updatedAt:new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date())};
      sessionStorage.setItem("pino-leads-m1",JSON.stringify(stored.some(x=>x.id===lead.id)?stored.map(x=>x.id===lead.id?updated:x):[updated,...stored]));
      setLead(updated);setFeedback("Đã lưu "+({name:"họ tên",phone:"số điện thoại",program:"chương trình",path:"chuyên môn"}[key])+".");return null;
    }catch{return "Không lưu được bản nháp local.";}
  };
  const saveMemberField=(memberId:string,field:"name"|"role"|"age"|"program"|"path",value:string):string|null=>{
    if(!lead)return "Không tìm thấy Lead.";
    if(field==="name"&&!value.trim())return "Vui lòng nhập họ tên thành viên.";
    if(field==="age"&&value.trim()&&(!/^\d{1,3}$/.test(value)||Number(value)>120))return "Tuổi phải từ 0 đến 120.";
    if(field==="program"&&!["Afterschool","MyTime"].includes(value))return "Chương trình không hợp lệ.";
    if(field==="path"&&!["Hội họa","Piano"].includes(value))return "Chuyên môn không hợp lệ.";
    if(field==="role"&&!["Student","Guest"].includes(value))return "Vai trò không hợp lệ.";
    const updated={...lead,members:lead.members.map(m=>m.id===memberId?{...m,[field]:value.trim()}:m),updatedAt:new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date())};
    try{const stored=JSON.parse(sessionStorage.getItem("pino-leads-m1")||"[]") as Lead[];
      sessionStorage.setItem("pino-leads-m1",JSON.stringify(stored.some(x=>x.id===lead.id)?stored.map(x=>x.id===lead.id?updated:x):[updated,...stored]));
    }catch{return "Không lưu được bản nháp local.";}
    setLead(updated);setFeedback("Đã cập nhật thành viên.");return null;
  };
  useEffect(()=>{
    try {const saved=JSON.parse(sessionStorage.getItem("pino-leads-m1")||"[]") as Lead[];setLead(saved.find(x=>x.id===leadId) || (leadId==="lead-001"?example:null));}catch{setLead(leadId==="lead-001"?example:null);}
  },[leadId]);
  useEffect(()=>{if(!convertOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setConvertOpen(false);convertTrigger.current?.focus();}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[convertOpen]);
  const openConvert=()=>{if(!lead)return;setConvertTargets(Object.fromEntries(lead.members.map(m=>[m.id,(m.roles??[m.role]).some(r=>r==="Student"||r==="Guest")])));setConvertError("");setPersonModes({});setPersonIds({});setCanonicalNames(Object.fromEntries(lead.members.map(m=>[m.id,m.name])));setActorSelections(Object.fromEntries(lead.members.flatMap(m=>(m.roles??[m.role]).map(r=>[m.id+":"+r,true]))));setGuardianSelections(Object.fromEntries((lead.relationships??[]).map(r=>[r.id,r.status==="CONFIRMED"])));setContactMode("NEW");setContactPersonId("");setContactCanonical(lead.name);setContactActors({Parent:true,Student:false,Guest:false});setConvertOpen(true);};
  return <main className={styles.page}>
    <div className={styles.detailHeader}><div><Link className={styles.back} href={preview ? "/bo/sales/leads/m1-preview" : "/bo/sales/leads"}>← Leads</Link><h1 className={styles.detailTitle}>{lead?.name || "Không tìm thấy Lead"}</h1><p>{lead ? lead.phone+" · "+lead.program+" · "+lead.path : "Lead không có trong danh sách hiện tại."}</p></div><div className={styles.detailActions}><Link className={styles.secondary} href={preview ? "/bo/sales/leads/m1-preview" : "/bo/sales/leads"}>Về danh sách</Link></div></div>
    {lead && <section className={styles.detail}><nav className={styles.tabs} aria-label="Nội dung Lead">{tabs.map(t=><button key={t} className={tab===t?styles.activeTab:""} onClick={()=>setTab(t)}>{t}</button>)}</nav><div className={styles.detailBody}>
      {feedback&&<p role="status" className={styles.editFeedback}>{feedback}</p>}
      {tab==="Tổng quan"&&<div className={styles.fieldGrid}>
        <InlineProperty label="Liên hệ" field="name" value={lead.name} onSave={saveField}/>
        <InlineProperty label="Số điện thoại" field="phone" value={lead.phone} onSave={saveField}/>
        <Property label="Trạng thái" value={lead.status==="ACTIVE"?"Đang hoạt động":"Đã lưu trữ"}/>
        <Property label="Nguồn" value={lead.source}/>
        <InlineProperty label="Chương trình" field="program" value={lead.program} options={["Afterschool","MyTime"]} onSave={saveField}/>
        <InlineProperty label="Chuyên môn" field="path" value={lead.path} options={["Hội họa","Piano"]} onSave={saveField}/>
      </div>}
      {tab==="Tổng quan"&&<div className={styles.convertActionRow}><button type="button" ref={convertTrigger} className={styles.primary} onClick={openConvert}>Convert Lead</button></div>}
      {tab==="Thành viên"&&<><h3>Thành viên dự kiến ({lead.members.length})</h3>{lead.members.length?lead.members.map((m,i)=><section className={styles.memberCard} key={m.id} aria-label={"Thành viên "+(i+1)}><h4>Thành viên {i+1}</h4><div className={styles.fieldGrid}><InlineProperty label="Họ tên" field="name" value={m.name} onSave={(_,value)=>saveMemberField(m.id,"name",value)}/><InlineProperty label="Vai trò dự kiến" field="program" value={m.role} options={["Student","Guest"]} onSave={(_,value)=>saveMemberField(m.id,"role",value)}/><InlineProperty label="Tuổi (nếu biết)" field="path" value={m.age} onSave={(_,value)=>saveMemberField(m.id,"age",value)}/><InlineProperty label="Chương trình quan tâm" field="program" value={m.program ?? lead.program} options={["Afterschool","MyTime"]} onSave={(_,value)=>saveMemberField(m.id,"program",value)}/><InlineProperty label="Chuyên môn quan tâm" field="path" value={m.path ?? lead.path} options={["Hội họa","Piano"]} onSave={(_,value)=>saveMemberField(m.id,"path",value)}/></div></section>):<p>Chưa có thành viên.</p>}</>}
      {tab==="Quan hệ khai báo"&&<><h3>Quan hệ khai báo</h3><p>Chưa có quan hệ được xác minh. Vai trò dự kiến không tạo quan hệ pháp lý.</p></>}
      {tab==="Lịch sử"&&<div className={styles.fieldGrid}><Property label="Created Time" value={lead.createdAt}/><Property label="Created By" value="—"/><Property label="Last Modified Time" value={lead.updatedAt}/><Property label="Last Modified By" value="—"/></div>}
    </div></section>}
    {convertOpen&&lead&&<div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)setConvertOpen(false);}}><section className={styles.drawer} role="dialog" aria-modal="true" aria-label="Chuyển đổi Lead"><header className={styles.drawerHead}><div><small>LEADS · CONVERSION</small><h2>Chuyển đổi Lead</h2><p>Chọn những thành viên cần tạo hồ sơ. Đây là bản xem trước, chưa ghi dữ liệu.</p></div><button type="button" className={styles.icon} aria-label="Đóng" onClick={()=>setConvertOpen(false)}>×</button></header><div className={styles.drawerBody}><div className={styles.conversionSummary}><strong>Liên hệ chính</strong><p>{lead.name} · {lead.phone}</p><p>{lead.program} · {lead.path}</p><div className={styles.convertPersonFields}><label>Person<select value={contactMode} onChange={e=>setContactMode(e.target.value)}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></label><label>Person ID<input placeholder="PERSON-..." disabled={contactMode!=="EXISTING"} value={contactPersonId} onChange={e=>setContactPersonId(e.target.value)}/></label><label>Tên canonical<input value={contactCanonical} onChange={e=>setContactCanonical(e.target.value)}/></label></div><fieldset className={styles.convertActors}><legend>Actors của liên hệ chính (chọn nhiều)</legend>{(["Parent","Student","Guest"] as const).map(role=><label key={role}><input type="checkbox" checked={!!contactActors[role]} onChange={e=>setContactActors(v=>({...v,[role]:e.target.checked}))}/> {role}</label>)}</fieldset></div><h3>Hồ sơ thành viên</h3><p>Chọn thành viên để chuẩn bị chuyển đổi. Người liên hệ chính được giữ làm đầu mối liên hệ.</p>{lead.members.map(m=><article key={m.id} className={styles.convertPersonCard}><label className={styles.conversionMember}><input type="checkbox" checked={!!convertTargets[m.id]} onChange={e=>setConvertTargets(v=>({...v,[m.id]:e.target.checked}))}/><span><strong>{m.name}</strong><small>{(m.roles??[m.role]).join(" · ")} · {m.age?m.age+" tuổi · ":""}{m.program??lead.program} / {m.path??lead.path}</small></span></label>{convertTargets[m.id]&&<><div className={styles.convertPersonFields}><label>Person<select value={personModes[m.id]??"NEW"} onChange={e=>setPersonModes(v=>({...v,[m.id]:e.target.value}))}><option value="NEW">Tạo mới</option><option value="EXISTING">Liên kết hiện có</option></select></label><label>Person ID<input placeholder="PERSON-..." disabled={(personModes[m.id]??"NEW")!=="EXISTING"} value={personIds[m.id]??""} onChange={e=>setPersonIds(v=>({...v,[m.id]:e.target.value}))}/></label><label>Tên canonical<input value={canonicalNames[m.id]??m.name} onChange={e=>setCanonicalNames(v=>({...v,[m.id]:e.target.value}))}/></label></div><fieldset className={styles.convertActors}><legend>Actors</legend>{(m.roles??[m.role]).map(r=><label key={r}><input type="checkbox" checked={!!actorSelections[m.id+":"+r]} onChange={e=>setActorSelections(v=>({...v,[m.id+":"+r]:e.target.checked}))}/> {r}</label>)}</fieldset></>}</article>)}<section className={styles.convertGuardian}><h3>Guardian relationships</h3><p>Chỉ tạo quan hệ đã được xác nhận. Quan hệ khai báo chưa xác nhận không được chọn mặc định.</p>{(lead.relationships??[]).map(r=>{const from=lead.members.find(m=>m.id===r.from),to=lead.members.find(m=>m.id===r.to);return <label key={r.id}><input type="checkbox" disabled={r.status!=="CONFIRMED"||!convertTargets[r.from]||!convertTargets[r.to]} checked={!!guardianSelections[r.id]&&r.status==="CONFIRMED"&&!!convertTargets[r.from]&&!!convertTargets[r.to]} onChange={e=>setGuardianSelections(v=>({...v,[r.id]:e.target.checked}))}/><span>{from?.name??"—"} → {to?.name??"—"} · {r.label}<small>{r.status==="CONFIRMED"?"Đã xác nhận":"Chưa xác nhận — không thể chọn"}</small></span></label>})}{!(lead.relationships??[]).length&&<p>Chưa có quan hệ được xác nhận. Không tự suy luận Guardian từ vai trò Parent/Student.</p>}</section><div className={styles.conversionSummary}><strong>Kiểm tra trước chuyển đổi</strong><p>{Object.values(convertTargets).filter(Boolean).length} hồ sơ thành viên được chọn.</p><p>Conversion thật sẽ cần kiểm tra Person trùng, liên kết hộ gia đình và loại hồ sơ đích trên backend.</p></div>{convertError&&<p role="alert" className={styles.error}>{convertError}</p>}</div><footer className={styles.drawerFoot}><button type="button" className={styles.secondary} onClick={()=>setConvertOpen(false)}>Hủy</button><button type="button" className={styles.primary} disabled={!Object.values(convertTargets).some(Boolean)} onClick={()=>{const selected=lead.members.filter(m=>convertTargets[m.id]);if(selected.some(m=>(personModes[m.id]??"NEW")==="EXISTING"&&!personIds[m.id]?.trim())){setConvertError("Vui lòng nhập Person ID cho thành viên liên kết hiện có.");return;}if(selected.some(m=>!canonicalNames[m.id]?.trim())){setConvertError("Tên canonical không được để trống.");return;}if(!contactCanonical.trim()||(contactMode==="EXISTING"&&!contactPersonId.trim())||!Object.values(contactActors).some(Boolean)){setConvertError("Liên hệ chính cần Person hợp lệ và ít nhất một Actor.");return;}if(selected.some(m=>!(m.roles??[m.role]).some(r=>actorSelections[m.id+":"+r]))){setConvertError("Mỗi thành viên được chọn cần ít nhất một Actor.");return;}setConvertError("Mô phỏng hoàn tất: "+selected.length+" Person/Actor mapping · "+(lead.relationships??[]).filter(r=>r.status==="CONFIRMED"&&guardianSelections[r.id]&&convertTargets[r.from]&&convertTargets[r.to]).length+" Guardian relationship. Chưa ghi Core.");}}>Xác nhận xem trước</button></footer></section></div>}
  </main>;
}
