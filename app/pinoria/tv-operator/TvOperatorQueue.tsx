"use client";

import { useCallback, useState } from "react";
import { operatorPresentationClient, type OperatorQueue } from "@/app/pinoria-tv/operator-presentation-client";

/**
 * PAP-665 bounded operator view. Explicit manual refresh only; no TV relay,
 * claim, complete, command dispatch, auto-polling or client-side role grants.
 * Core TOS ACL remains authoritative for every read.
 */
export function TvOperatorQueue() {
  const [centerId, setCenterId] = useState("");
  const [queue, setQueue] = useState<OperatorQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!centerId.trim() || busy) return;
    setBusy(true);
    setError("");
    setQueue(null);
    try {
      setQueue(await operatorPresentationClient.queue(centerId.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách trình chiếu");
    } finally {
      setBusy(false);
    }
  }, [centerId, busy]);
  return (
    <section aria-label="TV operator queue" className="mx-auto max-w-3xl space-y-4 p-5">
      <header>
        <h1 className="text-xl font-semibold">Điều khiển TV · Hàng đợi</h1>
        <p className="text-sm opacity-70">Chỉ xem trạng thái Core. Không thực thi lại sự kiện hoặc thay đổi presentation.</p>
      </header>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void refresh(); }}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Center ID
          <input aria-label="Center ID" className="rounded border px-3 py-2" value={centerId} onChange={(event) => {
            setCenterId(event.target.value);
            setQueue(null);
          }} required />
        </label>
        <button type="submit" disabled={busy || !centerId.trim()} className="self-end rounded border px-4 py-2 disabled:opacity-50">
          {busy ? "Đang tải…" : "Làm mới"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {queue && (
        <div className="space-y-4" aria-live="polite">
          <p className="text-sm">Revision: {queue.revision} · {queue.hasMore ? "Danh sách chỉ hiển thị 50 mục đầu" : "Đã hiển thị tất cả mục đang chờ"}</p>
          <section className="rounded border p-3">
            <h2 className="font-medium">Đang trình chiếu</h2>
            {queue.current ? <p>{queue.current.kind} · {queue.current.id}</p> : <p>Không có presentation đang chạy.</p>}
          </section>
          <section className="rounded border p-3">
            <h2 className="font-medium">Đang chờ ({queue.queued.length})</h2>
            {queue.queued.length ? (
              <ol className="list-inside list-decimal space-y-1">
                {queue.queued.map((item) => <li key={item.id}>{item.kind} · {item.id}</li>)}
              </ol>
            ) : <p>Hàng đợi trống.</p>}
          </section>
        </div>
      )}
    </section>
  );
}
