"use client";
import type { MissionInput } from "./command";
import type { MissionPathChoice } from "./mission-path-options";

export const emptyMission: MissionInput = {
  code: "", name: "", level: 1, status: "ACTIVE", plsValue: 0, paperSize: null,
  description: null, guideline: null, pathProgramId: null, pathKeySnapshot: null,
  prerequisiteMissionId: null, prerequisiteCodeSnapshot: null,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateMissionCreate(value: MissionInput): string | null {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(value.code.trim())) return "Mã Mission phải có 2–64 ký tự chữ, số, _ hoặc -.";
  if (!value.name.trim() || value.name.trim().length > 160) return "Tên Mission phải có 1–160 ký tự.";
  if (!Number.isInteger(value.level) || value.level < 1 || value.level > 5) return "Cấp độ phải từ 1 đến 5.";
  if (!Number.isSafeInteger(value.plsValue) || value.plsValue < 0) return "PLS phải là số nguyên không âm.";
  for (const id of [value.pathProgramId, value.prerequisiteMissionId]) {
    if (id && !uuid.test(id)) return "ID liên kết Path/Prerequisite phải là UUID hợp lệ.";
  }
  if (value.description && value.description.length > 4000) return "Mô tả quá dài.";
  if (value.guideline && value.guideline.length > 8000) return "Hướng dẫn quá dài.";
  return null;
}
export function MissionCreateFields({ value, setValue, disabled, editing = false, pathChoices = [],
  pathState = "idle", pathError = "" }: {
  readonly value: MissionInput; readonly setValue: (value: MissionInput) => void;
  readonly disabled: boolean; readonly editing?: boolean;
  readonly pathChoices?: readonly MissionPathChoice[];
  readonly pathState?: "idle" | "loading" | "ready" | "error";
  readonly pathError?: string;
}) {
  const set = <K extends keyof MissionInput>(key: K, entry: MissionInput[K]) => setValue({ ...value, [key]: entry });
  // The legacy edit surface retains existing backend/soft-link fields until Founder S5.
  const input = (id: keyof MissionInput, label: string, placeholder = "") =>
    <label key={id} className="v25-form-field form-row"><span>{label}</span>
      <input type="text" value={String(value[id] ?? "")} placeholder={placeholder} disabled={disabled}
        onChange={e => set(id, (e.target.value.trim() || null) as never)} />
    </label>;
  const pickPath = (id: string) => {
    const choice = pathChoices.find(option => option.id === id);
    setValue({ ...value, pathProgramId: choice?.id ?? null, pathKeySnapshot: choice?.code ?? null });
  };
  return <section aria-label={editing ? "Thông tin sửa Mission" : "Thông tin Mission mới"} className="v25-form-fields edit-form">
    {editing ? <>
      <label className="v25-form-field form-row"><span>Mã Mission *</span><input autoFocus required maxLength={64}
        value={value.code} disabled={disabled} onChange={e => set("code", e.target.value)} /></label>
      <label className="v25-form-field form-row"><span>Tên Mission *</span><input required maxLength={160}
        value={value.name} disabled={disabled} onChange={e => set("name", e.target.value)} /></label>
    </> : <>
      <label className="v25-form-field form-row"><span>Nhiệm vụ *</span><input autoFocus required maxLength={160}
        value={value.name} disabled={disabled} onChange={e => set("name", e.target.value)} /></label>
      <label className="v25-form-field form-row"><span>Mã *</span><input required maxLength={64}
        value={value.code} disabled={disabled} onChange={e => set("code", e.target.value)} /></label>
    </>}
    <label className="v25-form-field form-row"><span>Cấp độ</span>
      <select value={value.level} disabled={disabled} onChange={e => set("level", Number(e.target.value))}>
        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
      </select></label>
    <label className="v25-form-field form-row"><span>Trạng thái</span>
      <select value={value.status} disabled={disabled || !editing} onChange={e => set("status", e.target.value as MissionInput["status"])}>
        <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option>
      </select></label>
    <label className="v25-form-field form-row"><span>PLS</span><input type="number" min={0} step={1}
      value={value.plsValue} disabled={disabled} onChange={e => set("plsValue", Number(e.target.value))} /></label>
    {editing ? <>
      <label className="v25-form-field form-row"><span>Khổ giấy</span>
        <select value={value.paperSize ?? ""} disabled={disabled} onChange={e => set("paperSize", e.target.value ? e.target.value as "B5" | "A4" | "A3" : null)}>
          <option value="">Không áp dụng</option>{["B5", "A4", "A3"].map(s => <option key={s} value={s}>{s}</option>)}
        </select></label>
      {input("pathProgramId", "Path Program ID (nếu có)", "UUID của Path")}
      {input("pathKeySnapshot", "Path Code Snapshot", "Mã Path")}
      {input("prerequisiteMissionId", "Prerequisite Mission ID", "UUID Mission trước")}
      {input("prerequisiteCodeSnapshot", "Prerequisite Code Snapshot", "Mã Mission trước")}
    </> : <>
      <label className="v25-form-field form-row"><span>Path *</span>
        <select aria-label="Path" required value={value.pathProgramId ?? ""}
          disabled={disabled || pathState !== "ready" || pathChoices.length !== 4}
          onChange={e => pickPath(e.target.value)}>
          <option value="">{pathState === "loading" ? "Đang tải Path từ Core…" : "Chọn Path"}</option>
          {pathChoices.map(path => <option key={path.id} value={path.id}>{path.label}</option>)}
        </select>
      </label>
      {pathState === "error" ? <p role="alert">{pathError || "Không tải được Path canonical. Đóng và mở lại form."}</p> : null}
    </>}
    <label className="v25-form-field form-row"><span>Mô tả</span><textarea rows={3} maxLength={4000} disabled={disabled}
      value={value.description ?? ""} onChange={e => set("description", e.target.value || null)} /></label>
    <label className="v25-form-field form-row"><span>Hướng dẫn</span><textarea rows={4} maxLength={8000} disabled={disabled}
      value={value.guideline ?? ""} onChange={e => set("guideline", e.target.value || null)} /></label>
    {!editing ? <div className="v25-form-metadata edit-form" aria-label="Thông tin hệ thống" data-mission-create-audit>
      {(["Created Time", "Created by (User)", "Last Modified Time", "Last Modified By (User)"] as const)
        .map(label => <label key={label} className="v25-form-field form-row"><span>{label}</span>
          <input type="text" value="—" readOnly disabled aria-label={label} />
        </label>)}
    </div> : null}
  </section>;
}
