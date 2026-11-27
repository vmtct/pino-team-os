"use client";
// PAP-784 / WFM-STAFF: isolated local presentation only, no credential or assignment transport.
import {useState} from "react";
import {StaffAccessControls} from "./StaffAccessControls";
import {createStaffAccessFixturePort} from "./staff-access-fixture-port";
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
 return <div><PropertySections recordKey={snapshot.staffId} fields={fields} values={values} sections={sections} variant="detail" surface="ho" canEdit={()=>false}/><p>Phạm vi quyền truy cập không tự tạo liên kết cơ sở làm việc.</p><p>Thay đổi quyền và đặt lại mật khẩu chưa khả dụng trong bản xem trước này.</p><LocalAccessSample key={snapshot.staffId+":"+snapshot.revision} seed={snapshot} centers={centers} roles={roles}/></div>;
}
function LocalAccessSample({seed,centers,roles}:{seed:Snapshot;centers:readonly CenterChoice[];roles:readonly RoleChoice[]}){
 const catalog=[...roles,{id:"M1-FOUR-SCOPE-ROLE",label:"Custom role (M1 sample)",active:true,protected:false,scopes:["CENTER","GLOBAL","PATH","RUNNING_CLASS"] as const}];
 const sampleCenters=[...centers,{id:"M1-HYPOTHETICAL-CENTER",label:"Center M1 sample 2",active:true}];
 const targets=[{id:"M1-PATH",label:"Path M1 sample",type:"PATH" as const,active:true},{id:"M1-RUNNING-CLASS",label:"Running Class M1 sample",type:"RUNNING_CLASS" as const,active:true}];
 const [snapshot,setSnapshot]=useState<Snapshot>(()=>({...structuredClone(seed),accountStatus:"active",accountId:"M1-HYPOTHETICAL-ACCOUNT:"+seed.staffId,assignments:[]}));
 const [port]=useState(()=>createStaffAccessFixturePort(snapshot,catalog,sampleCenters,targets));
 return <section><h3>Kiểm thử phân công (M1)</h3><p>Tình huống giả định tài khoản đang hoạt động; không thay đổi hồ sơ hoặc quyền thực tế.</p><StaffAccessControls snapshot={snapshot} roles={catalog} centers={sampleCenters} targets={targets} port={port} onVerified={setSnapshot}/><StaffAccessScenario seed={{...snapshot,assignments:[]}} roles={catalog} centers={sampleCenters} affiliationOnly/></section>;
}
