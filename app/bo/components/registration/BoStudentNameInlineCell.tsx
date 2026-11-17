"use client";

/**
 * PAP-1750 / PAP-1365 (SCH-STUDENT-MGMT)
 * Canonical /bo Student name editor. The scoped Core PATCH alone authorizes mutation.
 * The selected Center's UI capability is only an affordance, never a security grant.
 */
import { useEffect, useRef, useState } from "react";
import { BoTypedEditor } from "./BoTypedEditor";
import { BoApiError } from "@/lib/bo-api-error";
import { studentCenterApi } from "@/lib/bo-student-center-api";
import { useStudentCenterEditCapability } from "@/app/bo/learners/useStudentCenterEditCapability";
import type { BoField } from "@/lib/bo-registration";

type StudentGender = "MALE" | "FEMALE";
function readGender(student: { displayName: string }): StudentGender | null | undefined {
  const value = (student as { gender?: unknown }).gender;
  return value === "MALE" || value === "FEMALE" || value === null ? value : undefined;
}

async function updateGender(studentId: string, centerId: string, gender: StudentGender, expectedVersion: number) {
  const path = `/api/bo/students/${encodeURIComponent(studentId)}/gender?centerId=${encodeURIComponent(centerId)}`;
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gender, expectedVersion }),
  });
  if (!response.ok) throw new BoApiError(response.status, "Không thể lưu giới tính.", response.headers.get("x-request-id"));
}

const NAME_FIELD: BoField = { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 160 };
const GENDER_FIELD: BoField = { key: "gender", label: "Giới tính", type: "select", icon: "▣", w: 160, options: ["Nam", "Nữ"] };
type Snapshot = { scope: string; version: number; status: string; displayName: string; gender?: "MALE" | "FEMALE" | null };

export function BoStudentNameInlineCell({
  studentId, displayName, centerId, centerReady, onSaved, editGender = false,
}: {
  studentId: string;
  displayName: string;
  centerId: string;
  centerReady: boolean;
  onSaved?: (nextName: string) => void;
  editGender?: boolean;
}) {
  const field = editGender ? GENDER_FIELD : NAME_FIELD;
  const scope = JSON.stringify([studentId, centerId]);
  const allowed = useStudentCenterEditCapability(centerReady ? centerId : "");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const aliveRef = useRef(true);
  const currentScope = useRef(scope);

  useEffect(() => { currentScope.current = scope; }, [scope]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!centerReady) return;
    let active = true;
    void studentCenterApi.learnerLifecycle(studentId, centerId).then(detail => {
      if (!active || detail.student.id !== studentId) return;
      setSnapshot({
        scope,
        displayName: detail.student.displayName,
        gender: readGender(detail.student),
        version: detail.student.version,
        status: detail.student.status,
      });
    }).catch(() => {
      // A denied/failed read can never unlock the name writer.
      if (active) setSnapshot(null);
    });
    return () => { active = false; };
  }, [centerId, centerReady, scope, studentId]);

  const ready = centerReady && allowed && snapshot?.scope === scope && snapshot.status !== "ARCHIVED";
  const name = snapshot?.scope === scope ? snapshot.displayName : displayName;
  const gender = snapshot?.scope === scope ? snapshot.gender : undefined;
  const shownValue = editGender ? (gender === "MALE" ? "Nam" : gender === "FEMALE" ? "Nữ" : "") : name;
  const canEdit = Boolean(ready && (!editGender || gender !== undefined));
  async function commit(value: string | number | boolean | string[] | null | undefined) {
    const nextName = typeof value === "string" ? value.trim() : "";
    if (savingRef.current || !ready || !snapshot || snapshot.scope !== currentScope.current || !aliveRef.current) return;
    const nextGender = nextName === "Nam" ? "MALE" : nextName === "Nữ" ? "FEMALE" : null;
    if (editGender && !nextGender) { setError("Vui lòng chọn Nam hoặc Nữ."); return; }
    if (!editGender && (!nextName || nextName.length > 120)) { setError("Tên học viên phải có từ 1 đến 120 ký tự."); return; }
    if (nextName === shownValue) { setError(""); setAnchor(null); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    const requestedScope = scope;
    try {
      if (editGender && nextGender) await updateGender(studentId, centerId, nextGender, snapshot.version);
      else await studentCenterApi.updateStudentProfile(studentId, { displayName: nextName, expectedVersion: snapshot.version }, centerId);
      const reloaded = await studentCenterApi.learnerLifecycle(studentId, centerId);
      if (!aliveRef.current || currentScope.current !== requestedScope || reloaded.student.id !== studentId) return;
      setSnapshot({ scope, displayName: reloaded.student.displayName, gender: readGender(reloaded.student), version: reloaded.student.version, status: reloaded.student.status });
      if (!editGender) onSaved?.(reloaded.student.displayName);
      setAnchor(null);
    } catch (cause: unknown) {
      if (!aliveRef.current || currentScope.current !== requestedScope) return;
      if (cause instanceof BoApiError && cause.status === 409) {
        setError("Hồ sơ đã được thay đổi. Hãy tải lại dữ liệu trước khi sửa.");
      } else if (cause instanceof BoApiError && cause.status === 403) {
        setError("Bạn không có quyền sửa học viên tại cơ sở hiện tại.");
      } else {
        setError(cause instanceof Error ? cause.message : "Không thể lưu " + field.label.toLowerCase() + ".");
      }
    } finally {
      savingRef.current = false;
      if (aliveRef.current && currentScope.current === requestedScope) setSaving(false);
    }
  }

  return <div className="v24-prop-item" data-student-detail-field={editGender ? "gender" : "displayName"}>
    <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
    {canEdit
      ? <button type="button" className="v24-prop-value" data-detail-edit={editGender ? "gender" : "displayName"} aria-label={"Sửa " + field.label} disabled={saving}
          onClick={event => { setError(""); setAnchor(event.currentTarget); }}>
          <span>{shownValue || "—"}</span><span className="v24-edit-glyph" aria-hidden="true">✎</span>
        </button>
      : <div className="v24-prop-value readonly" aria-label={"Chỉ đọc " + field.label}>
          <span>{shownValue || "—"}</span><span className="v24-lock" aria-hidden="true">⌁</span>
        </div>}
    {error ? <div className="edit-error" role="alert">{error}</div> : null}
    {saving ? <span role="status">Đang lưu…</span> : null}
    {anchor && ready
      ? <BoTypedEditor field={field} value={shownValue} anchor={anchor} closeOnSave={false}
          onClose={() => { if (!savingRef.current) setAnchor(null); }}
          onSave={value => { void commit(value); }} />
      : null}
  </div>;
}
