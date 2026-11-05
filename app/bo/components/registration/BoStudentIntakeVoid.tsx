"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerLifecycle, BoStudentIntakeVoidResult } from "@/lib/bo-model";
import { useBoDialog } from "./useBoDialog";

type Attempt = { expectedStudentVersion: number; reason: string; idempotencyKey: string };
type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; lifecycle: BoLearnerLifecycle };

function message(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Không thể lưu trữ intake. Hãy thử lại.";
}

/** Core owns the provenance, dependency and ACL checks. This UI only sends its canonical command. */
export function BoStudentIntakeVoid({ studentId, onClose, onNeutralized }: { studentId: string; onClose: () => void; onNeutralized: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const attemptRef = useRef<Attempt | null>(null);
  const [reload, setReload] = useState(0);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [reason, setReason] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<BoStudentIntakeVoidResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canResetAttempt, setCanResetAttempt] = useState(false);
  const uncertainAttempt = attempt !== null && Boolean(error) && !canResetAttempt;

  useEffect(() => {
    let active = true;
    void boApi.learnerLifecycle(studentId).then(lifecycle => {
      if (active) setLoad({ state: "ready", lifecycle });
    }).catch((cause: unknown) => {
      if (active) setLoad({ state: "error", message: message(cause) });
    });
    return () => { active = false; };
  }, [studentId, reload]);

  function closeIfSafe() {
    if (busyRef.current || uncertainAttempt) return;
    if (result) onNeutralized(); else onClose();
  }
  useBoDialog(true, closeIfSafe, panel);

  function resetAttempt() {
    attemptRef.current = null;
    setAttempt(null);
    setCanResetAttempt(false);
    setError("");
    setLoad({ state: "loading" });
    setReload(value => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || result || load.state !== "ready") return;
    if (!attemptRef.current && reason.trim().length < 3) {
      setError("Hãy nhập lý do ít nhất 3 ký tự.");
      return;
    }
    const currentAttempt = attemptRef.current ?? {
      expectedStudentVersion: load.lifecycle.student.version,
      reason: reason.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    attemptRef.current = currentAttempt;
    setAttempt(currentAttempt);
    busyRef.current = true;
    setBusy(true);
    setError("");
    setCanResetAttempt(false);
    try {
      const value = await boApi.voidStudentIntake(studentId, { expectedStudentVersion: currentAttempt.expectedStudentVersion, reason: currentAttempt.reason }, currentAttempt.idempotencyKey);
      setResult(value);
    } catch (cause) {
      setError(message(cause));
      setCanResetAttempt(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const parentDisposition = result?.parentDisposition === "ARCHIVED"
    ? "Parent/contact do intake này tạo riêng đã được lưu trữ."
    : result?.parentDisposition === "REUSED_UNCHANGED"
      ? "Parent được reuse được giữ nguyên."
      : "Parent/contact có liên kết khác được giữ nguyên.";

  return <><div className="drawer-scrim visible" onClick={closeIfSafe} aria-hidden="true" />
    <aside ref={panel} className="drawer open" role="dialog" aria-modal="true" aria-labelledby="student-void-title">
      <div className="drawer-top"><div className="drawer-header-copy"><span className="drawer-path">Students</span><h2 id="student-void-title" className="drawer-record-title">Lưu trữ intake</h2></div><button className="drawer-close" type="button" aria-label="Đóng" disabled={busy || uncertainAttempt} onClick={closeIfSafe}>×</button></div>
      <div className="drawer-content"><form id="student-void-form" onSubmit={event => void submit(event)}>
        {load.state === "loading" ? <p role="status">Đang tải lifecycle…</p> : null}
        {load.state === "error" ? <p className="edit-error" role="alert">{load.message}</p> : null}
        {load.state === "ready" ? <><p><strong>{load.lifecycle.student.displayName}</strong></p><p>Student chuyển sang ARCHIVED và Guardian của intake kết thúc. Parent/contact chỉ được lưu trữ khi Core chứng minh không còn liên kết hoặc phụ thuộc khác.</p><div className="property-row"><label className="property-label" htmlFor="student-void-reason"><small aria-hidden="true">≡</small>Lý do</label><div className="property-control"><input id="student-void-reason" className="edit-input" required minLength={3} disabled={attempt !== null || result !== null} value={reason} onChange={event => { setReason(event.target.value); setError(""); }} placeholder="Lý do lưu trữ" /></div></div></> : null}
        {result ? <p role="status">Đã lưu trữ Student và kết thúc Guardian. {parentDisposition}</p> : null}
        {error ? <p className="edit-error" role="alert">{error}{uncertainAttempt ? " Kết quả chưa xác định; thử lại cùng yêu cầu để đối soát." : ""}</p> : null}
      </form></div>
      <div className="drawer-footer"><div className="lab-bottom">{result ? <button type="button" className="primary-btn" onClick={onNeutralized}>Đóng & Clean Verify</button> : <>{attempt && error && canResetAttempt ? <button type="button" className="secondary-btn" disabled={busy} onClick={resetAttempt}>Sửa lý do / tải lại</button> : null}{load.state === "error" ? <button type="button" className="secondary-btn" onClick={() => { setLoad({ state: "loading" }); setReload(value => value + 1); }}>Tải lại</button> : null}<button type="button" className="secondary-btn" disabled={busy || uncertainAttempt} onClick={closeIfSafe}>Hủy</button><button type="submit" form="student-void-form" className="primary-btn" disabled={busy || load.state !== "ready" || (!attempt && reason.trim().length < 3)}>{busy ? "Đang lưu trữ…" : attempt ? "Thử lại cùng yêu cầu" : "Xác nhận lưu trữ"}</button></>}</div></div>
    </aside></>;
}
