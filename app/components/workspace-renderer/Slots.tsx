"use client";
import { Children, Fragment, Suspense, isValidElement, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BoDataTable } from "../../bo/components/registration/BoDataTable";
import { BoValue } from "../../bo/components/registration/BoValue";
import type { BoRecord } from "@/lib/bo-registration";
import type { AuthorizationContext, BusinessSlot, ModuleSchema } from "@/lib/workspace-schema";
import { allows } from "@/lib/workspace-schema";
import { PropertySections } from "./Properties";
import { recordProjection } from "./projection";
import { useResource } from "./useResource";
import { latestRequest } from "./resource";

export const BusinessDataGrid = lazy(async () => ({ default: (await import("../../bo/components/data-grid/BoDataGrid")).BoDataGrid })) as unknown as typeof import("../../bo/components/data-grid/BoDataGrid").BoDataGrid;

export type BusinessFormValue = string | number | null;
export type BusinessFormField = {
  readonly key: string; readonly label: string; readonly type: "number" | "text" | "date" | "textarea";
  readonly required?: boolean; readonly hint?: string;
};
export type BusinessFormColumn = { readonly key: string; readonly label: string; readonly type: BusinessFormField["type"] };
export type BusinessFormData =
  | { readonly status: "denied" }
  | { readonly status: "authorized"; readonly fields: readonly BusinessFormField[]; readonly values: Readonly<Record<string, BusinessFormValue>>; readonly records?: { readonly label: string; readonly columns: readonly BusinessFormColumn[]; readonly rows: readonly { readonly id: string; readonly values: Readonly<Record<string, BusinessFormValue>> }[] } };
export type BusinessFormSubmitResult =
  | { readonly status: "saved"; readonly message?: string }
  | { readonly status: "denied" }
  | { readonly status: "invalid"; readonly fields: readonly string[] };
export type BusinessFormRequest = {
  readonly surface: "BO" | "HO"; readonly moduleKey: string; readonly slotId: string; readonly sourceAdapter: string;
  readonly recordId: string; readonly subject: { readonly type: string; readonly id: string }; readonly principalId: string;
  readonly context: AuthorizationContext;
};
export type BusinessFormProvider = {
  readonly presentation?: { readonly heading?: string; readonly actionLabel?: string; readonly compact?: boolean; readonly hideRecordsToolbar?: boolean };
  readonly surface: "BO" | "HO"; readonly moduleKey: string; readonly slotId: string; readonly sourceAdapter: string;
  readonly load: (request: BusinessFormRequest, signal: AbortSignal) => Promise<BusinessFormData>;
  readonly submit: (request: BusinessFormRequest, values: Readonly<Record<string, BusinessFormValue>>, signal: AbortSignal) => Promise<BusinessFormSubmitResult>;
};
export type BusinessFormBinding = { readonly providers: readonly BusinessFormProvider[]; readonly principalId: string; readonly subject: { readonly type: string; readonly id: string } };

