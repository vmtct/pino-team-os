"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {useParentM1} from "./parent-m1-context";
import {useParentLiveScope} from "./parent-live-context";
import {loadNativeParentLiveGrants} from "./parent-native-data";
import {parentCreateMayEdit} from "./parent-create-retry";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { PropertySections } from "@/app/components/workspace-renderer/Properties";
import { parentNativeCreateSections, parentNativeFields } from "./parent-native-model";
import type { BoRecord } from "@/lib/bo-registration";

import { BoApiError } from "@/lib/bo-api-error";
import { createStandaloneParent, inferParentContactType, type BoParentStandaloneCreateInput, type BoParentStandaloneCreateResult } from "@/lib/bo-parent-create-client";

type Attempt = { body: BoParentStandaloneCreateInput; key: string; centerId: string };
// PAP-1814: native Create and View share the exact PINO DSA field manifest.
const drawerFields = parentNativeFields;
function failureMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không thể tạo phụ huynh.";
}

/** PAP-1550: Create is a workflow inside the existing BO DS drawer frame, not a second shell. */
export function ParentCreateDrawer({
  centerId, centerName, onClose, onCreated,
}: { centerId: string; centerName?: string; onClose: () => void; onCreated: (result: BoParentStandaloneCreateResult) => void }) {
  const fixture=useParentM1(),liveScope=useParentLiveScope();
  const preflight=useRef<AbortController|null>(null);
  useEffect(()=>()=>preflight.current?.abort(),[]);
  const inFlight = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const uncertainRef=useRef(false);
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
    if(uncertainRef.current)return;
    attemptRef.current = null;
    setLocked(false); setCanEdit(false); setError("");
  }
  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
      centerId, key: fixture?Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-"):crypto.randomUUID(),
      body: { displayName: name.trim(), contacts: [{ identifierType: inferredType!, value: contactValue.trim(), isPrimary: true }] },
    };
    attemptRef.current = attempt;
    const previouslyUncertain=uncertainRef.current;
    setLocked(true); setCanEdit(false); setError("");
    inFlight.current = true; setBusy(true);
    try {
      if(liveScope&&!fixture){
        const ctl=new AbortController();preflight.current=ctl;
        try {
          if(liveScope.centerId!==attempt.centerId||!(await loadNativeParentLiveGrants(liveScope,ctl.signal)).has("identity.parent.create"))throw Error("Không có quyền tạo Phụ huynh tại cơ sở này.");
          ctl.signal.throwIfAborted();
        }catch(cause){
          if(!ctl.signal.aborted){setError(failureMessage(cause));setCanEdit(parentCreateMayEdit(previouslyUncertain,true));}
          return; // Do not dispatch or release a previously uncertain key.
        }
      }
      const result = fixture?fixture.create(attempt.centerId,attempt.body,attempt.key):await createStandaloneParent(attempt.centerId, attempt.body, attempt.key);
      uncertainRef.current=false;
      onCreated(result);
    } catch (cause) {
      setError(failureMessage(cause));
      const editable=parentCreateMayEdit(previouslyUncertain,cause instanceof BoApiError && cause.structuredResponse && cause.status >= 400 && cause.status < 500);
      uncertainRef.current=!editable;
      setCanEdit(editable);
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }

  return <DrawerFrame title="Tạo phụ huynh" path="School · Parents & Guardians" onClose={closeIfSafe}
    footer={<>
      {locked && error && canEdit ? <BoActionButton variant="secondary" type="button" disabled={busy} onClick={clearAttempt}>Sửa dữ liệu</BoActionButton> : null}
      <BoActionButton variant="secondary" type="button" disabled={busy || uncertain} onClick={closeIfSafe}>Hủy</BoActionButton>
      <BoActionButton variant="primary" type={fixture?"button":"submit"} form="parent-create-form" onClick={fixture?()=>void submit():undefined} disabled={busy}>{busy ? "Đang tạo…" : locked ? "Thử lại cùng yêu cầu" : "Tạo Parent"}</BoActionButton>
    </>}>
    <form id="parent-create-form" onSubmit={event => void submit(event)} onKeyDown={event=>{if(fixture&&event.key==="Enter"&&event.target instanceof HTMLInputElement){event.preventDefault();void submit();}}}>
      <PropertySections variant="drawer" fields={drawerFields} sections={parentNativeCreateSections}
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
