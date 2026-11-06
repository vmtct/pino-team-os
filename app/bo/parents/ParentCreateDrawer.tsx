"use client";

import { useRef, useState, type FormEvent } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { BoApiError } from "@/lib/bo-api-error";
import { createStandaloneParent, type BoParentStandaloneCreateInput, type BoParentStandaloneCreateResult } from "@/lib/bo-parent-create-client";

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
  const [contactType, setContactType] = useState<"PHONE" | "EMAIL">("PHONE");
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
    if (!attemptRef.current && (!name.trim() || !contactValue.trim())) {
      setError("Nhập tên và thông tin liên hệ để tạo phụ huynh.");
      return;
    }
    const attempt = attemptRef.current ?? {
      centerId, key: crypto.randomUUID(),
      body: { displayName: name.trim(), contacts: [{ identifierType: contactType, value: contactValue.trim(), isPrimary: true }] },
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

  return <DrawerFrame title="Tạo phụ huynh" path="Parents & Guardians" onClose={closeIfSafe}
    footer={<>
      {locked && error && canEdit ? <BoActionButton variant="secondary" type="button" disabled={busy} onClick={clearAttempt}>Sửa dữ liệu</BoActionButton> : null}
      <BoActionButton variant="secondary" type="button" disabled={busy || uncertain} onClick={closeIfSafe}>Hủy</BoActionButton>
      <BoActionButton variant="primary" type="submit" form="parent-create-form" disabled={busy}>{busy ? "Đang tạo…" : locked ? "Thử lại cùng yêu cầu" : "Tạo phụ huynh"}</BoActionButton>
    </>}>
    <form id="parent-create-form" onSubmit={event => void submit(event)}>
      <section className="property-section">
        <h3>Thông tin phụ huynh</h3>
        <div className="property-row"><label className="property-label" htmlFor="parent-create-name">Tên phụ huynh</label>
          <div className="property-control"><input id="parent-create-name" className="edit-input" autoComplete="name" maxLength={160} required disabled={locked} value={name} onChange={e => { setName(e.target.value); setError(""); }} /></div></div>
        <div className="property-row"><label className="property-label" htmlFor="parent-create-type">Loại liên hệ</label>
          <div className="property-control"><select id="parent-create-type" className="edit-input" disabled={locked} value={contactType} onChange={e => { setContactType(e.target.value as "PHONE" | "EMAIL"); setContactValue(""); }}>
            <option value="PHONE">Số điện thoại</option><option value="EMAIL">Email</option>
          </select></div></div>
        <div className="property-row"><label className="property-label" htmlFor="parent-create-contact">{contactType === "PHONE" ? "Số điện thoại" : "Email"}</label>
          <div className="property-control"><input id="parent-create-contact" className="edit-input" type={contactType === "PHONE" ? "tel" : "email"} autoComplete={contactType === "PHONE" ? "tel" : "email"} required disabled={locked} value={contactValue} onChange={e => { setContactValue(e.target.value); setError(""); }} /></div></div>
      </section>
      <p className="settings-hint">Phụ huynh chưa liên kết học viên sẽ không xuất hiện trong danh sách theo cơ sở.</p>
      {error ? <div role="alert" className="edit-error">{error}{uncertain ? <p>Chưa xác định kết quả. Thử lại cùng yêu cầu để đối soát.</p> : null}</div> : null}
    </form>
  </DrawerFrame>;
}