function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value); }
function formValue(type: BusinessFormField["type"], value: unknown): value is BusinessFormValue {
  if (value === null) return true;
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof value !== "string") return false;
  return type !== "date" || /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function resolveBusinessFormProvider(schema: ModuleSchema, slot: BusinessSlot<string>, binding?: BusinessFormBinding): BusinessFormProvider | null {
  if (slot.kind !== "form" || !binding || !identifier(binding.principalId) || binding.subject.id === "" || !identifier(binding.subject.id) || !identifier(binding.subject.type)) return null;
  const matches = binding.providers.filter(provider => provider.surface === schema.surface && provider.moduleKey === schema.key && provider.slotId === slot.id && provider.sourceAdapter === slot.source.adapter);
  return matches.length === 1 ? matches[0] : null;
}
export function validateBusinessFormData(value: BusinessFormData, allowedFields?: readonly string[]): BusinessFormData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("TDD business form: invalid response");
  if (value.status === "denied") {
    if (Object.keys(value).some(key => key !== "status")) throw Error("TDD business form: denied payload");
    return value;
  }
  if (value.status !== "authorized" || !Array.isArray(value.fields) || !value.fields.length || !value.values || typeof value.values !== "object" || Array.isArray(value.values)) throw Error("TDD business form: invalid authorized response");
  const keys = new Set<string>();
  for (const field of value.fields) {
    if (!field || Object.keys(field).some(key => !["key", "label", "type", "required", "hint"].includes(key)) || !identifier(field.key) || !field.label?.trim() || !["number", "text", "date", "textarea"].includes(field.type) || keys.has(field.key) || (field.required !== undefined && typeof field.required !== "boolean") || (field.hint !== undefined && typeof field.hint !== "string")) throw Error("TDD business form: invalid field");
    keys.add(field.key);
    if (!Object.hasOwn(value.values, field.key) || !formValue(field.type, value.values[field.key])) throw Error("TDD business form: invalid field value");
  }
  if (Object.keys(value.values).some(key => !keys.has(key))) throw Error("TDD business form: unregistered value");
  if (allowedFields && (allowedFields.length !== keys.size || allowedFields.some(key => !keys.has(key)))) throw Error("TDD business form: field allowlist mismatch");
  if (value.records) {
    if (!value.records.label?.trim() || !Array.isArray(value.records.columns) || !value.records.columns.length || !Array.isArray(value.records.rows)) throw Error("TDD business form: invalid records");
    const columns = new Set<string>();
    for (const column of value.records.columns) {
      if (!column || Object.keys(column).some(key => !["key", "label", "type"].includes(key)) || !identifier(column.key) || !column.label?.trim() || !["number", "text", "date", "textarea"].includes(column.type) || columns.has(column.key)) throw Error("TDD business form: invalid column");
      columns.add(column.key);
    }
    const rowIds = new Set<string>();
    for (const row of value.records.rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["id", "values"].includes(key)) || !identifier(row.id) || rowIds.has(row.id) || !row.values || typeof row.values !== "object" || Array.isArray(row.values) || Object.keys(row.values).some(key => !columns.has(key))) throw Error("TDD business form: invalid record");
      rowIds.add(row.id);
      for (const column of value.records.columns) if (!Object.hasOwn(row.values, column.key) || !formValue(column.type, row.values[column.key])) throw Error("TDD business form: invalid record value");
    }
  }
  return value;
}
export function validateBusinessFormSubmitResult(value: BusinessFormSubmitResult, fields: readonly BusinessFormField[]): BusinessFormSubmitResult {
  if (!value || typeof value !== "object" || Array.isArray(value) || !["saved", "denied", "invalid"].includes(value.status)) throw Error("TDD business form: invalid submit response");
  if (value.status === "saved") {
    if (Object.keys(value).some(key => !["status", "message"].includes(key)) || (value.message !== undefined && (typeof value.message !== "string" || !value.message.trim()))) throw Error("TDD business form: invalid saved response");
  } else if (value.status === "denied") {
    if (Object.keys(value).some(key => key !== "status")) throw Error("TDD business form: denied submit payload");
  } else {
    if (Object.keys(value).some(key => !["status", "fields"].includes(key)) || !Array.isArray(value.fields) || new Set(value.fields).size !== value.fields.length || value.fields.some(key => !fields.some(field => field.key === key))) throw Error("TDD business form: invalid submit fields");
  }
  return value;
}

