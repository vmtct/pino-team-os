"use client";
import { useRef, useState } from "react";
import { BoValue } from "./BoValue";
import { BoTypedEditor } from "./BoTypedEditor";
import { BoParentReadTabs } from "./BoParentReadTabs";
import { useBoDialog } from "./useBoDialog";
import type { BoField, BoModule, BoRecord } from "@/lib/bo-registration";
export function BoQuickView({ module, record, onClose, onDetail, legacyStyles = false, detailLoading = false, detailError = "", onRetryDetail, extraSection, moduleKey }: { moduleKey?: string; legacyStyles?: boolean; detailLoading?: boolean; detailError?: string; onRetryDetail?: () => void; module: BoModule; record: BoRecord | null; onClose: () => void; onDetail: () => void; extraSection?: React.ReactNode }) {
  const panel = useRef<HTMLElement>(null), [draft, setDraft] = useState<BoRecord>({ id: "", name: "" }), [error, setError] = useState("");
  const [edit, setEdit] = useState<{ field: BoField; anchor: HTMLElement } | null>(null);
  useBoDialog(true, onClose, panel);
  const row = record ?? draft;
  return <><div className="drawer-scrim visible" id="drawer-scrim" onClick={onClose} aria-hidden="true" /><aside ref={panel} id="drawer" className="drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <div className="drawer-top"><div className="drawer-header-copy"><span id="drawer-path" className="drawer-path">{module.label}</span><h2 id="drawer-title" className="drawer-record-title">{record ? record.name : "Tạo " + module.label}</h2></div><button id="drawer-close" className="drawer-close" type="button" aria-label="Đóng" onClick={onClose}>×</button></div>
    <div id="drawer-content" className="drawer-content">{moduleKey === "parents" && record ? <BoParentReadTabs module={module} record={record} /> : <section className="property-section"><h3>Thuộc tính</h3>{module.fields.map(field => {
      const editable = !record && field.key === "name";
      return <div className="property-row" key={field.key}><div className="property-label"><small>{field.icon}</small>{field.label}</div><button type="button" className="property-control" data-prop={field.key} disabled={!legacyStyles && !editable} aria-disabled={!editable} tabIndex={editable ? 0 : -1} aria-label={(editable ? "Sửa " : "Chỉ đọc ") + field.label} onClick={e => editable && setEdit({ field: { ...field, readonly: false }, anchor: e.currentTarget })}>{field.key === "id" && !row.id ? <span className="empty-val">Chưa tạo</span> : <BoValue field={field} value={row[field.key]} />}{editable ? <span className="pencil" aria-hidden="true">✎</span> : null}</button></div>;
    })}</section>}{extraSection ?? null}{detailLoading ? <p role="status" className="settings-hint">Đang tải chi tiết…</p> : detailError ? <div className="edit-error" role="alert">{detailError} {onRetryDetail ? <button type="button" onClick={onRetryDetail}>Thử lại</button> : null}</div> : null}{error ? <div className="edit-error" role="alert">{error}</div> : null}</div>
    <div id="drawer-footer" className="drawer-footer"><div className="lab-bottom">{record ? <button type="button" id="full-detail" className="primary-btn" disabled={detailLoading || Boolean(detailError)} onClick={onDetail}>↗ Full Detail</button> : <><button type="button" className="secondary-btn" onClick={onClose}>Hủy</button><button type="button" className="primary-btn" id="create-save" onClick={() => setError(draft.name.trim() ? "Chưa thể tạo hồ sơ." : "Hãy nhập tên hồ sơ.")}>＋ Tạo {module.label}</button></>}</div></div>
  </aside>{edit ? <BoTypedEditor field={edit.field} value={draft[edit.field.key]} anchor={edit.anchor} onClose={() => setEdit(null)} onSave={v => { setDraft(d => ({ ...d, [edit.field.key]: v })); setError(""); }} /> : null}</>;
}
