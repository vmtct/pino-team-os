"use client";
import { useCallback, useState } from "react";
import { allows, loadHistory, type AuthorizationContext, type HistoryResult, type HistorySubject, type ModuleSchema } from "@/lib/workspace-schema";
import { useResource } from "./useResource";

export function HistoryState({ value, onNext }: { readonly value: HistoryResult; readonly onNext?: (cursor: string) => void }) {
  const format = (value: unknown) => value == null ? "—" : Array.isArray(value) ? value.join(", ") : String(value);
  if (value.status === "denied") return <p className="v24-audit-empty" role="status">Không có quyền xem lịch sử.</p>;
  if (value.status === "unavailable") return <p className="v24-audit-empty" role="status">{value.reason}</p>;
  return <section aria-label="Lịch sử">{value.events.length ? <ol>{value.events.map(event => <li key={event.id}><time dateTime={event.at}>{event.at}</time><span> {event.actor} · {event.action} · {event.outcome} · {event.source}</span>{event.changes?.map(change => <p key={change.field}>{change.field}: {format(change.before)} → {format(change.after)}</p>)}</li>)}</ol> : <p className="v24-audit-empty" role="status">Chưa có sự kiện lịch sử được phép xem.</p>}{value.nextCursor && onNext ? <button type="button" className="secondary-btn" onClick={() => onNext(value.nextCursor!)}>Xem thêm</button> : null}</section>;
}
function HistoryRequest({ schema, context, subject }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly subject: HistorySubject }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => loadHistory(schema, subject, context, signal, cursor), [schema, subject, context, cursor]);
  const { result, retry } = useResource(load);
  if (result.status === "loading") return <p role="status" className="v24-audit-empty">Đang tải lịch sử…</p>;
  if (result.status === "error") return <div role="alert" className="v24-audit-empty">Không thể tải lịch sử. <button type="button" onClick={retry}>Thử lại</button></div>;
  return <HistoryState value={result.value} onNext={setCursor} />;
}
export function TddHistory({ schema, context, subject }: { readonly schema: ModuleSchema; readonly context: AuthorizationContext; readonly subject: HistorySubject }) {
  if (!allows(schema, context, "read")) return <HistoryState value={{ status: "denied" }} />;
  const binding = schema.detail.history;
  if (binding.kind === "unavailable") return <HistoryState value={{ status: "unavailable", reason: binding.reason }} />;
  if (!allows(schema, context, "history") || !context.authorize(binding.source.permission)) return <HistoryState value={{ status: "denied" }} />;
  return <HistoryRequest schema={schema} context={context} subject={subject} />;
}
