"use client";

import { useCallback, useRef, useState } from "react";
import { operatorPresentationClient, type OperatorQueue } from "@/app/pinoria-tv/operator-presentation-client";
import { isCurrentOperatorQueueResponse, matchesInspectedPresentation } from "./operator-queue-response";

/**
 * PAP-665 bounded operator view. Explicit manual refresh only; no TV relay,
 * claim, complete, command dispatch, auto-polling or client-side role grants.
 * Core TOS ACL remains authoritative for every read.
 */
export function TvOperatorQueue() {
  const [centerId, setCenterId] = useState("");
  const [queue, setQueue] = useState<OperatorQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const centerRef = useRef("");
  const [error, setError] = useState("");
  const [inspected, setInspected] = useState<{ id: string; kind: string; claimedAt: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!centerId.trim() || busy) return;
    const requestedCenter = centerId.trim();
    const requestedGeneration = ++generation.current;
    setBusy(true);
    setError("");
    setQueue(null);
    try {
      const response = await operatorPresentationClient.queue(requestedCenter);
      if (isCurrentOperatorQueueResponse(requestedCenter, requestedGeneration, centerRef.current, generation.current)) setQueue(response);
    } catch (cause) {
      if (isCurrentOperatorQueueResponse(requestedCenter, requestedGeneration, centerRef.current, generation.current)) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách trình chiếu");
    } finally {
      if (requestedGeneration === generation.current) setBusy(false);
    }
  }, [centerId, busy]);
  const inspectCurrent = useCallback(async () => {
    const active = queue?.current;
    if (!active || busy) return;
    const center = centerId.trim();
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setInspected(null);
    try {
      const current = await operatorPresentationClient.inspectSnapshot(center, active.id);
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current) &&
          matchesInspectedPresentation(active, current)) {
        // Do not display the private projection on an operator/shared screen.
        setInspected({ id: current.id, kind: current.kind, claimedAt: current.claimedAt });
      }
    } catch (cause) {
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setError(cause instanceof Error ? cause.message : "Không thể xác minh presentation");
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }, [queue, centerId, busy]);
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
            generation.current += 1;
            centerRef.current = event.target.value.trim();
            setBusy(false);
            setCenterId(event.target.value);
            setError("");
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
            {queue.current ? <div className="space-y-2"><p>{queue.current.kind} · {queue.current.id}</p><button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void inspectCurrent()}>Xem snapshot (quyền xem)</button>{inspected && <p className="text-sm">Đã xác minh: {inspected.kind} · {inspected.id} · {inspected.claimedAt}</p>}</div> : <p>Không có presentation đang chạy.</p>}
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
