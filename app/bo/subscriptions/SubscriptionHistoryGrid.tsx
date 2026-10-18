"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoPathProgram, BoSubscriptionDirectoryPage } from "@/lib/bo-model";
import styles from "./subscription-history-grid.module.css";

type Cursor = { createdAt: string; id: string } | null;
type Filters = { query: string; lifecycle: string; pathProgramId: string };
const INITIAL: Filters = { query: "", lifecycle: "", pathProgramId: "" };

export function SubscriptionHistoryGrid({ paths }: { paths: BoPathProgram[] }) {
  const [draft, setDraft] = useState<Filters>(INITIAL);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [history, setHistory] = useState<Cursor[]>([null]);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<BoSubscriptionDirectoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const serial = useRef(0);

  const load = useCallback(async (nextFilters: Filters, cursor: Cursor) => {
    const current = ++serial.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await boApi.subscriptionDirectory({
        ...nextFilters,
        limit: 25,
        ...(cursor ? { beforeCreatedAt: cursor.createdAt, beforeSubscriptionId: cursor.id } : {}),
      });
      if (serial.current === current) setResult(rows);
    } catch (cause) {
      if (serial.current === current) {
        setResult(null);
        setError(cause instanceof Error ? cause.message : "Không tải được Subscription history.");
      }
    } finally {
      if (serial.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(INITIAL, null);
    return () => { serial.current++; };
  }, [load]);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const next = { ...draft, query: draft.query.trim() };
    setFilters(next);
    setHistory([null]);
    setPage(0);
    void load(next, null);
  }
  function navigate(nextPage: number, cursor: Cursor) {
    if (nextPage < 0 || loading) return;
    if (nextPage > page) setHistory((previous) => [...previous.slice(0, page + 1), cursor]);
    setPage(nextPage);
    void load(filters, cursor);
  }

  return <section className={styles.wrap} aria-label="Subscription history">
    <div className={styles.header}>
      <div><strong>Subscription history</strong><p>Canonical Core · lịch sử đăng ký và thanh toán</p></div>
      <small>{result ? result.total + " bản ghi" : loading ? "Đang tải" : "Không có kết quả"}</small>
    </div>
    <form className={styles.filters} onSubmit={apply}>
      <input aria-label="Tìm Subscription" placeholder="Học viên, mã gói, tham chiếu…" value={draft.query} onChange={(event) => setDraft({ ...draft, query: event.target.value })} />
      <select aria-label="Lifecycle" value={draft.lifecycle} onChange={(event) => setDraft({ ...draft, lifecycle: event.target.value })}>
        <option value="">Mọi trạng thái</option>
        {["DRAFT", "ACTIVE", "COMPLETED", "SUPERSEDED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
      </select>
      <select aria-label="Path" value={draft.pathProgramId} onChange={(event) => setDraft({ ...draft, pathProgramId: event.target.value })}>
        <option value="">Mọi Path</option>
        {paths.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
      </select>
      <button type="submit" disabled={loading}>Lọc</button>
    </form>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead><tr><th>Học viên</th><th>Path</th><th>Lifecycle</th><th>Buổi/tuần</th><th>Hợp đồng</th><th>Giá cuối</th><th>Units</th></tr></thead>
        <tbody>
          {result?.items.map((row) => <tr key={row.id}>
            <td><a href={"/bo/subscriptions?studentId=" + encodeURIComponent(row.studentProfileId)}>{row.studentDisplayName}</a><small>{row.id.slice(0, 8)}…</small></td>
            <td>{row.pathDisplayName}</td><td>{row.lifecycle}</td><td>{row.weeklyCommitment}</td>
            <td>{row.serviceStartsOn ?? "—"} → {row.contractualEndsOn ?? "Không cố định"}</td>
            <td>{row.finalAmountMinor == null ? "—" : row.finalAmountMinor.toLocaleString("vi-VN") + " ₫"}</td>
            <td>{row.effectiveAvailableUnits}</td>
          </tr>)}
          {!loading && !result?.items.length ? <tr><td colSpan={7}>Không tìm thấy Subscription phù hợp.</td></tr> : null}
          {loading ? <tr><td colSpan={7}>Đang tải dữ liệu…</td></tr> : null}
        </tbody>
      </table>
    </div>
    <div className={styles.pager}>
      <span>Trang {page + 1}</span>
      <button type="button" disabled={loading || page === 0} onClick={() => navigate(page - 1, history[page - 1] ?? null)}>Trước</button>
      <button type="button" disabled={loading || !result?.nextCursor} onClick={() => navigate(page + 1, result?.nextCursor ?? null)}>Sau</button>
    </div>
  </section>;
}
