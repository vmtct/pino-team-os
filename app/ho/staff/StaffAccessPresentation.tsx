"use client";
// PAP-784 / WFM-STAFF: isolated local presentation only, no credential or assignment transport.
import {useRef,useState} from "react";
import {applyAccountInlineSample,type AccountInlineField} from "./staff-account-inline-sample";
import {StaffSecuritySample} from "./StaffSecuritySample";
import {StaffAccessControls} from "./StaffAccessControls";
import {createStaffAccessFixturePort} from "./staff-access-fixture-port";
import {StaffAccessScenario} from "./StaffAccessScenario";
import {PropertySections,type PropertyField,type PropertyCommitResult,type PropertyValue} from "@pino/design-system/react";
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
 const [snapshot,setSnapshot]=useState<Snapshot>(()=>({...structuredClone(seed),employment:"active",accountStatus:"inactive",accountId:"M1-HYPOTHETICAL-ACCOUNT:"+seed.staffId,assignments:[]}));
 const [loginEmail,setLoginEmail]=useState("staff-m1@example.invalid");const [savedNotice,setSavedNotice]=useState("");
 const [port,setPort]=useState(()=>createStaffAccessFixturePort(snapshot,catalog,sampleCenters,targets));
 const [epoch,setEpoch]=useState(0);const epochRef=useRef(0);
 const current=useRef({snapshot,loginEmail});
 const one=snapshot.assignments.length===1?snapshot.assignments[0]:undefined;
 const inlineFields:PropertyField[]=[
  {...fields.find(f=>f.key==="accountStatus")!,type:"select",readOnly:false,required:true,options:[{value:"inactive",label:"Ngưng hoạt động"},{value:"active",label:"Đang hoạt động"}]},
  {...fields.find(f=>f.key==="loginEmail")!,readOnly:false,required:true},
  {key:"role",label:"Vai trò",type:"select",required:true,readOnly:snapshot.accountStatus!=="active"||!one||one.protected,options:catalog.filter(r=>r.active&&!r.protected&&(!one||r.scopes.includes(one.scope.type))).map(r=>({value:r.id,label:r.label}))},
 ];
 const inlineValues={accountStatus:snapshot.accountStatus,loginEmail,role:one?.roleId??(snapshot.assignments.length?"Nhiều vai trò":"Chưa phân công")};
 async function commit(key:string,value:PropertyValue,{signal}:{signal:AbortSignal}):Promise<PropertyCommitResult>{
  if(signal.aborted||!["accountStatus","loginEmail","role"].includes(key))return {status:"denied"};
  const next=applyAccountInlineSample(current.current,{staffId:snapshot.staffId,accountId:snapshot.accountId,revision:snapshot.revision,field:key as AccountInlineField,value},catalog,sampleCenters,targets);
  if(!next)return {status:"denied"};
  current.current=next;setSnapshot(next.snapshot);setLoginEmail(next.loginEmail);setPort(createStaffAccessFixturePort(next.snapshot,catalog,sampleCenters,targets));epochRef.current++;setEpoch(epochRef.current);
  return {status:"saved",value:key==="accountStatus"?next.snapshot.accountStatus:key==="loginEmail"?next.loginEmail:next.snapshot.assignments[0]?.roleId??null};
 }
 function verified(next:Snapshot){if(epoch!==epochRef.current||next.staffId!==current.current.snapshot.staffId||next.accountId!==current.current.snapshot.accountId||next.revision!==current.current.snapshot.revision+1)return;current.current={snapshot:next,loginEmail:current.current.loginEmail};setSnapshot(next);}

 return <section data-staff-account-lifecycle-sample><h3>Quản lý tài khoản (M1)</h3><p>Tình huống giả định Staff đang làm việc, tài khoản đã liên kết. Chỉnh sửa tại từng field; không thay đổi hồ sơ, tài khoản hay quyền thực tế.</p><PropertySections recordKey={snapshot.accountId??snapshot.staffId} fields={inlineFields} values={inlineValues} sections={[{id:"account-lifecycle",label:"Thông tin tài khoản",fields:inlineFields.map(f=>f.key)}]} variant="detail" surface="ho" canEdit={key=>key==="accountStatus"||key==="loginEmail"||(key==="role"&&snapshot.accountStatus==="active"&&!!one&&!one.protected)} onCommit={commit} onSaved={()=>setSavedNotice("Đã lưu thay đổi mẫu.")}/>{savedNotice&&<p role="status">{savedNotice}</p>}<p>Kích hoạt hoặc ngưng tài khoản không thay đổi trạng thái làm việc hay tự cấp vai trò. Phân công mới cần chọn phạm vi bên dưới.</p><StaffSecuritySample snapshot={snapshot} loginEmail={loginEmail}/><StaffAccessControls key={epoch} snapshot={snapshot} roles={catalog} centers={sampleCenters} targets={targets} port={port} onVerified={verified}/><StaffAccessScenario seed={{...snapshot,assignments:[]}} roles={catalog} centers={sampleCenters} affiliationOnly/></section>;
}
