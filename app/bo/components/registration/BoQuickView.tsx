"use client";
import { useState } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { BoTypedEditor } from "./BoTypedEditor";
import { BoParentReadTabs } from "./BoParentReadTabs";
import type { BoField, BoModule, BoRecord } from "@/lib/bo-registration";
export function BoQuickView({ module, record, onClose, onDetail, legacyStyles = false, detailLoading = false, detailError = "", onRetryDetail, extraSection, moduleKey }: { moduleKey?: string; legacyStyles?: boolean; detailLoading?: boolean; detailError?: string; onRetryDetail?: () => void; module: BoModule; record: BoRecord | null; onClose: () => void; onDetail: () => void; extraSection?: React.ReactNode }) {
  const [draft, setDraft] = useState<BoRecord>({ id: "", name: "" }), [error, setError] = useState("");
  const [edit, setEdit] = useState<{ field: BoField; anchor: HTMLElement } | null>(null);
  const row = record ?? draft;
  return <><DrawerFrame title={record ? record.name : "Tạo " + module.label} path={module.label} onClose={onClose}
    footer={record ? <button type="button" id="full-detail" className="primary-btn" disabled={detailLoading || Boolean(detailError)} onClick={onDetail}>↗ Full Detail</button> : <><button type="button" className="secondary-btn" onClick={onClose}>Hủy</button><button type="button" className="primary-btn" id="create-save" onClick={() => setError(draft.name.trim() ? "Chưa thể tạo hồ sơ." : "Hãy nhập tên hồ sơ.")}>＋ Tạo {module.label}</button></>}>
    {moduleKey === "parents" && record ? <BoParentReadTabs module={module} record={record} /> : <PropertySections variant="drawer" fields={module.fields} record={row}
      sections={[{ id: "properties", label: "Thuộc tính", fields: module.fields.map(f => f.key) }]} legacyStyles={legacyStyles}
      canEdit={field => !record && field.key === "name"} onEdit={(field, anchor) => setEdit({ field: { ...field, readonly: false }, anchor })} />}
    {extraSection ?? null}{detailLoading ? <p role="status" className="settings-hint">Đang tải chi tiết…</p> : detailError ? <div className="edit-error" role="alert">{detailError} {onRetryDetail ? <button type="button" onClick={onRetryDetail}>Thử lại</button> : null}</div> : null}{error ? <div className="edit-error" role="alert">{error}</div> : null}
  </DrawerFrame>{edit ? <BoTypedEditor field={edit.field} value={draft[edit.field.key]} anchor={edit.anchor} onClose={() => setEdit(null)} onSave={v => { setDraft(d => ({ ...d, [edit.field.key]: v })); setError(""); }} /> : null}</>;
}
