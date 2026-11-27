"use client";
// PAP-2353 · HO Manual Staff Creation: native shared drawer, replaceable command boundary.
import { useRef, useState, type ReactNode } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections, type CreateDrawerField } from "@/app/components/workspace-renderer/Properties";
import { toLegacyModule, allowsField, type AuthorizationContext, type ModuleSchema } from "@/lib/workspace-schema";
import {StaffPersonPicker} from "./StaffPersonPicker";
import type {StaffPersonOption,createStaffPersonReader} from "./staff-person-reader";
import type { BoField, BoRecord } from "@/lib/bo-registration";
import { emptyStaffDraft, validateStaffDraft, type ManualStaffFields, type StaffDraft, type StaffCreateCommand, type StaffCenterOption } from "./manual-create-contract";

export type StaffCreateRecovery={pending:()=>boolean;restored?:()=>boolean;committed?:()=>boolean;readback:()=>Promise<boolean>};
type Props = { personReader?:ReturnType<typeof createStaffPersonReader>; recovery?:StaffCreateRecovery; allowLogin?:boolean; schema: ModuleSchema<ManualStaffFields>; context: AuthorizationContext; centers: readonly StaffCenterOption[]; onClose: () => void; onCreate: (command: StaffCreateCommand) => Promise<void> };
const createOnly = (key: string, label: string): BoField => ({ key, label, type: "text", icon: "Aa", w: 180, readonly: true });
export function StaffManualCreateDrawer({ schema, context, centers, onClose, onCreate, personReader, recovery, allowLogin=true }: Props) {
  const [draft, setDraft] = useState(emptyStaffDraft);
  const [login, setLogin] = useState(false), [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [selected,setSelected]=useState<StaffPersonOption|null>(null),[pickerBusy,setPickerBusy]=useState(false);
  const [uncertain,setUncertain]=useState(()=>recovery?.restored?.()??false),[retryAllowed,setRetryAllowed]=useState(false);
  const lockedFields=busy||uncertain;
  const lock = useRef(false);
  const change = (key: keyof StaffDraft, value: string) => { setDraft(d => ({ ...d, [key]: value })); setError(""); };
  const clearSecrets = () => { setPassword(""); setConfirmation(""); };
  const close = () => { if (lock.current||recovery?.pending()) return; clearSecrets(); onClose(); };
  const fields = toLegacyModule(schema as unknown as ModuleSchema).fields.filter(field => allowsField(schema, context, field.key, "display"));
  const sections = schema.drawer.sections.map(section => ({ ...section, fields: section.fields.filter(key => key !== "loginEmail" && fields.some(field => field.key === key)) }));
  const createFields: Record<string, CreateDrawerField> = {};
  const add = (key: keyof StaffDraft, label: string, control?: ReactNode, required = false) => {
    createFields[key] = { id: "staff-create-" + key, label, value: draft[key], onChange: value => change(key, value), required, disabled: lockedFields, ...(control === undefined ? {} : { control }) };
  };
  add("name", "Họ tên", undefined, true);
  add("phone", "Số điện thoại", <input className="property-control os-create-select" type="tel" id="staff-create-phone" required value={draft.phone} disabled={lockedFields} onChange={e => change("phone", e.target.value)} />, true);
  add("email", "Email", <input className="property-control os-create-select" type="email" id="staff-create-email" required value={draft.email} disabled={lockedFields} onChange={e => change("email", e.target.value)} />, true);
  add("gender", "Giới tính", <select className="property-control os-create-select" id="staff-create-gender" value={draft.gender} disabled={lockedFields} onChange={e => change("gender", e.target.value)}><option value="">—</option>{["Nam", "Nữ", "Khác"].map(value => <option key={value}>{value}</option>)}</select>);
  add("birthDate", "Sinh Nhật", <input className="property-control os-create-select" type="date" id="staff-create-birthDate" value={draft.birthDate} disabled={lockedFields} onChange={e => change("birthDate", e.target.value)} />);
  createFields.center = { id: "staff-create-center", value: draft.centerId, required: true, onChange: value => change("centerId", value), control: <select className="property-control os-create-select" id="staff-create-center" required disabled={lockedFields} value={draft.centerId} onChange={e => change("centerId", e.target.value)}><option value="">— Chọn cơ sở —</option>{centers.map(center => <option key={center.id} value={center.id}>{center.label}</option>)}</select> };
  const extra = [createOnly("createLogin", "Tạo tài khoản đăng nhập")];
  createFields.createLogin = { id: "staff-create-login", value: "", onChange: () => {}, control: <input id="staff-create-login" type="checkbox" disabled={lockedFields||!allowLogin} checked={login} onChange={e => { setLogin(e.target.checked); setError(""); clearSecrets(); }} /> };
  if (login && allowLogin) {
    extra.push(...fields.filter(field => field.key === "loginEmail"), createOnly("password", "Mật khẩu"), createOnly("confirmation", "Xác nhận mật khẩu"));
    createFields.loginEmail = { id: "staff-create-loginEmail", label: "Email đăng nhập", value: draft.email, onChange: () => {}, disabled: true, control: <input className="property-control os-create-select" id="staff-create-loginEmail" type="email" value={draft.email} disabled /> };
    for (const [key, value, setter] of [["password", password, setPassword], ["confirmation", confirmation, setConfirmation]] as const) {
      createFields[key] = { id: "staff-create-" + key, value: "", onChange: () => {}, required: true, control: <input className="property-control os-create-select" id={"staff-create-" + key} type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy} value={value} onChange={e => { setter(e.target.value); setError(""); }} /> };
    }
  }
  const row: BoRecord = { id: "", name: draft.name, status: allowLogin ? "Đang làm" : "Ngưng", role: allowLogin ? "Staff" : null, createdAt: null, createdBy: "—", updatedAt: null, updatedBy: "—" };
  const submit = async () => {
    if (lock.current||pickerBusy||(login&&!allowLogin)||(uncertain&&!retryAllowed)) return;
    const result = validateStaffDraft(draft, centers, login ? { password, confirmation } : null, selected?.id);
    if (!result.ok) { setError(result.error); return; }
    lock.current = true; setBusy(true); setError("");
    try { await onCreate(result.command); clearSecrets(); onClose(); }
    catch { clearSecrets(); const pending=recovery?.pending()??false;setUncertain(pending);setRetryAllowed(false);setError(recovery?.committed?.()?"Đã ghi nhận tạo Staff; chưa xác minh được hồ sơ. Chỉ kiểm tra lại, không tạo lần nữa.":pending?"Chưa xác định kết quả. Kiểm tra lại trước khi gửi lại cùng yêu cầu.":"Không thể tạo nhân sự. Hãy kiểm tra và thử lại."); }
    finally { lock.current = false; setBusy(false); }
  };
  const check=async()=>{
    if(!recovery||lock.current||!recovery.pending())return;
    lock.current=true;setBusy(true);setRetryAllowed(false);setError("");
    try{if(await recovery.readback()){setUncertain(false);clearSecrets();onClose();}else if(recovery.restored?.()){setRetryAllowed(false);setError("Chưa ghi nhận kết quả. Yêu cầu gốc không còn trong bộ nhớ; chỉ kiểm tra lại, không gửi yêu cầu mới.");}else{setRetryAllowed(true);setError("Chưa ghi nhận kết quả. Có thể kiểm tra lại hoặc gửi lại đúng yêu cầu gốc.");}
    }catch{setError("Chưa thể xác minh kết quả. Không tạo yêu cầu mới.");}
    finally{lock.current=false;setBusy(false);}
  };
  return <DrawerFrame path={schema.label} title="Tạo nhân sự" onClose={close} footer={<><button type="button" className="secondary-btn" disabled={busy||uncertain} onClick={close}>Hủy</button>{uncertain&&recovery?<button type="button" className="secondary-btn" disabled={busy} onClick={()=>void check()}>Kiểm tra kết quả</button>:null}<button type="button" id="create-save" className="primary-btn" disabled={busy||pickerBusy||(uncertain&&!retryAllowed)} onClick={() => void submit()}>{uncertain?"Gửi lại yêu cầu":"＋ Tạo nhân sự"}</button></>}>
    <PropertySections variant="drawer" fields={[...fields.filter(f => f.key !== "loginEmail"), ...extra]} record={row} sections={[...sections, { id: "login", label: "Tài khoản đăng nhập", fields: extra.map(f => f.key) }]} createFields={createFields} />
    {uncertain&&recovery?.restored?.()?<p role="status">Có yêu cầu tạo Staff chưa xác định từ phiên trước. Kiểm tra kết quả trước khi nhập lại.</p>:null}{personReader?<section aria-label="Liên kết Person hiện có"><StaffPersonPicker reader={personReader} selected={selected} onSelect={setSelected} disabled={lockedFields} onBusy={setPickerBusy}/></section>:null}
    {!allowLogin && <p role="status">Tạo tài khoản đăng nhập chưa được tích hợp. Chỉ tạo hồ sơ nhân sự không hoạt động.</p>}
    {error && <p role="alert" className="edit-error">{error}</p>}
  </DrawerFrame>;
}
