import type {BoModule,BoRecord} from "@/lib/bo-registration";

export type EvidenceState="BOUND"|"MISSING_EVIDENCE"|"DELETED";
export interface CheckInEvidenceRow {
 id:string;workDate:string;staffName:string;assignment:string;
 checkInAt:string|null;checkOutAt:string|null;state:EvidenceState;
 missingReason:string|null;createdAt:string|null;createdBy:string|null;
 updatedAt:string|null;updatedBy:string|null;
}
const labels:Record<EvidenceState,string>={BOUND:"Đã có ảnh",MISSING_EVIDENCE:"Thiếu ảnh",DELETED:"Đã xóa ảnh"};
const fields=[
 ["workDate","Ngày công"],["name","Nhân viên"],["assignment","Ca phân công"],
 ["checkInAt","Check-in Time"],["checkOutAt","Check-out Time"],["evidence","Bằng chứng ảnh"],
 ["missingReason","Lý do thiếu ảnh"],["createdAt","Created Time"],["createdBy","Created by (User)"],
 ["updatedAt","Last Modified Time"],["updatedBy","Last Modified By (User)"]
] as const;
export const checkInEvidenceModule:BoModule={label:"Bằng chứng check-in",group:"Workforce",fields:fields.map(([key,label])=>({key,label,type:"text",icon:"Aa",w:key==="name"||key==="missingReason"?220:145,readonly:true}))};
export function evidenceRecord(row:CheckInEvidenceRow):BoRecord{
 return {id:row.id,name:row.staffName,workDate:row.workDate,assignment:row.assignment,
  checkInAt:row.checkInAt,checkOutAt:row.checkOutAt,evidence:labels[row.state],
  missingReason:row.state==="MISSING_EVIDENCE"?row.missingReason:null,
  createdAt:row.createdAt,createdBy:row.createdBy,updatedAt:row.updatedAt,updatedBy:row.updatedBy};
}
/** Local review data only; never a Core evidence receipt or private media URL. */
export function createCheckInEvidenceFixture():CheckInEvidenceRow{
 return {id:"PAYROLL-CAMERA-MOCK-001",workDate:"28/11/2026",staffName:"Nhân viên mẫu",assignment:"18:00–21:00",
  checkInAt:"28/11/2026 · 18:00",checkOutAt:null,state:"MISSING_EVIDENCE",
  missingReason:"Chưa ghi nhận ảnh",createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
}