export type SlotLoaders = Readonly<Record<string, (slot: BusinessSlot<string>, record: BoRecord, context: AuthorizationContext, signal: AbortSignal) => Promise<ReactNode>>>;
/** Content-only bindings use DS primitives, never another shell or opaque component. */
export function checkedSlotContent(content: ReactNode): ReactNode {
  Children.forEach(content, node => {
    if (!isValidElement(node)) return;
    if (typeof node.type !== "string" && ![Fragment, BoDataTable, BusinessDataGrid, BoValue, PropertySections].includes(node.type as typeof Fragment)) throw Error("Unapproved business content component");
    const props = node.props as { className?: string; id?: string; role?: string; children?: ReactNode; style?: unknown; dangerouslySetInnerHTML?: unknown; "data-tdd-shell"?: unknown };
    if (["style", "script", "iframe", "object"].includes(String(node.type)) || props.style !== undefined || props.dangerouslySetInnerHTML !== undefined ||
      /(?:^|\s)(?:detail-(?:cover|hero[\w-]*|tabs?|main|panel)|drawer[\w-]*|bo-full-detail|v25-full-width)(?:\s|$)/.test(props.className ?? "") ||
      ["tab", "tablist", "tabpanel", "dialog"].includes(props.role ?? "") || /^(?:detail-(?:screen|body|title|tabs?)|drawer)(?:-|$)/.test(props.id ?? "") || props["data-tdd-shell"] !== undefined) throw Error("Business content cannot own a TDD shell");
    const inspect = (value: unknown) => { if (isValidElement(value)) checkedSlotContent(value); else if (Array.isArray(value)) value.forEach(inspect); };
    Object.values(props).forEach(inspect);
  });
  return content;
}
function SlotRequest({ load, approvedExtension = false }: { readonly load: (signal: AbortSignal) => Promise<ReactNode>; readonly approvedExtension?: boolean }) {
  const { result, retry } = useResource(load);
  if (result.status === "loading") return <p role="status">Đang tải nội dung…</p>;
  if (result.status === "error") return <div role="alert">Không thể tải nội dung. <button type="button" onClick={retry}>Thử lại</button></div>;
  return <>{approvedExtension ? result.value : checkedSlotContent(result.value)}</>;
}
export function BusinessPanel({ schema, context, record, slot, loaders }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly record: BoRecord; readonly slot: BusinessSlot<string>; readonly loaders?: SlotLoaders }) {
  const provider = loaders?.[slot.source.adapter];
  const load = useCallback(async (signal: AbortSignal) => {
    const content = await provider!(slot, record, context, signal);
    // The TddRegistry verified this exact approved-extension contract at module admission.
    // Other business slots still use the strict inert-content validator.
    return slot.kind === "approved-extension" ? content : checkedSlotContent(content);
  }, [provider, slot, record, context]);
  if (!allows(schema, context, "read") || !context.authorize(slot.source.permission)) return <p role="status">Không có quyền xem nội dung.</p>;
  const projection = recordProjection(schema, context, record);
  if (!projection) return <p role="status">Không có quyền xem nội dung.</p>;
  if (slot.kind === "field-group") return <PropertySections variant="detail" fields={projection.fields} record={projection.record} sections={slot.sections} />;
  if (slot.kind === "form") return <p className="v24-audit-empty" role="status">Biểu mẫu chưa được liên kết.</p>;
  if (!provider) return <p className="v24-audit-empty" role="status">Nội dung chưa khả dụng.</p>;
  return <SlotRequest load={load} approvedExtension={slot.kind === "approved-extension"} />;
}

