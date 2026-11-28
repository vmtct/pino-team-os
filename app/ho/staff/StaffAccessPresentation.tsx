"use client";
// PAP-2423 / PAP-784: selected synthetic record only; no live transport.
import {useRef,useState} from "react";
import {applyAccountInlineSample,type AccountInlineField,type AccountInlineSample} from "./staff-account-inline-sample";
import {StaffAccessControls} from "./StaffAccessControls";
import {StaffPasswordResetPreview} from "./StaffPasswordResetPresentation";
import {createStaffAccessFixturePort} from "./staff-access-fixture-port";
import {StaffAccessScenario} from "./StaffAccessScenario";
import {PropertySections,type PropertyField,type PropertyCommitResult,type PropertyValue} from "@pino/design-system/react";
import {accountPresentation,type Snapshot,type CenterChoice,type RoleChoice} from "./staff-access-presentation-model";

type Persist=(before:AccountInlineSample,next:AccountInlineSample)=>boolean;
const labels={missing:"Chưa liên kết tài khoản",inactive:"Ngừng hoạt động",active:"Đang hoạt động",unknown:"Chưa xác minh tài khoản"} as const;
const fields:PropertyField[]=[
 {key:"employment",label:"Trạng thái làm việc",type:"text",readOnly:true},
 {key:"accountStatus",label:"Trạng thái tài khoản",type:"text",readOnly:true},
 {key:"loginEmail",label:"Email đăng nhập",type:"text",readOnly:true},
 {key:"readiness",label:"Điều kiện vận hành",type:"text",readOnly:true},
];
const targets=[{id:"M1-PATH",label:"Path M1 sample",type:"PATH" as const,active:true},{id:"M1-RUNNING-CLASS",label:"Running Class M1 sample",type:"RUNNING_CLASS" as const,active:true}];
const roleCatalog=(roles:readonly RoleChoice[])=>[...roles,{id:"M1-FOUR-SCOPE-ROLE",label:"Custom role (M1 sample)",active:true,protected:false,scopes:["CENTER","GLOBAL","PATH","RUNNING_CLASS"] as const}];
function display(snapshot:Snapshot,centers:readonly CenterChoice[],loginEmail:string|null){
 const v=accountPresentation(snapshot,centers);
 return {employment:v.employment==="active"?"Đang làm":"Ngưng",accountStatus:labels[v.accountStatus],loginEmail:loginEmail||"—",readiness:v.operationalReadiness==="not-ready"?"Chưa đủ điều kiện":"Chưa xác minh quyền và phạm vi cơ sở"};
}
export function StaffAccessPresentation({snapshot,centers,roles,loginEmail,persist}:{snapshot:Snapshot;centers:readonly CenterChoice[];roles:readonly RoleChoice[];loginEmail:string|null;persist?:Persist}){
 const linked=!!persist&&snapshot.accountId==="M1-HYPOTHETICAL-ACCOUNT:"+snapshot.staffId&&["active","inactive"].includes(snapshot.accountStatus)&&!!loginEmail;
 if(linked)return <LocalAccessSample key={snapshot.staffId+":"+snapshot.revision} seed={{snapshot,loginEmail:loginEmail!}} centers={centers} roles={roles} persist={persist!}/>;
 const v=accountPresentation(snapshot,centers);
 const readonlyFields:PropertyField[]=[...fields,{key:"affiliations",label:"Cơ sở làm việc",type:"text",readOnly:true},{key:"assignments",label:"Vai trò và phạm vi truy cập",type:"text",readOnly:true}];
 const values={...display(snapshot,centers,loginEmail),affiliations:v.affiliations.map(c=>c.label).join("; ")||"—",assignments:v.assignments.map(a=>(roles.find(r=>r.id===a.roleId)?.label??"Chưa xác minh vai trò")+" · "+(a.scope.type==="GLOBAL"?"Toàn hệ thống":centers.find(c=>c.id===a.scope.id)?.label??"Chưa xác minh phạm vi")).join("; ")||"—"};
 return <div><PropertySections recordKey={snapshot.staffId} fields={readonlyFields} values={values} sections={[{id:"staff-access-presentation",label:"Tài khoản và quyền truy cập",fields:readonlyFields.map(f=>f.key)}]} variant="detail" surface="ho" canEdit={()=>false}/><p>Chưa có tài khoản mẫu liên kết có thể chỉnh sửa.</p></div>;
}
function LocalAccessSample({seed,centers,roles,persist}:{seed:AccountInlineSample;centers:readonly CenterChoice[];roles:readonly RoleChoice[];persist:Persist}){
 const catalog=roleCatalog(roles);
 const [record,setRecord]=useState(()=>structuredClone(seed));
 const {snapshot,loginEmail}=record;
 const [notice,setNotice]=useState("");
 const current=useRef(record);
 const [port,setPort]=useState(()=>createStaffAccessFixturePort(snapshot,catalog,centers,targets));
 const [epoch,setEpoch]=useState(0);const epochRef=useRef(0);
 const one=snapshot.assignments.length===1?snapshot.assignments[0]:undefined;
 const inlineFields:PropertyField[]=[
  ...fields.map(f=>f.key==="accountStatus"?{...f,type:"select" as const,readOnly:false,required:true,options:[{value:"inactive",label:labels.inactive},{value:"active",label:labels.active}]}:f.key==="loginEmail"?{...f,readOnly:false,required:true}:f),
  {key:"role",label:"Vai trò",type:"select",required:true,readOnly:snapshot.accountStatus!=="active"||!one||one.protected,options:catalog.filter(r=>r.active&&!r.protected&&(!one||r.scopes.includes(one.scope.type))).map(r=>({value:r.id,label:r.label}))}
 ];
 const values={...display(snapshot,centers,loginEmail),accountStatus:snapshot.accountStatus,role:one?.roleId??(snapshot.assignments.length?"Nhiều vai trò":"Chưa phân công")};
 function save(before:AccountInlineSample,next:AccountInlineSample,refreshPort:boolean){
  if(!persist(before,next))return false;
  if(next===before)return true;
  current.current=next;setRecord(next);
  if(refreshPort){setPort(createStaffAccessFixturePort(next.snapshot,catalog,centers,targets));epochRef.current++;setEpoch(epochRef.current);}
  return true;
 }
 async function commit(key:string,value:PropertyValue,{signal}:{signal:AbortSignal}):Promise<PropertyCommitResult>{
  if(signal.aborted||!["accountStatus","loginEmail","role"].includes(key))return {status:"denied"};
  const before=current.current;
  const next=applyAccountInlineSample(before,{staffId:snapshot.staffId,accountId:snapshot.accountId,revision:snapshot.revision,field:key as AccountInlineField,value},catalog,centers,targets);
  if(!next||!save(before,next,true))return {status:"denied"};
  return {status:"saved",value:key==="accountStatus"?next.snapshot.accountStatus:key==="loginEmail"?next.loginEmail:next.snapshot.assignments[0]?.roleId??null};
 }
 function verified(next:Snapshot){
  const before=current.current;
  return epoch===epochRef.current&&next.staffId===before.snapshot.staffId&&next.accountId===before.snapshot.accountId&&next.revision===before.snapshot.revision+1&&save(before,{...before,snapshot:next},false);
 }
 function affiliation(before:Snapshot,next:Snapshot){
  const r=current.current;
  return before.staffId===r.snapshot.staffId&&before.revision===r.snapshot.revision&&save(r,{...r,snapshot:next},true);
 }
 return <section data-staff-account-lifecycle-sample><p>Dữ liệu mẫu M1 của Staff đang chọn. Không thay đổi tài khoản hoặc quyền thực tế.</p><PropertySections recordKey={snapshot.staffId} fields={inlineFields} values={values} sections={[{id:"account-lifecycle",label:"Tài khoản và quyền truy cập",fields:inlineFields.map(f=>f.key)}]} variant="detail" surface="ho" canEdit={key=>key==="accountStatus"||key==="loginEmail"||(key==="role"&&snapshot.accountStatus==="active"&&!!one&&!one.protected)} onCommit={commit} onSaved={()=>setNotice("Đã lưu thay đổi mẫu.")}/>{notice&&<p role="status">{notice}</p>}<p>Kích hoạt tài khoản không thay đổi trạng thái làm việc hay tự cấp vai trò. Phạm vi truy cập không tự tạo liên kết cơ sở.</p><StaffPasswordResetPreview key={snapshot.staffId+":"+snapshot.revision} staffId={snapshot.staffId} email={loginEmail} eligible={snapshot.employment==="active"&&snapshot.accountStatus==="active"}/><StaffAccessControls key={epoch} snapshot={snapshot} roles={catalog} centers={centers} targets={targets} port={port} onVerified={verified}/><StaffAccessScenario key={snapshot.revision} seed={snapshot} roles={catalog} centers={centers} affiliationOnly onCommit={affiliation}/></section>;
}
