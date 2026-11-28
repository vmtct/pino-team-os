"use client";
import {useState} from "react";
import {PayrollDsaReadTable} from "../../payroll-periods/PayrollNativeTable";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {checkInEvidenceModule,evidenceRecord,type CheckInEvidenceRow} from "./check-in-evidence-presentation";
const fields=checkInEvidenceModule.fields;
const tabs=[{id:"detail",label:"Thông tin"},{id:"photo",label:"Ảnh bằng chứng"},{id:"history",label:"Lịch sử"}];
export function BoCheckInEvidence({row,onBack}:{row:CheckInEvidenceRow;onBack:()=>void}){
 const [surface,setSurface]=useState<"table"|"drawer"|"detail">("table");
 const [tab,setTab]=useState("detail");
 const [pageSize,setPageSize]=useState(15);
 const record=evidenceRecord(row);
 const photo=<section><h3>Ảnh bằng chứng</h3><p>{row.state==="MISSING_EVIDENCE"?(row.missingReason||"Chưa có ảnh"):row.state==="DELETED"?"Ảnh đã được xóa.":"Chưa có nội dung ảnh được cấp quyền xem."}</p></section>;
 if(surface==="detail")return <DetailFrame title={record.name} subtitle={row.workDate} tabs={tabs} selected={tab} onSelect={setTab} onBack={()=>setSurface("table")}>
  {tab==="detail"?<PropertySections variant="detail" fields={fields} record={record} sections={[{id:"work",label:"Thông tin chấm công",fields:fields.slice(0,7).map(f=>f.key)},{id:"audit",label:"Lịch sử bản ghi",fields:fields.slice(7).map(f=>f.key)}]}/>:tab==="photo"?photo:<section><h3>Lịch sử</h3><p>Chưa có sự kiện được cung cấp.</p></section>}
 </DetailFrame>;
 return <section aria-label="Bằng chứng check-in">
  <div className="page-heading"><div className="page-heading-left"><h1>Bằng chứng check-in</h1></div><button type="button" className="secondary-btn" onClick={onBack}>Về chấm công</button></div>
  <PayrollDsaReadTable module={checkInEvidenceModule} rows={[record]} loadState="ready" onOpen={r=>{if(r.id===record.id)setSurface("drawer");}} selected={surface==="drawer"?record.id:null} page={1} total={1} pageSize={pageSize} onPageChange={()=>{}} onPageSizeChange={setPageSize} filterContent={<p>Ngày công: {row.workDate}</p>} onReset={()=>{setSurface("table");setPageSize(15);}}/>
  {surface==="drawer"&&<BoQuickView module={checkInEvidenceModule} record={record} onClose={()=>setSurface("table")} onDetail={()=>{setTab("detail");setSurface("detail");}} extraSection={photo}/>}
 </section>;
}