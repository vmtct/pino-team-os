"use client";

import { use, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { boApi } from "@/lib/bo-api";
import type { BoLearnerLifecycle } from "@/lib/bo-model";

type DetailState = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: BoLearnerLifecycle };

/** Read-only canonical student detail. Domain ACL remains enforced by BO API. */
export function StudentFullDetail({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const pathname = usePathname();
  const search = useSearchParams();
  const [detail, setDetail] = useState<DetailState>({ state: "loading" });
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
  const query = new URLSearchParams(search.toString());
  const activeTab = query.get("tab");
  query.delete("tab");
  const returnTo = `/bo/learners${query.size ? `?${query}` : ""}`;
  return <BoFullDetail title={record.student.displayName} description={`Student ID: ${studentId}`} currentUrl={`${pathname}?${search}`} returnTo={returnTo} activeTab={activeTab} tabs={[
    { id: "overview", label: "Tổng quan", content: <dl><dt>Student ID</dt><dd>{studentId}</dd><dt>Trạng thái</dt><dd>{record.student.status}</dd><dt>Năm sinh</dt><dd>{record.student.birthYear ?? "Chưa có"}</dd><dt>House member</dt><dd>{record.houseMembership ? "Có" : "Không"}</dd><dt>Subscriptions</dt><dd>{record.subscriptions.length}</dd></dl> },
    { id: "guardians", label: "Người giám hộ", content: <ul>{record.guardians.map(entry => <li key={entry.relationshipId}>{entry.parent.displayName ?? entry.parent.id} · {entry.relationshipType}</li>)}</ul> },
    { id: "subscriptions", label: "Subscriptions", content: <ul>{record.subscriptions.map((entry) => <li key={entry.subscription.id}>{entry.subscription.pathDisplayName} · {entry.subscription.lifecycle} · {entry.subscription.effectiveAvailableUnits} buổi khả dụng · {entry.enrollments.length} enrollments</li>)}</ul> },
  ]} />;
}
