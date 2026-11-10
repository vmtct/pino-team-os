"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { toLegacyModule } from "@/lib/workspace-schema";
import type { BoRecord } from "@/lib/bo-registration";
import { parentDefinition, parentSchema } from "./schema";
import { BoApiError } from "@/lib/bo-api-error";
import { createStandaloneParent, inferParentContactType, type BoParentStandaloneCreateInput, type BoParentStandaloneCreateResult } from "@/lib/bo-parent-create-client";

type Attempt = { body: BoParentStandaloneCreateInput; key: string; centerId: string };
// PAP-1724: exact same registered schema as the View Drawer.
// Schema is registered at runtime; widening the generic metadata view is safe.
const drawerFields = toLegacyModule(parentSchema as unknown as Parameters<typeof toLegacyModule>[0]).fields;
function failureMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không thể tạo phụ huynh.";
}

/** PAP-1550: Create is a workflow inside the existing BO DS drawer frame, not a second shell. */
export function ParentCreateDrawer({
  centerId, centerName, onClose, onCreated,
}: { centerId: string; centerName?: string; onClose: () => void; onCreated: (result: BoParentStandaloneCreateResult) => void }) {
  const inFlight = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const [name, setName] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  // PAP-1722: after DrawerFrame's shared focus trap initializes, restore the
  // Founder-approved prototype's initial field focus. Keep shared dialog
  // policy unchanged so the original invoker receives focus on close.
  useEffect(() => {
    const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const uncertain = locked && !!error && !canEdit;
  const dirty = !!name.trim() || !!contactValue.trim();
  const draft: BoRecord = {
    id: "", name, maskedContact: null, studentCount: 0,
    centers: centerName ?? "Cơ sở hiện tại", updatedAt: null, attention: null,
  };

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
      <PropertySections variant="drawer" fields={drawerFields} sections={parentDefinition.drawer.sections}
        record={draft} createFields={{
          name: { id: "parent-create-name", label: "Họ và tên *", value: name, required: true,
            maxLength: 120, autoComplete: "name", inputRef: nameInputRef, disabled: locked,
            onChange: value => { setName(value); setError(""); } },
          maskedContact: { id: "parent-create-contact", label: "Điện thoại hoặc email *", value: contactValue,
            required: true, maxLength: 120, autoComplete: "off", disabled: locked,
            onChange: value => { setContactValue(value); setError(""); } },
        }} />
      {error ? <div role="alert" className="edit-error">{error}{uncertain ? <p>Chưa xác định kết quả. Thử lại cùng yêu cầu để đối soát.</p> : null}</div> : null}
    </form>
  </DrawerFrame>;
}
