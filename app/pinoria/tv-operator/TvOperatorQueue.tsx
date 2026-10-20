"use client";

import { useCallback, useRef, useState } from "react";
import { operatorPresentationClient, type OperatorQueue } from "@/app/pinoria-tv/operator-presentation-client";
import { isCurrentOperatorQueueResponse, matchesInspectedPresentation, isConfirmedPresentationRelease } from "./operator-queue-response";

/**
 * PAP-665 bounded operator view. Explicit manual refresh only; no TV relay,
 * claim, complete, auto-polling or client-side role grants.
 * Core TOS ACL remains authoritative for every read.
 */
export function TvOperatorQueue() {
  const [centerId, setCenterId] = useState("");
  const [replayDisplayId, setReplayDisplayId] = useState("");
  const [queue, setQueue] = useState<OperatorQueue | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  // Synchronous fence: React busy state alone does not stop rapid double-clicks.
  const commandInFlight = useRef(false);
  const centerRef = useRef("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inspected, setInspected] = useState<{ id: string; kind: string; claimedAt: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!centerId.trim() || busy || commandInFlight.current) return;
    const requestedCenter = centerId.trim();
    const requestedGeneration = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
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
    if (!active || busy || commandInFlight.current) return;
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
  const replayInspect = useCallback(async () => {
    const active = queue?.current;
    const center = centerId.trim();
    if (!active || !center || busy || commandInFlight.current) return;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    setInspected(null);
    try {
      const snapshot = await operatorPresentationClient.replaySnapshotInspect(center, active.id);
      if (!isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) return;
      if (!matchesInspectedPresentation(active, snapshot)) {
        throw new Error("Snapshot không còn khớp presentation đang chạy; tải lại queue.");
      }
      setInspected({ id: snapshot.id, kind: snapshot.kind, claimedAt: snapshot.claimedAt });
      setMessage("Đã xác minh snapshot replay tại Core; chưa phát lại trên TV vật lý.");
    } catch (cause) {
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setQueue(null);
        setError(cause instanceof Error ? cause.message : "Không thể xác minh replay snapshot");
      }
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }, [queue, centerId, busy]);
  const dispatchReplay = useCallback(async () => {
    const active = queue?.current;
    const center = centerId.trim();
    const displayId = replayDisplayId.trim();
    if (!active || !center || !displayId || busy || commandInFlight.current) return;
    if (!("randomUUID" in crypto) || typeof crypto.randomUUID !== "function") {
      setError("Không thể tạo khóa idempotency an toàn trên browser này.");
      return;
    }
    commandInFlight.current = true;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const target = await operatorPresentationClient.replayTarget(center, displayId, active.id);
      if (!isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) return;
      if (!target.available || target.target?.displayId !== displayId || !target.target.deviceId) {
        throw new Error("TV đích chưa có phiên hoạt động hợp lệ; không gửi replay.");
      }
      if (!window.confirm(`Phát lại ${active.id} trên TV ${displayId}?`)) return;
      await operatorPresentationClient.replayDispatch(center, displayId, active.id, crypto.randomUUID());
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setMessage("Core đã nhận replay dispatch; chưa có xác nhận TV vật lý đã render.");
      }
    } catch (cause) {
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setQueue(null);
        setError(cause instanceof Error ? cause.message : "Không thể gửi replay; tải lại queue.");
      }
    } finally {
      commandInFlight.current = false;
      setBusy(false);
    }
  }, [queue, centerId, replayDisplayId, busy]);  const executeCommand = useCallback(async (action: "close" | "return-to-ambient") => {
    const active = queue?.current;
    const center = centerId.trim();
    if (!active || !center || busy || commandInFlight.current || !active.claimedAt) return;
    const verb = action === "close" ? "Đóng presentation" : "Trở về Ambient";
    if (!window.confirm(verb + " " + active.id + "? Core sẽ giải phóng presentation. Không đảm bảo TV vật lý đã chuyển cảnh.")) return;
    if (!("randomUUID" in crypto) || typeof crypto.randomUUID !== "function") {
      setError("Không thể tạo khóa idempotency an toàn trên browser này.");
      return;
    }
    commandInFlight.current = true;
    const version = ++generation.current;
    const receiptKey = crypto.randomUUID();
    setBusy(true);
    setError("");
    setMessage("");
    setInspected(null);
    try {
      const command = action === "close" ? operatorPresentationClient.close : operatorPresentationClient.returnToAmbient;
      const receipt = await command(center, active.id, active.claimedAt, receiptKey);
      if (!isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) return;
      // Read-after-write from canonical Core. Never synthesize the next queue locally.
      const fresh = await operatorPresentationClient.queue(center);
      if (!isConfirmedPresentationRelease(active.id, receipt, fresh)) {
        throw new Error("Core chưa xác nhận presentation đã được giải phóng; hãy tải lại hàng đợi.");
      }
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setQueue(fresh);
        setMessage(verb + ": Core đã ghi receipt và giải phóng queue. Trạng thái hình ảnh TV chưa được xác nhận.");
      }
    } catch (cause) {
      if (isCurrentOperatorQueueResponse(center, version, centerRef.current, generation.current)) {
        setQueue(null); // Force fresh authoritative read before allowing another action.
        setError(cause instanceof Error ? cause.message : "Không thể điều khiển presentation");
      }
    } finally {
      commandInFlight.current = false;
      // A Center switch may invalidate the result, but must not strand the UI in busy state.
      setBusy(false);
    }
  }, [queue, centerId, busy]);
  return (
    <section aria-label="TV operator queue" className="mx-auto max-w-3xl space-y-4 p-5">
      <header>
        <h1 className="text-xl font-semibold">Điều khiển TV · Hàng đợi</h1>
        <p className="text-sm opacity-70">Xem queue và thực hiện lệnh Close/Return-to-Ambient có phân quyền tại Core. Các lệnh không chạy lại nghiệp vụ và chưa xác nhận TV vật lý đã chuyển cảnh.</p>
      </header>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void refresh(); }}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Center ID
          <input aria-label="Center ID" className="rounded border px-3 py-2" value={centerId} onChange={(event) => {
            generation.current += 1;
            centerRef.current = event.target.value.trim();
            if (!commandInFlight.current) setBusy(false);
            setCenterId(event.target.value);
            setError("");
            setMessage("");
            setQueue(null);
          }} required />
        </label>
        <button type="submit" disabled={busy || !centerId.trim()} className="self-end rounded border px-4 py-2 disabled:opacity-50">
          {busy ? "Đang tải…" : "Làm mới"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {queue && (
        <div className="space-y-4" aria-live="polite">
          <p className="text-sm">Revision: {queue.revision} · {queue.hasMore ? "Danh sách chỉ hiển thị 50 mục đầu" : "Đã hiển thị tất cả mục đang chờ"}</p>
          <section className="rounded border p-3">
            <h2 className="font-medium">Đang trình chiếu</h2>
            {queue.current ? <div className="space-y-2"><p>{queue.current.kind} · {queue.current.id}</p><button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void inspectCurrent()}>Xem snapshot (quyền xem)</button><button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void replayInspect()}>Kiểm tra replay snapshot (không phát TV)</button><div className="flex flex-wrap gap-2"><input aria-label="Display ID để replay" placeholder="Display ID" className="rounded border px-3 py-1" value={replayDisplayId} onChange={(event) => setReplayDisplayId(event.target.value)} /><button type="button" disabled={busy || !replayDisplayId.trim()} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void dispatchReplay()}>Phát lại trên TV</button></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void executeCommand("return-to-ambient")}>Trở về Ambient</button><button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void executeCommand("close")}>Đóng presentation</button></div>{inspected && <p className="text-sm">Đã xác minh: {inspected.kind} · {inspected.id} · {inspected.claimedAt}</p>}</div> : <p>Không có presentation đang chạy.</p>}
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