function BusinessRecords({ records, hideToolbar = false }: { readonly records: NonNullable<Extract<BusinessFormData, { status: "authorized" }>["records"]>; readonly hideToolbar?: boolean }) {
  const columns = records.columns.map(column => ({ key: column.key, header: column.label, render: (row: (typeof records.rows)[number]) => row.values[column.key] === null || row.values[column.key] === "" ? "—" : String(row.values[column.key]) }));
  return <section className="v24-prop-section"><h3>{records.label}</h3><Suspense fallback={<p role="status">Đang tải lịch sử…</p>}><BusinessDataGrid rows={records.rows} columns={columns} rowKey={row => row.id} caption={records.label} showToolbar={!hideToolbar} emptyTitle="Chưa có bản ghi" emptyMessage="Chưa có lịch sử được cấp quyền cho bản ghi này." /></Suspense></section>;
}
export function BusinessFormPanel({ schema, context, record, slot, binding }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly record: BoRecord; readonly slot: Extract<BusinessSlot<string>, { kind: "form" }>; readonly binding?: BusinessFormBinding }) {
  const provider = resolveBusinessFormProvider(schema, slot, binding);
  const presentation = provider?.presentation;
  const canRead = allows(schema, context, "read") && context.authorize(slot.source.permission);
  const canSubmit = canRead && context.authorize(slot.submitPermission);
  const request = useMemo<BusinessFormRequest | null>(() => provider && binding && identifier(record.id) && binding.subject.id === record.id ? { surface: schema.surface, moduleKey: schema.key, slotId: slot.id, sourceAdapter: slot.source.adapter, recordId: record.id, subject: binding.subject, principalId: binding.principalId, context } : null, [provider, binding, record.id, schema.surface, schema.key, slot.id, slot.source.adapter, context]);
  const loadRequest = useRef(latestRequest<BusinessFormData>()), submitRequest = useRef(latestRequest<BusinessFormSubmitResult>());
  const [generation, setGeneration] = useState(0);
  const [loaded, setLoaded] = useState<{ readonly request: BusinessFormRequest; readonly generation: number; readonly data?: BusinessFormData; readonly error?: true } | null>(null);
  const [values, setValues] = useState<Readonly<Record<string, BusinessFormValue>>>({});
  const [submitted, setSubmitted] = useState<{ readonly request: BusinessFormRequest; readonly generation: number; readonly status: "pending" | "error" | "saved" | "denied" | "invalid" } | null>(null);
  useEffect(() => {
    const load = loadRequest.current, submit = submitRequest.current;
    if (!canRead || !provider || !request) return () => { load.cancel(); submit.cancel(); };
    void load.run(signal => provider.load(request, signal).then(result => validateBusinessFormData(result, slot.fields)), result => {
      if (!allows(schema, context, "read") || !context.authorize(slot.source.permission)) { setLoaded({ request, generation, data: { status: "denied" } }); setValues({}); return; }
      setLoaded({ request, generation, data: result }); if (result.status === "authorized") setValues({ ...result.values });
    }, () => setLoaded({ request, generation, error: true }));
    return () => { load.cancel(); submit.cancel(); };
  }, [canRead, provider, request, generation, schema, context, slot.fields, slot.source.permission]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { loadRequest.current.cancel(); submitRequest.current.cancel(); setLoaded(null); setValues({}); setSubmitted(null); }
      else setGeneration(value => value + 1);
    };
    document.addEventListener("visibilitychange", onVisibility); return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const current = loaded?.request === request && loaded.generation === generation ? loaded : null;
  const data = current?.data;
  const submitState = submitted?.request === request && submitted.generation === generation ? submitted.status : "idle";
  if (!canRead) return <p role="status">Không có quyền xem nội dung.</p>;
  if (!provider || !request) return <p className="v24-audit-empty" role="status">Biểu mẫu chưa khả dụng.</p>;
  if (current?.error) return <div role="alert">Không thể tải biểu mẫu. <button type="button" onClick={() => setGeneration(value => value + 1)}>Thử lại</button></div>;
  if (!data) return <p role="status">Đang tải biểu mẫu…</p>;
  if (data.status === "denied") return <p role="status">Không có quyền xem nội dung.</p>;
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!canSubmit || !context.authorize(slot.submitPermission)) return;
    setSubmitted({ request, generation, status: "pending" }); void submitRequest.current.run(signal => provider.submit(request, values, signal).then(result => validateBusinessFormSubmitResult(result, data.fields)), result => {
      if (!context.authorize(slot.submitPermission)) { setSubmitted({ request, generation, status: "denied" }); return; }
      setSubmitted({ request, generation, status: result.status });
      if (result.status === "saved") {
        // POST acknowledgement is not the source of history truth: re-read the
        // same authorized record before displaying its updated private ledger.
        void loadRequest.current.run(signal => provider.load(request, signal).then(value => validateBusinessFormData(value, slot.fields)), fresh => {
          if (!allows(schema, context, "read") || !context.authorize(slot.source.permission)) {
            setLoaded({ request, generation, data: { status: "denied" } }); setValues({}); return;
          }
          setLoaded({ request, generation, data: fresh });
          if (fresh.status === "authorized") setValues({ ...fresh.values });
        }, () => setLoaded({ request, generation, error: true }));
      }
    }, () => setSubmitted({ request, generation, status: "error" }));
  };
  const content = <><form className={presentation?.compact ? "v24-prop-section pds-business-compact-form" : "v24-prop-section"} aria-label={presentation?.heading ?? slot.label} onSubmit={submit}><h3>{presentation?.heading ?? slot.label}</h3>{data.fields.map(field => <label className="property-row" key={field.key}><span>{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <textarea required={field.required} value={String(values[field.key] ?? "")} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} /> : <input type={field.type} required={field.required} value={values[field.key] ?? ""} onChange={event => setValues(current => ({ ...current, [field.key]: field.type === "number" ? event.target.value === "" ? null : Number(event.target.value) : event.target.value }))} />}{field.hint ? <small>{field.hint}</small> : null}</label>)}
    {canSubmit ? <button className="primary-btn" type="submit" disabled={submitState === "pending"}>{submitState === "pending" ? "Đang lưu…" : (presentation?.actionLabel ?? "Lưu")}</button> : <p role="status">Bạn chỉ có quyền xem biểu mẫu.</p>}
    {submitState === "error" ? <p role="alert">Không thể lưu. Thử lại sau.</p> : submitState === "saved" ? <p role="status">Đã lưu thành công.</p> : submitState === "denied" ? <p role="status">Không có quyền lưu.</p> : submitState === "invalid" ? <p role="alert">Dữ liệu chưa hợp lệ.</p> : null}</form>{data.records ? <BusinessRecords records={data.records} hideToolbar={presentation?.hideRecordsToolbar} /> : null}</>;
  return presentation?.compact ? <div className="pds-business-compact-workspace" data-tdd-business-slot={slot.id}>{content}</div> : content;
}
