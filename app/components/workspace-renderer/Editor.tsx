"use client";
import { useEffect, useRef, useState } from "react";
import { BoTypedEditor } from "../../bo/components/registration/BoTypedEditor";
import { allowsField, fieldValueErrors, type AuthorizationContext, type FieldSchema, type ModuleRow, type ModuleSchema, type MutationAdapter } from "@/lib/workspace-schema";
import type { BoField, BoValue } from "@/lib/bo-registration";
import { latestRequest } from "./resource";
import { writeProperty } from "./editing";

export type TddWrites<F extends readonly FieldSchema[]> = { readonly adapter: MutationAdapter<F>; readonly version: string; readonly onSaved: (record: ModuleRow<F>, version: string) => void };
export function PropertyEditor<F extends readonly FieldSchema[]>({ schema, context, record, writes, selection, onClose }: {
  readonly schema: ModuleSchema<F>; readonly context: AuthorizationContext; readonly record: ModuleRow<F>;
  readonly writes: TddWrites<F>; readonly selection: { readonly field: BoField; readonly anchor: HTMLElement }; readonly onClose: () => void;
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<{ context: AuthorizationContext; version: string } | null>(null);
  const saving = pending?.context === context && pending.version === writes.version;
  const request = useRef(latestRequest<Awaited<ReturnType<MutationAdapter<F>["update"]>>>());
  useEffect(() => { const current = request.current; return () => current.cancel(); }, [schema, context, record.id, writes.version, writes.adapter]);
  const metadata = schema.fields.find(f => f.key === selection.field.key);
  if (!metadata || !writes.version.trim() || !allowsField(schema, context, metadata.key, "inlineEdit")) return null;
  const save = (value: BoValue) => {
    if (saving || !allowsField(schema, context, metadata.key, "inlineEdit")) return;
    if (fieldValueErrors(metadata, value).length) { setStatus("Giá trị chưa hợp lệ."); return; }
    setPending({ context, version: writes.version });
    void request.current.run(signal => writeProperty(schema, context, record, metadata.key, value, writes.version, writes.adapter, signal), result => {
      setPending(null);
      if (result.status === "saved" && result.row.id === record.id && result.version.trim()) { writes.onSaved(result.row, result.version); onClose(); }
      else setStatus(result.status === "conflict" ? "Bản ghi đã thay đổi. Tải lại trước khi lưu." : result.status === "denied" ? "Không có quyền lưu." : "Không thể lưu giá trị.");
    }, () => { setPending(null); setStatus("Không thể lưu. Thử lại sau."); });
  };
  return <>{saving ? <p role="status">Đang lưu…</p> : <BoTypedEditor closeOnSave={false} field={{ ...selection.field, readonly: false }} value={record[metadata.key as keyof ModuleRow<F>] as BoValue} anchor={selection.anchor} onClose={onClose} onSave={save} />}{status ? <p role="alert">{status}</p> : null}</>;
}
