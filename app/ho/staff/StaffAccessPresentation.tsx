"use client";
// PAP-784 / WFM-STAFF: local presentation only, no credential or assignment transport.
import {TosCard} from "@pino/design-system/react";
import {accountPresentation,type Snapshot,type CenterChoice,type RoleChoice} from "./staff-access-presentation-model";
const labels={missing:"Chưa liên kết tài khoản",inactive:"Tài khoản chưa hoạt động",active:"Tài khoản đang hoạt động",unknown:"Chưa xác minh tài khoản"} as const;
export function StaffAccessPresentation({snapshot,centers,roles}:{snapshot:Snapshot;centers:readonly CenterChoice[];roles:readonly RoleChoice[]}){
 const v=accountPresentation(snapshot,centers);
 return <TosCard><section aria-label="Tài khoản và quyền truy cập"><h3>Tài khoản và quyền truy cập</h3><p>Trạng thái làm việc: {v.employment==="active"?"Đang làm":"Ngưng"}</p><p>Trạng thái tài khoản: {labels[v.accountStatus]}</p><p>Điều kiện vận hành: {v.operationalReadiness==="not-ready"?"Chưa đủ điều kiện":"Chưa xác minh quyền và phạm vi cơ sở"}</p>
 <h4>Cơ sở làm việc</h4>{v.affiliations.length?<ul>{v.affiliations.map(c=><li key={c.id}>{c.label}{c.active?"":" — Chưa xác minh hoạt động"}</li>)}</ul>:<p>Chưa xác minh cơ sở làm việc.</p>}
 <h4>Vai trò và phạm vi truy cập</h4>{v.assignments.length?<ul>{v.assignments.map(a=><li key={a.id}>{roles.find(r=>r.id===a.roleId)?.label??"Chưa xác minh vai trò"} · {a.scope.type==="GLOBAL"?"Toàn hệ thống":centers.find(c=>c.id===a.scope.id)?.label??"Chưa xác minh cơ sở"}{v.accountStatus!=="active"?" (chưa xác minh hiệu lực)":""}</li>)}</ul>:<p>Chưa có phân công quyền được xác minh.</p>}
 <p>Phạm vi quyền truy cập không tự tạo liên kết cơ sở làm việc.</p><p>Thay đổi quyền và đặt lại mật khẩu chưa khả dụng trong bản xem trước này.</p></section></TosCard>;
}
