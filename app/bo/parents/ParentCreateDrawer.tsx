"use client";

import { useRef, useState, type FormEvent } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { BoApiError } from "@/lib/bo-api-error";
import { createStandaloneParent, inferParentContactType, type BoParentStandaloneCreateInput, type BoParentStandaloneCreateResult } from "@/lib/bo-parent-create-client";

type Attempt = { body: BoParentStandaloneCreateInput; key: string; centerId: string };
function failureMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không thể tạo phụ huynh.";
}

/** PAP-1550: Create is a workflow inside the existing BO DS drawer frame, not a second shell. */
export function ParentCreateDrawer({
  centerId, onClose, onCreated,
}: { centerId: string; onClose: () => void; onCreated: (result: BoParentStandaloneCreateResult) => void }) {
  const inFlight = useRef(false);
  const attemptRef = useRef<Attempt | null>(null);
  const [name, setName] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const uncertain = locked && !!error && !canEdit;
  const dirty = !!name.trim() || !!contactValue.trim();

  function closeIfSafe() {
    if (inFlight.current || uncertain) return;
    if (dirty && !window.confirm("Bỏ thông tin phụ huynh chưa lưu?")) return;
    onClose();
  }
  function clearAttempt() {
    attemptRef.current = null;
    setLocked(false); setCanEdit(false); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (attemptRef.current && attemptRef.current.centerId !== centerId) {
      setError("Cơ sở đã thay đổi. Hủy và bắt đầu yêu cầu mới.");
      return;
    }
    const inferredType = inferParentContactType(contactValue);
    if (!attemptRef.current && (!name.trim() || !inferredType)) {
      setError("Nhập họ tên và số điện thoại hoặc email hợp lệ.");
      return;
    }
    const attempt = attemptRef.current ?? {
      centerId, key: crypto.randomUUID(),
      body: { displayName: name.trim(), contacts: [{ identifierType: inferredType!, value: contactValue.trim(), isPrimary: true }] },
    };
    attemptRef.current = attempt;
    setLocked(true); setCanEdit(false); setError("");
    inFlight.current = true; setBusy(true);
    try {
      const result = await createStandaloneParent(attempt.centerId, attempt.body, attempt.key);
      onCreated(result);
    } catch (cause) {
      setError(failureMessage(cause));
      setCanEdit(cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  return <DrawerFrame title="Tạo phụ huynh" path="School · Parents & Guardians" onClose={closeIfSafe}
    footer={<>
      {locked && error && canEdit ? <BoActionButton variant="secondary" type="button" disabled={busy} onClick={clearAttempt}>Sửa dữ liệu</BoActionButton> : null}
      <BoActionButton variant="secondary" type="button" disabled={busy || uncertain} onClick={closeIfSafe}>Hủy</BoActionButton>
      <BoActionButton variant="primary" type="submit" form="parent-create-form" disabled={busy}>{busy ? "Đang tạo…" : locked ? "Thử lại cùng yêu cầu" : "Tạo Parent"}</BoActionButton>
    </>}>
    <form id="parent-create-form" onSubmit={event => void submit(event)}>
      <section className="property-section">
        <h3>Thông tin phụ huynh</h3>
        <label className="property-row"><span className="property-label">Họ và tên *</span>
          <input id="parent-create-name" className="os-create-select" autoComplete="name" maxLength={120} required autoFocus disabled={locked} value={name} onChange={e => { setName(e.target.value); setError(""); }} /></label>
        <label className="property-row"><span className="property-label">Điện thoại hoặc email *</span>
          <input id="parent-create-contact" className="os-create-select" type="text" autoComplete="off" maxLength={120} required disabled={locked} value={contactValue} onChange={e => { setContactValue(e.target.value); setError(""); }} /></label>
      </section>
      {error ? <div role="alert" className="edit-error">{error}{uncertain ? <p>Chưa xác định kết quả. Thử lại cùng yêu cầu để đối soát.</p> : null}</div> : null}
    </form>
  </DrawerFrame>;
}
