"use client";
import { useEffect, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import { validateSubjectAuditPage, type BoAuditSubjectType, type BoSubjectAuditEvent } from "@/lib/bo-subject-history";
import { auditActionLabel, norm } from "@/lib/bo-registration";
/** Load only the selected subject. Global access/audit is never a history source. */
export function BoRegistrationHistory({ subjectType, subjectId }: { subjectType: BoAuditSubjectType; subjectId: string }) {
  const [events, setEvents] = useState<BoSubjectAuditEvent[] | null>(null), [error, setError] = useState(""), [query, setQuery] = useState(""), [page, setPage] = useState(1);
  useEffect(() => {
    let current = true;
    void (async () => {
      const found: BoSubjectAuditEvent[] = [], cursors = new Set<string>(); let cursor: string | null = null;
      // Bounded stable Core paging, whole response validation, no cross-subject filtering.
      for (let n = 0; n < 100; n++) {
        const subject = { subject_type: subjectType, subject_id: subjectId, cursor, limit: 50 };
        const result = validateSubjectAuditPage(await boApi.subjectHistory(subject), subject, found, cursor);
        if (!current) return;
        found.push(...result.events);
        if (!result.nextCursor) { setEvents(found); return; }
        if (cursors.has(result.nextCursor)) throw Error("cursor");
        cursors.add(result.nextCursor); cursor = result.nextCursor;
      }
      throw Error("bound");
    })().catch((e: unknown) => { if (current) { setEvents(null); setError(e instanceof BoApiError && e.status === 403 ? "Bạn không có quyền xem lịch sử." : e instanceof BoApiError && e.status === 409 ? "Không thể xác minh lịch sử của hồ sơ." : e instanceof BoApiError && e.status === 401 ? "Phiên đăng nhập đã hết hạn." : "Không thể tải lịch sử. Hãy thử lại."); } });
    return () => { current = false; };
  }, [subjectType, subjectId]);
  const filtered = events?.filter(e => norm(auditActionLabel(e.action) + " " + e.actor_label).includes(norm(query))) ?? [];
  return <><label className="v24-history-filter v25-history-filter">⌕ <input id="v24-history-search" type="search" aria-label="Tìm lịch sử hồ sơ" placeholder="Tìm hành động hoặc người thực hiện..." maxLength={120} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label>
    <div className="v25-audit-list" role="list" id="v24-history-events">{error ? <div className="v24-audit-empty" role="alert">{error}</div> : events === null ? <div className="v24-audit-empty" role="status">Đang tải lịch sử…</div> : !filtered.length ? <div className="v24-audit-empty">Không có sự kiện phù hợp.</div> : filtered.slice(0, page * 50).map(event => {
      const date = new Date(event.occurred_at);
      return <article className="v25-audit-row" role="listitem" data-audit-subject={event.subject_id} key={event.id}><div className="v25-audit-when"><strong>{date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</strong><span>{date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div><div className="v25-audit-who"><span className="v25-person-marker">♙</span><span>{event.actor_label}</span></div><div className="v25-audit-action"><strong>{auditActionLabel(event.action)}</strong></div><div className="v25-audit-changes"><span className="v25-audit-field">Thông tin được bảo vệ</span><div className="v25-change-flow" aria-label="Giá trị thay đổi được bảo vệ"><span>—</span><em>→</em><strong>—</strong></div></div><span className="v25-audit-outcome">{event.outcome === "succeeded" ? "Thành công" : event.outcome === "denied" ? "Bị từ chối" : "Thất bại"}</span></article>;
    })}</div>{filtered.length > page * 50 ? <button type="button" className="toolbar-button" onClick={() => setPage(p => p + 1)}>Xem thêm</button> : null}</>;
}
