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

const NAME_FIELD: BoField = { key: "name", label: "Học viên", type: "text", icon: "Aa", w: 160 };
type Snapshot = { scope: string; version: number; status: string; displayName: string };

export function BoStudentNameInlineCell({
  studentId, displayName, centerId, centerReady, onSaved,
}: {
  studentId: string;
  displayName: string;
  centerId: string;
  centerReady: boolean;
  onSaved: (nextName: string) => void;
}) {
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
  const canEdit = Boolean(ready);
  async function commit(value: string | number | boolean | string[] | null | undefined) {
    const nextName = typeof value === "string" ? value.trim() : "";
    if (savingRef.current || !ready || !snapshot || snapshot.scope !== currentScope.current || !aliveRef.current) return;
    if (!nextName || nextName.length > 120) { setError("Tên học viên phải có từ 1 đến 120 ký tự."); return; }
    if (nextName === name) { setError(""); setAnchor(null); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    const requestedScope = scope;
    try {
      await studentCenterApi.updateStudentProfile(studentId, { displayName: nextName, expectedVersion: snapshot.version }, centerId);
      const reloaded = await studentCenterApi.learnerLifecycle(studentId, centerId);
      if (!aliveRef.current || currentScope.current !== requestedScope || reloaded.student.id !== studentId) return;
      setSnapshot({ scope, displayName: reloaded.student.displayName, version: reloaded.student.version, status: reloaded.student.status });
      onSaved(reloaded.student.displayName);
      setAnchor(null);
    } catch (cause: unknown) {
      if (!aliveRef.current || currentScope.current !== requestedScope) return;
      if (cause instanceof BoApiError && cause.status === 409) {
        setError("Hồ sơ đã được thay đổi. Hãy tải lại dữ liệu trước khi sửa.");
      } else if (cause instanceof BoApiError && cause.status === 403) {
        setError("Bạn không có quyền sửa học viên tại cơ sở hiện tại.");
      } else {
        setError(cause instanceof Error ? cause.message : "Không thể lưu tên học viên.");
      }
    } finally {
      savingRef.current = false;
      if (aliveRef.current && currentScope.current === requestedScope) setSaving(false);
    }
  }

  return <div className="v24-prop-item" data-student-detail-field="displayName">
    <div className="v24-prop-key"><span className="v24-field-glyph">Aa</span>Học viên</div>
    {canEdit
      ? <button type="button" className="v24-prop-value" data-detail-edit="displayName" aria-label="Sửa Học viên" disabled={saving}
          onClick={event => { setError(""); setAnchor(event.currentTarget); }}>
          <span>{name}</span><span className="v24-edit-glyph" aria-hidden="true">✎</span>
        </button>
      : <div className="v24-prop-value readonly" aria-label="Chỉ đọc Học viên">
          <span>{name}</span><span className="v24-lock" aria-hidden="true">⌁</span>
        </div>}
    {error ? <div className="edit-error" role="alert">{error}</div> : null}
    {saving ? <span role="status">Đang lưu…</span> : null}
    {anchor && ready
      ? <BoTypedEditor field={NAME_FIELD} value={name} anchor={anchor} closeOnSave={false}
          onClose={() => { if (!savingRef.current) setAnchor(null); }}
          onSave={value => { void commit(value); }} />
      : null}
  </div>;
}
