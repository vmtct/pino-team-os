"use client";

import { useEffect, useRef, useState } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import {
  validateSubjectAuditPage,
  type BoAuditSubjectType, type BoSubjectAuditEvent,
} from "@/lib/bo-subject-history";
import styles from "./BoSubjectHistory.module.css";

type HistoryState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; events: BoSubjectAuditEvent[]; nextCursor: string | null };
const errorText = (error: unknown): string =>
  error instanceof BoApiError && error.status === 403 ? "Bạn không có quyền xem lịch sử." :
  error instanceof BoApiError && error.status === 409 ? "Không thể xác minh phạm vi lịch sử của hồ sơ." :
  error instanceof BoApiError && error.status === 401 ? "Phiên đăng nhập đã hết hạn." :
  "Không thể tải lịch sử. Hãy thử lại.";

export function BoSubjectHistory({ subjectType, subjectId }: {
  subjectType: BoAuditSubjectType;
  subjectId: string;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<HistoryState>({ phase: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const ticket = ++generation.current;
    const subject = { subject_type: subjectType, subject_id: subjectId, query, limit: 50 };
    void boApi.subjectHistory(subject).then(page => {
      if (ticket !== generation.current) return;
      setHistory({ phase: "ready", ...validateSubjectAuditPage(page, subject) });
    }).catch((error: unknown) => {
      if (ticket === generation.current) setHistory({ phase: "error", message: errorText(error) });
    });
    return () => { if (generation.current === ticket) generation.current++; };
  }, [subjectType, subjectId, query, refresh]);

  async function nextPage() {
    if (loadingMore || history.phase !== "ready" || !history.nextCursor) return;
    const ticket = generation.current;
    const nextCursor = history.nextCursor;
    const prior = history.events;
    setLoadingMore(true);
    try {
      const subject = { subject_type: subjectType, subject_id: subjectId, query, cursor: nextCursor, limit: 50 };
      const page = validateSubjectAuditPage(await boApi.subjectHistory(subject), subject, prior, nextCursor);
      if (ticket === generation.current) setHistory({ phase: "ready", events: [...prior, ...page.events], nextCursor: page.nextCursor });
    } catch (error) {
      if (ticket === generation.current) setHistory({ phase: "error", message: errorText(error) });
    } finally {
      if (ticket === generation.current) setLoadingMore(false);
    }
  }
  return (
    <section className={styles.root} aria-label="Lịch Sử">
      <form className={styles.search} onSubmit={event => {
        event.preventDefault();
        if (draft.trim().length > 120) return;
        setHistory({ phase: "loading" });
        setLoadingMore(false);
        setQuery(draft.trim());
        setRefresh(n => n + 1);
      }}>
        <label htmlFor="bo-subject-history-query">Tìm trong lịch sử</label>
        <input id="bo-subject-history-query" value={draft} maxLength={120} onChange={event => setDraft(event.target.value)} />
        <button type="submit">Tìm</button>
      </form>
      {history.phase === "loading" ? <p role="status">Đang tải lịch sử…</p> : null}
      {history.phase === "error" ? <p role="alert">{history.message}</p> : null}
      {history.phase === "ready" && history.events.length === 0 ? <p role="status">Chưa có sự kiện phù hợp.</p> : null}
      {history.phase === "ready" && history.events.length > 0 ? (
        <div className={styles.rows} role="list">
          {history.events.map(event => (
            <article className={styles.row} role="listitem" key={event.id}>
              <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
              <span>{event.actor_label}</span>
              <span>{event.action}</span>
              <span className={styles.redaction} aria-label="Giá trị thay đổi được bảo vệ">— → —</span>
              <span className={styles.outcome} data-outcome={event.outcome}>{event.outcome === "succeeded" ? "Thành công" : event.outcome === "denied" ? "Bị từ chối" : "Thất bại"}</span>
            </article>
          ))}
        </div>
      ) : null}
      {history.phase === "ready" && history.nextCursor ? <button type="button" disabled={loadingMore} onClick={() => void nextPage()}>{loadingMore ? "Đang tải…" : "Xem thêm"}</button> : null}
    </section>
  );
}
