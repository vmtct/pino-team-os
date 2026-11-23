"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./lead-household.module.css";

type Member = { id: string; name: string; role: string; age: string };
type Lead = { id: string; name: string; phone: string; program: string; path: string; members: Member[]; createdAt: string; updatedAt: string; source: string; status: string };
const example: Lead = { id: "lead-001", name: "Nguyễn Thị Minh Anh", phone: "090 123 4567", program: "Afterschool", path: "Hội họa", members: [{id:"m1",name:"Nguyễn Thị Minh Anh",role:"Parent",age:""},{id:"m2",name:"Nguyễn Gia Hân",role:"Student",age:"8"}], createdAt:"22/11/2026 · 09:30",updatedAt:"23/11/2026 · 08:45",source:"Website",status:"ACTIVE" };
const tabs = ["Tổng quan","Thành viên","Quan hệ khai báo","Quan tâm","Lịch sử"] as const;
type Tab = typeof tabs[number];
function Property({label,value}:{label:string;value:string}) {return <div className={styles.field}><span>{label}</span><strong>{value||"—"}</strong></div>;}
export function LeadDetailPage({leadId}:{leadId:string}) {
  const [lead,setLead]=useState<Lead|null>(leadId==="lead-001"?example:null);
  const [tab,setTab]=useState<Tab>("Tổng quan");
  useEffect(()=>{
    try {const saved=JSON.parse(sessionStorage.getItem("pino-leads-m1")||"[]") as Lead[];setLead(saved.find(x=>x.id===leadId) || (leadId==="lead-001"?example:null));}catch{setLead(leadId==="lead-001"?example:null);}
  },[leadId]);
  return <main className={styles.page}>
    <div className={styles.detailHeader}><div><Link className={styles.back} href="/bo/sales/leads">← Leads</Link><h1 className={styles.detailTitle}>{lead?.name || "Không tìm thấy Lead"}</h1><p>{lead ? lead.phone+" · "+lead.program+" · "+lead.path : "Lead không có trong danh sách hiện tại."}</p></div><Link className={styles.secondary} href="/bo/sales/leads">Về danh sách</Link></div>
    {lead && <section className={styles.detail}><nav className={styles.tabs} aria-label="Nội dung Lead">{tabs.map(t=><button key={t} className={tab===t?styles.activeTab:""} onClick={()=>setTab(t)}>{t}</button>)}</nav><div className={styles.detailBody}>
      {tab==="Tổng quan"&&<div className={styles.fieldGrid}><Property label="Liên hệ" value={lead.name}/><Property label="Số điện thoại" value={lead.phone}/><Property label="Trạng thái" value={lead.status==="ACTIVE"?"Đang hoạt động":"Đã lưu trữ"}/><Property label="Nguồn" value={lead.source}/><Property label="Chương trình" value={lead.program}/><Property label="Chuyên môn" value={lead.path}/></div>}
      {tab==="Thành viên"&&<><h3>Thành viên dự kiến ({lead.members.length})</h3>{lead.members.length?lead.members.map(m=><div className={styles.memberRow} key={m.id}><strong>{m.name}</strong><span>{m.role}{m.age?" · "+m.age+" tuổi":""}</span></div>):<p>Chưa có thành viên.</p>}</>}
      {tab==="Quan hệ khai báo"&&<><h3>Quan hệ khai báo</h3><p>Chưa có quan hệ được xác minh. Vai trò dự kiến không tạo quan hệ pháp lý.</p></>}
      {tab==="Quan tâm"&&<div className={styles.fieldGrid}><Property label="Chương trình" value={lead.program}/><Property label="Chuyên môn" value={lead.path}/><Property label="Nguồn tiếp nhận" value={lead.source}/></div>}
      {tab==="Lịch sử"&&<div className={styles.fieldGrid}><Property label="Created Time" value={lead.createdAt}/><Property label="Created By" value="—"/><Property label="Last Modified Time" value={lead.updatedAt}/><Property label="Last Modified By" value="—"/></div>}
    </div></section>}
  </main>;
}
