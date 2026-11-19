/** PAP-2192 M1 only. Actual native renderer, local synthetic callbacks. Never a product route. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TddRenderer } from "../../app/components/workspace-renderer/Renderer";

import { TddRegistry, type AuthorizationContext, type ModuleRow } from "../../lib/workspace-schema";
import { roleSchema, roleFields, roleQuery, verifyRolePermissionTabApproval } from "../../app/ho/system/roles/schema";
import { staffSchema, staffQuery, staffFields } from "../../app/ho/staff/schema";
import { CreateCustomRoleFields, ArchiveCustomRoleAction, TemporaryRoleAssignmentForm } from "../../app/ho/system/roles/RoleLifecycleForms";
import { type RoleCandidate } from "../../app/ho/system/roles/role-lifecycle-model";
import {roleCreateActions,useRoleCreateFlow} from "../../app/ho/system/roles/useRoleCreateFlow";
import { TosButton } from "@pino/design-system/react";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";
import "../../public/ho-authority-source/ho-scoped.css";
import "../../app/bo/design-system/foundation.css";
import "../../app/ho/ho-theme.css";
import "../../app/components/workspace-renderer/tdd-detail-layout.css";
import "../../app/components/workspace-renderer/tdd-table-geometry.css";
import "../../app/components/workspace-renderer/tdd-freeze.css";
const registry=new TddRegistry(verifyRolePermissionTabApproval);
const schema=registry.register({...roleSchema,capabilities:{...roleSchema.capabilities,create:"access.role.create"},actions:roleCreateActions});
const staffRegistry=new TddRegistry();
const staff=staffRegistry.register(staffSchema);
const ctx:AuthorizationContext={surface:"HO",authorize:key=>["access.role.view","team.bo.access","access.role.create"].includes(key)};
type Row=ModuleRow<typeof roleFields>;
const rowsInitial:Row[]=[{id:"fixture-1",name:"QA Role trống",roleType:"custom",status:"active",permissionCount:2,assignmentCount:0,roleKey:"qa-empty"},{id:"fixture-2",name:"QA Manager đang dùng",roleType:"custom",status:"active",permissionCount:2,assignmentCount:1,roleKey:"qa-used"},{id:"fixture-3",name:"Founder",roleType:"system",status:"active",permissionCount:5,assignmentCount:1,roleKey:"founder"}];
const staffRow:ModuleRow<typeof staffFields>={id:"fixture-staff",name:"QA Staff mẫu",status:"Đang làm",role:"Staff (hiện hữu)"};
function Fixture(){
 const [rows,setRows]=useState(rowsInitial),[query,setQuery]=useState(roleQuery),[selected,setSelected]=useState<string|null>(null),[mode,setMode]=useState<"roles"|"staff">("roles"),[notice,setNotice]=useState(""),[temporary,setTemporary]=useState<string[]>([]);
 const [fullDetail,setFullDetail]=useState(false);
 const flow=useRoleCreateFlow(true,async input=>{
   if(rows.some(r=>r.roleKey===input.roleKey))return {state:"invalid"};
   const id="fixture-"+(rows.length+1);
   const receipt={...input,id,roleType:"custom" as const,status:"active" as const,permissionCount:0,assignmentCount:0};
   setRows(prev=>[...prev,{id,name:input.displayName,roleKey:input.roleKey,roleType:"custom",status:"active",permissionCount:0,assignmentCount:0}]);
   return {state:"verified",receipt};
 },()=>setNotice("Mô phỏng: đã tạo vai trò."));
 const bindings=flow.bindings;
 const row=rows.find(x=>x.id===selected);
 return <main data-surface="ho" data-bo-ui-authority="v25" style={{minWidth:0,padding:"12px"}}>
 <p role="status">M1 REVIEW · dữ liệu giả lập · không kết nối API</p>
 <nav aria-label="Review module" style={{display:"flex",gap:8,flexWrap:"wrap"}}><TosButton variant="secondary" type="button" onClick={()=>{setMode("roles");setSelected(null);setNotice("");}}>Roles</TosButton><TosButton variant="secondary" type="button" onClick={()=>{setMode("staff");setSelected(null);setNotice("");}}>Staff</TosButton></nav>
 {notice&&<p role="status">{notice}</p>}{flow.uncertain&&<p role="alert">Chưa xác minh được Role. Tải lại trước khi thử lại.</p>}
 {mode==="roles"?(row&&fullDetail?<TddRenderer view={{kind:"detail",props:{registry,schema,context:ctx,record:row,status:"ready",onBack:()=>{setSelected(null);setNotice("");},subject:{type:"access_role",id:row.id},overviewAfter:<div className="ho-role-editor"><ArchiveCustomRoleAction role={{id:row.id,roleKey:String(row.roleKey),roleType:row.roleType as RoleCandidate["roleType"],status:row.status as RoleCandidate["status"],assignmentCount:Number(row.assignmentCount),updatedAt:"2026-11-19T00:00:00Z"}} label={String(row.name)} onArchive={async id=>{setRows(prev=>prev.map(r=>r.id===id?{...r,status:"archived"}:r));setNotice("Mô phỏng: đã lưu trữ vai trò.");}}/></div>}}}/>:<TddRenderer view={{kind:"table",props:{registry,schema,context:ctx,actionBindings:bindings,query,rows,total:rows.length,status:"ready",onQueryChange:setQuery,onOpen:r=>{setFullDetail(false);setSelected(r.id);}}}}/>):
 <TddRenderer view={{kind:"detail",props:{registry:staffRegistry,schema:staff,context:ctx,record:staffRow,status:"ready",onBack:()=>setMode("roles"),subject:{type:"staff_member",id:staffRow.id},overviewAfter:<div className="ho-role-editor"><p>Phân công hiện hữu: Staff (không thay đổi)</p>{temporary.map(x=><p key={x}>{x}</p>)}<TemporaryRoleAssignmentForm staffLabel="QA Staff mẫu" roles={rows.filter(r=>r.roleType==="custom"&&r.status==="active").map(r=>({id:r.id,label:String(r.name)}))} centers={[{id:"fixture-center",label:"Cần Thơ (QA)"}]} onCancel={()=>setMode("roles")} onAssign={async draft=>{const label=String(rows.find(r=>r.id===draft.roleId)?.name);setTemporary(prev=>[...prev,label+" · Cần Thơ (QA) · "+draft.minutes+" phút"]);setNotice("Mô phỏng: đã bổ sung vai trò có thời hạn.");}}/></div>}}}/>}
 {mode==="roles"&&row&&!fullDetail&&<TddRenderer view={{kind:"drawer",props:{registry,schema,context:ctx,record:row,status:"ready",onClose:()=>setSelected(null),onDetail:()=>setFullDetail(true)}}}/>}
 {flow.open&&<TddRenderer view={{kind:"form",props:{registry,schema,context:ctx,mode:"create",title:"Tạo vai trò",onClose:flow.close,actionBindings:bindings,content:<CreateCustomRoleFields draft={flow.draft} onChange={flow.setDraft} disabled={flow.busy}/>}}}/>}
 </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
