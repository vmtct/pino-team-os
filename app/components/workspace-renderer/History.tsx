"use client";
import { useCallback, useState } from "react";
import { allows, loadHistory, type AuthorizationContext, type FieldSchema, type HistoryResult, type HistorySubject, type ModuleSchema } from "@/lib/workspace-schema";
import { auditActionLabel } from "@/lib/bo-registration";
import { useResource } from "./useResource";

export function HistoryState({ value, onNext, fields = [] }: { readonly value: HistoryResult; readonly onNext?: (cursor: string) => void; readonly fields?: readonly Pick<FieldSchema, "key" | "label">[] }) {
  const format = (value: unknown) => value == null ? "—" : Array.isArray(value) ? value.join(", ") : String(value);
  if (value.status === "denied") return <p className="v24-audit-empty" role="status">Không có quyền xem lịch sử.</p>;
  if (value.status === "unavailable") return <p className="v24-audit-empty" role="status">{value.reason}</p>;
  return <section aria-label="Lịch sử"><div className="v25-audit-list" role="list">{value.events.length ? value.events.map(event => {
    const date = new Date(event.at);
    return <article className="v25-audit-row" role="listitem" data-audit-subject={event.subject.id} key={event.id}>
      <div className="v25-audit-when"><strong><time dateTime={event.at}>{date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" })}</time></strong><span>{date.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}</span></div>
      <div className="v25-audit-who"><span className="v25-person-marker" aria-hidden="true">♙</span><span>{event.actor}</span></div>
      <div className="v25-audit-action"><strong>{auditActionLabel(event.action)}</strong><span>{event.source}</span></div>
      <div className="v25-audit-changes">{event.changes?.length ? event.changes.map(change => <div key={change.field}><span className="v25-audit-field">{fields.find(f => f.key === change.field)?.label ?? "Thông tin được bảo vệ"}</span><div className="v25-change-flow"><span>{format(change.before)}</span><em>→</em><strong>{format(change.after)}</strong></div></div>) : <><span className="v25-audit-field">Thông tin được bảo vệ</span><div className="v25-change-flow" aria-label="Giá trị thay đổi được bảo vệ"><span>—</span><em>→</em><strong>—</strong></div></>}</div>
      <span className="v25-audit-outcome">{event.outcome === "succeeded" ? "Thành công" : event.outcome === "denied" ? "Bị từ chối" : "Thất bại"}</span>
    </article>;
  }) : <p className="v24-audit-empty" role="status">Chưa có sự kiện lịch sử được phép xem.</p>}</div>{value.nextCursor && onNext ? <button type="button" className="toolbar-button" onClick={() => onNext(value.nextCursor!)}>Trang lịch sử tiếp</button> : null}</section>;
}
function HistoryRequest({ schema, context, subject }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly subject: HistorySubject }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => loadHistory(schema, subject, context, signal, cursor), [schema, subject, context, cursor]);
  const { result, retry } = useResource(load);
  if (result.status === "loading") return <p role="status" className="v24-audit-empty">Đang tải lịch sử…</p>;
  if (result.status === "error") return <div role="alert" className="v24-audit-empty">Không thể tải lịch sử. <button type="button" onClick={retry}>Thử lại</button></div>;
  return <HistoryState value={result.value} onNext={setCursor} fields={schema.fields} />;
}
export function TddHistory({ schema, context, subject }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly subject: HistorySubject }) {
  if (!allows(schema, context, "read")) return <HistoryState value={{ status: "denied" }} />;
  const binding = schema.detail.history;
  if (binding.kind === "unavailable") return <HistoryState value={{ status: "unavailable", reason: binding.reason }} />;
  if (!allows(schema, context, "history") || !context.authorize(binding.source.permission)) return <HistoryState value={{ status: "denied" }} />;
  return <HistoryRequest schema={schema} context={context} subject={subject} />;
}
