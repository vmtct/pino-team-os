"use client";
/** Shared PINO DSA View+Create Drawer. PAP-1669 / PAP-1665 PLT-ATTR FSG2. */
import { useState } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { BoStudentBirthDateLocalField } from "./BoStudentDetailLocalField";
import { useBoCenterSelection } from "./BoCenterSelection";
import { BoTypedEditor } from "./BoTypedEditor";
import { BoParentReadTabs } from "./BoParentReadTabs";
import { BoWorkforceAssignmentNoteEditor } from "./BoWorkforceAssignmentNoteEditor";
import type { BoField, BoModule, BoRecord, BoValue } from "@/lib/bo-registration";

/** Controller owns domain validation and API; renderer always owns identical View/Create DOM. */
export interface BoQuickViewCreate {
  draft: BoRecord;
  fields?: BoField[];
  editable: (field: BoField) => boolean;
  editorField?: (field: BoField) => BoField;
  editorValue?: (field: BoField, value: BoValue) => BoValue;
  onChange: (key: string, value: BoValue) => void;
  onCreate: () => void | Promise<void>;
  busy?: boolean;
  error?: string;
  title?: string;
  path?: string;
}
export function BoQuickView({ module, record, onClose, onDetail, hideDetailAction = false, legacyStyles = false, detailLoading = false, detailError = "", onRetryDetail, extraSection, moduleKey, create }: {
  moduleKey?: string; legacyStyles?: boolean; detailLoading?: boolean; detailError?: string;
  onRetryDetail?: () => void; module: BoModule; record: BoRecord | null;
  onClose: () => void; onDetail?: () => void; hideDetailAction?: boolean;
  extraSection?: React.ReactNode; create?: BoQuickViewCreate;
}) {
  const [draft, setDraft] = useState<BoRecord>({ id: "", name: "" });
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<{ field: BoField; anchor: HTMLElement } | null>(null);
  const center = useBoCenterSelection();
  const student = moduleKey === "students" ? record : null;
  const fields = student ? module.fields.filter(field => !["birthDay", "birthMonth", "birthYear"].includes(field.key)) : create && !record ? create.fields ?? module.fields : module.fields;
  const row = record ?? create?.draft ?? draft;
  const original = edit ? row[edit.field.key] : undefined;
  const projected = edit ? create?.editorValue?.(edit.field, original) : undefined;
  const canEdit = (field: BoField) => !record && (create ? create.editable(field) : field.key === "name");
  const submit = () => {
    if (create) { void create.onCreate(); return; }
    setError(draft.name.trim() ? "Chưa thể tạo hồ sơ." : "Hãy nhập tên hồ sơ.");
  };
  return <><DrawerFrame title={record ? record.name : (create?.title ?? "Tạo " + module.label)}
    path={create?.path ?? module.label} onClose={onClose}
    footer={record && !hideDetailAction
      ? <button type="button" id="full-detail" className="primary-btn" disabled={detailLoading || Boolean(detailError)} onClick={onDetail}>↗ Full Detail</button>
      : record ? null : <><button type="button" className="secondary-btn" onClick={onClose}>Hủy</button>
        <button type="button" className="primary-btn" id="create-save" disabled={create?.busy} onClick={submit}>＋ Tạo {module.label}</button></>}>
    {moduleKey === "parents" && record
      ? <BoParentReadTabs module={module} record={record} />
      : <PropertySections variant="drawer" fields={fields} record={row}
          sections={[{ id: "properties", label: "Thuộc tính", fields: fields.map(f => f.key) }]}
          legacyStyles={legacyStyles} canEdit={canEdit}
          onEdit={(field, anchor) => setEdit({
            field: create?.editorField ? create.editorField(field) : { ...field, readonly: false }, anchor
          })} />}
    {student && <BoStudentBirthDateLocalField key={student.id + ":" + (center?.selected ?? "")} record={student} centerId={center?.selected ?? ""} readOnly />}
    {extraSection ?? (!legacyStyles && moduleKey === "workforce-assignments" && record
      ? <BoWorkforceAssignmentNoteEditor record={record} onSaved={() => window.location.reload()} /> : null)}
    {detailLoading ? <p role="status" className="settings-hint">Đang tải chi tiết…</p>
      : detailError ? <div className="edit-error" role="alert">{detailError} {onRetryDetail
        ? <button type="button" onClick={onRetryDetail}>Thử lại</button> : null}</div> : null}
    {error || create?.error ? <div className="edit-error" role="alert">{create?.error ?? error}</div> : null}
  </DrawerFrame>
  {edit ? <BoTypedEditor field={edit.field} value={projected ?? original} anchor={edit.anchor}
    onClose={() => setEdit(null)} onSave={v => {
      if (create) create.onChange(edit.field.key, projected !== undefined && v === projected ? original : v);
      else setDraft(d => ({ ...d, [edit.field.key]: v }));
      setError("");
    }} /> : null}</>;
}
