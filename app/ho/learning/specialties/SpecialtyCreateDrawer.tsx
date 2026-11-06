"use client";
import { useState } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";

/** PAP-1495 / SPEC-UNLOCK: Visual-only Path choices from existing PINO programs.
 * These are NOT V2 Catalog IDs, MUST be replaced by authorized Core path reader
 * before the separately owned PAP-1493 create writer is ever enabled. */
export const specialtyVisualPaths = Object.freeze([
  { code: "artchitect", label: "Artchitect" },
  { code: "pianohouse", label: "PianoHouse" },
  { code: "little-piner", label: "Little Piner" },
]);
export type SpecialtyDraft = { name: string; pathCode: string; description: string };
export function validateSpecialtyDraft(draft: SpecialtyDraft): string | null {
  if (!draft.name.trim() || draft.name.trim().length > 160) return "Tên Chuyên đề phải có từ 1 đến 160 ký tự.";
  if (!specialtyVisualPaths.some(path => path.code === draft.pathCode)) return "Chọn Path hợp lệ.";
  if (draft.description.length > 4000) return "Mô tả không được quá 4.000 ký tự.";
  return null;
}
/** PINO shared form chrome, real input state and validation; no fake success or write. */
export function SpecialtyCreateDrawer({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<SpecialtyDraft>({ name: "", pathCode: "", description: "" });
  const invalid = validateSpecialtyDraft(draft);
  return <DrawerFrame title="Tạo Chuyên đề" path="Chuyên đề" onClose={onClose} footer={<>
    <button type="button" className="secondary-btn" onClick={onClose}>Hủy</button>
    <button type="button" className="primary-btn" disabled aria-disabled="true"
      title="Chưa thể lưu Chuyên đề">Tạo Chuyên đề</button>
  </>}>
    <section className="v25-form-fields" aria-label="Thông tin Chuyên đề mới">
      <label className="v25-form-field"><span>Tên Chuyên đề *</span>
        <input autoFocus required maxLength={160} value={draft.name} onChange={event =>
          setDraft(value => ({ ...value, name: event.target.value }))} placeholder="Tên Chuyên đề" />
      </label>
      <label className="v25-form-field"><span>Path *</span>
        <select required aria-label="Path" value={draft.pathCode}
          onChange={event => setDraft(value => ({ ...value, pathCode: event.target.value }))}>
          <option value="">Chọn Path</option>
          {specialtyVisualPaths.map(path => <option key={path.code} value={path.code}>{path.label}</option>)}
        </select>
      </label>
      <label className="v25-form-field"><span>Mô tả</span>
        <textarea rows={4} maxLength={4000} value={draft.description} onChange={event =>
          setDraft(value => ({ ...value, description: event.target.value }))} />
      </label>
      {invalid && (draft.name || draft.pathCode) ? <p role="status">{invalid}</p> : null}
      <p role="status">Chưa thể lưu Chuyên đề.</p>
    </section>
  </DrawerFrame>;
}
