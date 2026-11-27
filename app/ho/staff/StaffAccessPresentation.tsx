"use client";
// PAP-784 / WFM-STAFF: isolated local presentation only, no credential or assignment transport.
import {StaffAccessScenario} from "./StaffAccessScenario";
import {PropertySections,type PropertyField} from "@pino/design-system/react";
import {accountPresentation,type Snapshot,type CenterChoice,type RoleChoice} from "./staff-access-presentation-model";
const labels={missing:"Chưa liên kết tài khoản",inactive:"Tài khoản chưa hoạt động",active:"Tài khoản đang hoạt động",unknown:"Chưa xác minh tài khoản"} as const;
const fields:PropertyField[]=[
 {key:"employment",label:"Trạng thái làm việc",type:"text",readOnly:true},
 {key:"accountStatus",label:"Trạng thái tài khoản",type:"text",readOnly:true},
 {key:"loginEmail",label:"Email đăng nhập",type:"text",readOnly:true},
 {key:"readiness",label:"Điều kiện vận hành",type:"text",readOnly:true},
 {key:"affiliations",label:"Cơ sở làm việc",type:"text",readOnly:true},
 {key:"assignments",label:"Vai trò và phạm vi truy cập",type:"text",readOnly:true},
];
const sections=[{id:"staff-access-presentation",label:"Tài khoản và quyền truy cập",fields:fields.map(f=>f.key)}];
export function StaffAccessPresentation({snapshot,centers,roles,loginEmail}:{snapshot:Snapshot;centers:readonly CenterChoice[];roles:readonly RoleChoice[];loginEmail:string|null}){
 const v=accountPresentation(snapshot,centers);
 const values={employment:v.employment==="active"?"Đang làm":"Ngưng",accountStatus:labels[v.accountStatus],loginEmail:loginEmail??"—",readiness:v.operationalReadiness==="not-ready"?"Chưa đủ điều kiện":"Chưa xác minh quyền và phạm vi cơ sở",affiliations:v.affiliations.map(c=>c.label+(c.active?"":" — Chưa xác minh hoạt động")).join("; ")||"Chưa xác minh cơ sở làm việc",assignments:v.assignments.map(a=>(roles.find(r=>r.id===a.roleId)?.label??"Chưa xác minh vai trò")+" · "+(a.scope.type==="GLOBAL"?"Toàn hệ thống":centers.find(c=>c.id===a.scope.id)?.label??"Chưa xác minh cơ sở")+(v.accountStatus!=="active"?" (chưa xác minh hiệu lực)":"")).join("; ")||"Chưa có phân công quyền được xác minh"};
 return <div><PropertySections recordKey={snapshot.staffId} fields={fields} values={values} sections={sections} variant="detail" surface="ho" canEdit={()=>false}/><p>Phạm vi quyền truy cập không tự tạo liên kết cơ sở làm việc.</p><p>Thay đổi quyền và đặt lại mật khẩu chưa khả dụng trong bản xem trước này.</p><StaffAccessScenario key={snapshot.staffId+":"+snapshot.revision} seed={{...snapshot,accountStatus:"active",accountId:"M1-HYPOTHETICAL-ACCOUNT",assignments:[]}} centers={[...centers,{id:"M1-HYPOTHETICAL-CENTER",label:"Cơ sở mẫu 2",active:true}]} roles={[...roles,{id:"M1-HYPOTHETICAL-GLOBAL-ROLE",label:"Vai trò GLOBAL mẫu",active:true,protected:false,scopes:["CENTER","GLOBAL"]}]}/></div>;
}
