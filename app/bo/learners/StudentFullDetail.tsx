"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { boApi, BoApiError } from "@/lib/bo-api";
import type { BoLearnerLifecycle } from "@/lib/bo-model";

type DetailState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoLearnerLifecycle };

/** Canonical Student detail with guarded, versioned profile edits. Domain ACL remains enforced by Core. */
export function StudentFullDetail({ studentId }: { studentId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [detail, setDetail] = useState<DetailState>({ state: "loading" });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let active = true;
    setDetail({ state: "loading" });
    void boApi.learnerLifecycle(studentId).then(data => {
      if (active) setDetail({ state: "ready", data });
    }).catch((error: unknown) => {
      if (active) setDetail({ state: "error", message: error instanceof Error ? error.message : "Không thể tải học viên" });
    });
    return () => { active = false; };
  }, [studentId]);
  if (detail.state === "loading") return <p role="status">Đang tải chi tiết học viên…</p>;
  if (detail.state === "error") return <p role="alert">{detail.message}</p>;
  const record = detail.data;
  async function saveProfile() {
    if (detail.state !== "ready" || saving) return;
    if (!name.trim()) { setSaveError("Tên học viên không được để trống."); return; }
    setSaving(true); setSaveError("");
    try {
      await boApi.updateStudentProfile(studentId, { displayName: name.trim(), status, expectedVersion: detail.data.student.version });
      const refreshed = await boApi.learnerLifecycle(studentId);
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
  return <BoFullDetail title={record.student.displayName} description={`Student ID: ${studentId}`} currentUrl={`${pathname}?${search}`} returnTo={returnTo} activeTab={activeTab} tabs={[
    { id: "detail", label: "Detail", content: <><section aria-label="Chỉnh sửa hồ sơ học viên"><button type="button" onClick={() => { setName(record.student.displayName); setStatus(record.student.status as "ACTIVE" | "INACTIVE" | "ARCHIVED"); setSaveError(""); setEditing(!editing); }}>{editing ? "Hủy chỉnh sửa" : "Chỉnh sửa hồ sơ"}</button>{editing ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}><label>Tên học viên<input aria-label="Tên học viên" value={name} onChange={(event) => setName(event.target.value)} required disabled={saving} /></label><label>Trạng thái<select aria-label="Trạng thái học viên" value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE" | "ARCHIVED")} disabled={saving}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></label><button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>{saveError ? <p role="alert">{saveError}</p> : null}</form> : null}</section><dl><dt>Student ID</dt><dd>{studentId}</dd><dt>Trạng thái</dt><dd>{record.student.status}</dd><dt>Năm sinh</dt><dd>{record.student.birthYear ?? "Chưa có"}</dd><dt>House member</dt><dd>{record.houseMembership ? "Có" : "Không"}</dd><dt>Subscriptions</dt><dd>{record.subscriptions.length}</dd></dl></> },
    { id: "specialized", label: "Chuyên Sâu", content: <><h2>Người giám hộ</h2><ul>{record.guardians.map(entry => <li key={entry.relationshipId}>{entry.parent.displayName ?? entry.parent.id} · {entry.relationshipType}</li>)}</ul><h2>Gói học</h2><ul>{record.subscriptions.map(entry => <li key={entry.subscription.id}>{entry.subscription.pathDisplayName} · {entry.subscription.lifecycle} · {entry.subscription.effectiveAvailableUnits} buổi khả dụng · {entry.enrollments.length} enrollments</li>)}</ul></> },
    { id: "history", label: "Lịch Sử", content: <p role="status">Lịch sử kiểm toán chưa được kết nối với nguồn Core xác thực.</p> },
  ]} />;
}
