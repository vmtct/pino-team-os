"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { BoSubjectHistory } from "@/app/bo/components/BoSubjectHistory";
import { BoApiError } from "@/lib/bo-api";
import { studentCenterApi } from "@/lib/bo-student-center-api";
import { StudentProperties } from "./StudentProperties";
import { useBoEditPermission } from "../components/useBoEditPermission";
import { useBoCenterSelection } from "../components/registration/BoCenterSelection";
import styles from "../components/BoFullDetail.module.css";
import type { BoLearnerLifecycle } from "@/lib/bo-model";

type DetailState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoLearnerLifecycle };

/** Canonical Student detail with guarded, versioned profile edits. Domain ACL remains enforced by Core. */
export function StudentFullDetail({ studentId }: { studentId: string }) {
  const editPermission = useBoEditPermission("student.profile.edit");
  const center = useBoCenterSelection();
  const selectedCenter = center?.selected ?? "";
  const canEdit = editPermission && Boolean(selectedCenter) && !center?.loading && !center?.error && Boolean(center?.centers.some(entry => entry.id === selectedCenter));
  const currentCenter = useRef(selectedCenter);
  const pathname = usePathname();
  const search = useSearchParams();
  const [detail, setDetail] = useState<DetailState>({ state: "loading" });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    currentCenter.current = selectedCenter;
    let active = true;
    if (!selectedCenter) return () => { active = false; };
    void studentCenterApi.learnerLifecycle(studentId, selectedCenter).then(data => {
      if (active) setDetail({ state: "ready", data });
    }).catch((error: unknown) => {
      if (active) setDetail({ state: "error", message: error instanceof Error ? error.message : "Không thể tải học viên" });
    });
    return () => { active = false; };
  }, [studentId, selectedCenter]);
  if (detail.state === "loading") return <p role="status">Đang tải chi tiết học viên…</p>;
  if (detail.state === "error") return <p role="alert">{detail.message}</p>;
  const record = detail.data;
  async function saveProfile() {
    if (detail.state !== "ready" || saving || !canEdit || !selectedCenter || currentCenter.current !== selectedCenter) return;
    if (!name.trim()) { setSaveError("Tên học viên không được để trống."); return; }
    setSaving(true); setSaveError("");
    try {
      await studentCenterApi.updateStudentProfile(studentId, { displayName: name.trim(), expectedVersion: detail.data.student.version }, selectedCenter);
      const refreshed = await studentCenterApi.learnerLifecycle(studentId, selectedCenter);
      if (currentCenter.current !== selectedCenter) return;
      setDetail({ state: "ready", data: refreshed });
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof BoApiError && error.status === 409 ? "Hồ sơ đã được thay đổi. Tải lại trang trước khi thử lại." : error instanceof BoApiError && error.status === 403 ? "Bạn không có quyền sửa hồ sơ học viên." : error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally { setSaving(false); }
  }
  const query = new URLSearchParams(search.toString());
  const activeTab = query.get("tab");
  query.delete("tab");
  query.delete("detail");
  query.set("student", studentId);
  const returnTo = `/bo/learners?${query}`;
  return <BoFullDetail designVariant="v25" title={record.student.displayName} description={`Student ID: ${studentId}`} currentUrl={`${pathname}?${search}`} returnTo={returnTo} activeTab={activeTab} tabs={[
    { id: "detail", label: "Detail", content: <section className={styles.section} aria-label="Thuộc tính học viên">
      <h2>Thuộc tính học viên</h2>
      <StudentProperties record={record} nameControl={canEdit && record.student.status !== "ARCHIVED" ? <button type="button" aria-label="Chỉnh sửa tên học viên" disabled={saving} onClick={() => { setName(record.student.displayName); setSaveError(""); setEditing(true); }}>{record.student.displayName} <span aria-hidden="true">✎</span></button> : undefined}
        statusControl={undefined} />
      {editing && canEdit ? <form aria-label="Chỉnh sửa hồ sơ học viên" onSubmit={event => { event.preventDefault(); void saveProfile(); }}>
        <label>Tên học viên<input autoFocus aria-label="Tên học viên" value={name} onChange={event => setName(event.target.value)} required disabled={saving} /></label>
        <button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
        <button type="button" disabled={saving} onClick={() => setEditing(false)}>Hủy chỉnh sửa</button>
        {saveError ? <p role="alert">{saveError}</p> : null}
      </form> : null}
    </section> },
    { id: "specialized", label: "Chuyên Sâu", content: <><section className={styles.section}><h2>Người giám hộ</h2>{!record.guardians.length ? <p>Chưa có người giám hộ.</p> : null}<ul>{record.guardians.map(entry => <li key={entry.relationshipId}>{entry.parent.displayName ?? entry.parent.id} · {entry.relationshipType}</li>)}</ul></section><section className={styles.section}><h2>Gói học</h2>{!record.subscriptions.length ? <p>Chưa có gói học.</p> : null}<ul>{record.subscriptions.map(entry => <li key={entry.subscription.id}>{entry.subscription.pathDisplayName} · {entry.subscription.lifecycle} · {entry.subscription.effectiveAvailableUnits} buổi khả dụng · {entry.enrollments.length} enrollments</li>)}</ul></section></> },
    { id: "history", label: "Lịch Sử", content: <BoSubjectHistory key={studentId} subjectType="student_profile" subjectId={studentId} /> },
  ]} />;
}
