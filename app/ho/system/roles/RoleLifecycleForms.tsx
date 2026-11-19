"use client";
import { useId, useRef, useState } from "react";
import { TosButton, TosCard } from "@pino/design-system/react";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import type { BoField } from "@/lib/bo-registration";
import { canArchiveRole, matchesArchiveConfirmation, verifyArchivedRole, matchesExpiryConfirmation, verifyTemporaryAssignment, validExpiryDraft, QA_MINUTES, type RoleCandidate, type RoleDraft, type RoleOption, type ExpiryReview, type QaMinutes } from "./role-lifecycle-model";

// PAP-2192 M1: dependency-injected presentation. No HTTP, session, grant or environment
// admission here. A missing integration callback must never enable an action.

const drawerFields = [
  {key:"name",label:"Tên vai trò",icon:"Aa",type:"text",w:240},
  {key:"roleKey",label:"Role Key",icon:"⌘",type:"text",w:180},
  {key:"description",label:"Mô tả",icon:"Aa",type:"text",w:240},
] as const satisfies readonly BoField[];
const drawerSections=[{id:"role-info",label:"Thông tin Role",fields:["name","roleKey","description"]}] as const;
export function CreateCustomRoleFields({draft,onChange,disabled=false}:{
  draft:RoleDraft; onChange:(draft:RoleDraft)=>void; disabled?:boolean;
}){
  const id=useId();
  const fields= { name:draft.displayName,roleKey:draft.roleKey,description:draft.description };
  return <>
    <PropertySections variant="drawer" fields={drawerFields} sections={drawerSections} record={{id:"",...fields}} createFields={{
      name:{id:id+"-name",value:draft.displayName,required:true,maxLength:120,disabled,onChange:value=>onChange({...draft,displayName:value})},
      roleKey:{id:id+"-key",value:draft.roleKey,required:true,maxLength:80,disabled,onChange:value=>onChange({...draft,roleKey:value})},
      description:{id:id+"-description",value:draft.description,disabled,onChange:value=>onChange({...draft,description:value}),control:<textarea className="property-control os-create-select" id={id+"-description"} rows={3} maxLength={500} disabled={disabled} value={draft.description} onChange={e=>onChange({...draft,description:e.target.value})}/>}
    }}/>
  </>;
}
export function ArchiveCustomRoleAction({ role, label, onArchive }: { role: RoleCandidate; label: string; onArchive?: (roleId: string, expectedUpdatedAt: string)=>Promise<unknown> }) {
  const [confirm, setConfirm] = useState<RoleCandidate | null>(null);
  const [busy,setBusy] = useState(false);
  const [outcome,setOutcome] = useState<"idle"|"verified"|"uncertain">("idle");
  const lock = useRef(false);
  const enabled = canArchiveRole(role) && !!onArchive && outcome === "idle";
  const confirmed = confirm !== null && matchesArchiveConfirmation(confirm, role);
  async function archive() {
    if (!enabled || !confirmed || !confirm || !onArchive || lock.current) return;
    const reviewed = confirm;
    lock.current = true;
    setBusy(true);
    setConfirm(null);
    try {
      const receipt = await onArchive(reviewed.id, reviewed.updatedAt);
      setOutcome(verifyArchivedRole(reviewed, receipt) ? "verified" : "uncertain");
    } catch { setOutcome("uncertain"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section aria-label="Lưu trữ vai trò">
    <TosButton type="button" variant="secondary" disabled={!enabled||busy} onClick={()=>setConfirm({...role})}>Lưu trữ vai trò</TosButton>
    {!canArchiveRole(role)&&<p role="status">Chỉ lưu trữ custom role đang hoạt động và không còn phân công.</p>}
    {confirmed&&enabled&&<TosCard className="ho-role-card"><div role="alertdialog" aria-label="Xác nhận lưu trữ vai trò"><p>Lưu trữ {label}? Vai trò sẽ không còn dùng để phân công.</p><div className="ho-role-confirm-actions"><TosButton type="button" variant="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Hủy</TosButton><TosButton type="button" variant="primary" disabled={busy} onClick={()=>void archive()}>Xác nhận lưu trữ</TosButton></div></div></TosCard>}
    {confirm&&!confirmed&&outcome==="idle"&&<p role="alert">Role đã thay đổi. Kiểm tra lại trước khi xác nhận.</p>}
    {outcome==="verified"&&<p role="status">Đã xác minh vai trò được lưu trữ.</p>}
    {outcome==="uncertain"&&<p role="alert">Chưa xác nhận lưu trữ. Tải lại Role và kiểm tra trạng thái trước khi tiếp tục.</p>}
  </section>;
}
export function TemporaryRoleAssignmentForm({ staffId, staffLabel, roles, centers, onAssign, onCancel }: {
  staffId: string; staffLabel: string; roles: readonly RoleOption[]; centers: readonly RoleOption[];
  onAssign?: (input: ExpiryReview)=>Promise<unknown>; onCancel: ()=>void;
}) {
  const id=useId(); const [roleId,setRole]=useState(""); const [centerId,setCenter]=useState("");
  const [minutes,setMinutes]=useState<QaMinutes>(60);
  const [busy,setBusy]=useState(false);
  const [outcome,setOutcome]=useState<"idle"|"verified"|"uncertain">("idle");
  const [confirm,setConfirm]=useState<ExpiryReview|null>(null); const lock=useRef(false);
  const draft={staffId,roleId,centerId,minutes};
  const valid=!!staffId&&validExpiryDraft(draft,roles,centers);
  const confirmed=confirm!==null&&matchesExpiryConfirmation(confirm,draft,roles,centers);
  const enabled=valid&&!!onAssign&&outcome==="idle";
  async function assign(){
    if(!enabled||!onAssign||lock.current||!confirmed||!confirm)return;
    const reviewed=confirm;
    lock.current=true;setBusy(true);setConfirm(null);
    try {const receipt=await onAssign(reviewed);setOutcome(verifyTemporaryAssignment(reviewed,receipt)?"verified":"uncertain");}
    catch {setOutcome("uncertain");}
    finally {lock.current=false;setBusy(false);}
  }
  return <TosCard className="ho-role-card"><section aria-label="Bổ sung vai trò có thời hạn"><h3>Bổ sung vai trò có thời hạn</h3>
    <p>{staffLabel} · Giữ nguyên các phân công hiện có.</p>
    <form onSubmit={e=>{e.preventDefault();if(enabled&&!busy)setConfirm({...draft});}}>
      <fieldset disabled={busy||confirmed||outcome!=="idle"} style={{border:0,padding:0,margin:0,minWidth:0}}>
        <div className="ho-role-field-row"><label htmlFor={id+"-role"}>Vai trò bổ sung</label><select id={id+"-role"} required value={roleId} onChange={e=>{setRole(e.target.value);setConfirm(null);}}><option value="">Chọn vai trò</option>{roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
        <div className="ho-role-field-row"><label htmlFor={id+"-center"}>Chi nhánh</label><select id={id+"-center"} required value={centerId} onChange={e=>{setCenter(e.target.value);setConfirm(null);}}><option value="">Chọn chi nhánh</option>{centers.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
        <div className="ho-role-field-row"><label htmlFor={id+"-duration"}>Thời hạn</label><select id={id+"-duration"} value={minutes} onChange={e=>{setMinutes(Number(e.target.value) as QaMinutes);setConfirm(null);}}>{QA_MINUTES.map(m=><option key={m} value={m}>{m} phút</option>)}</select></div>
      </fieldset>
      <div className="ho-role-actions"><TosButton variant="secondary" type="button" disabled={busy} onClick={onCancel}>Hủy</TosButton><TosButton variant="primary" type="submit" disabled={!enabled||busy||confirmed}>Bổ sung vai trò</TosButton></div>
    </form>
    {confirmed&&enabled&&<div role="alertdialog" aria-label="Xác nhận phân công"><p>{roles.find(r=>r.id===roleId)?.label} · {centers.find(c=>c.id===centerId)?.label} · {minutes} phút. Quyền được bổ sung, không thay thế vai trò cũ.</p><div className="ho-role-confirm-actions"><TosButton variant="secondary" type="button" disabled={busy} onClick={()=>setConfirm(null)}>Quay lại</TosButton><TosButton variant="primary" type="button" disabled={busy} onClick={()=>void assign()}>Xác nhận bổ sung</TosButton></div></div>}
    {confirm&&!confirmed&&outcome==="idle"&&<p role="alert">Phân công đã thay đổi. Kiểm tra lại trước khi xác nhận.</p>}
    {outcome==="verified"&&<p role="status">Đã xác minh phân công có thời hạn.</p>}
    {outcome==="uncertain"&&<p role="alert">Chưa xác nhận phân công. Tải lại và kiểm tra quyền hiện tại trước khi tiếp tục.</p>}
  </section></TosCard>;
}
