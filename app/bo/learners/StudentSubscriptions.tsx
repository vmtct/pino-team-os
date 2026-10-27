"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BoDataGrid, BoDataGridCanonicalId, BoDataGridSidePeek, BoDataGridStatus,
  type BoDataGridColumn,
} from "@/app/bo/components/data-grid";
import { BoFullDetail } from "@/app/bo/components/BoFullDetail";
import { BoProperties } from "@/app/bo/components/BoProperties";
import type { BoLearnerLifecycle } from "@/lib/bo-model";
import styles from "../components/BoFullDetail.module.css";

type SubscriptionEntry = BoLearnerLifecycle["subscriptions"][number];

/** The student lifecycle endpoint is the scoped Core truth. Never filter a single global directory page. */
export function studentSubscriptionEntries(record: BoLearnerLifecycle, studentId: string) {
  return record.subscriptions.filter(entry => entry.subscription.studentProfileId === studentId);
}

function SubscriptionProperties({ entry, compact = false }: { entry: SubscriptionEntry; compact?: boolean }) {
  const sub = entry.subscription;
  return <BoProperties compact={compact} items={[
    { key: "id", label: "Subscription ID", value: <BoDataGridCanonicalId value={sub.id} label="Sao chép Subscription ID" /> },
    { key: "path", label: "Path", value: sub.pathDisplayName },
    { key: "status", label: "Trạng thái", value: <BoDataGridStatus value={sub.lifecycle} tone={sub.lifecycle === "ACTIVE" ? "success" : sub.lifecycle === "CANCELLED" ? "danger" : "neutral"} /> },
    { key: "student", label: "Student ID", value: sub.studentProfileId },
    { key: "weekly", label: "Buổi mỗi tuần", value: sub.weeklyCommitment },
    { key: "units", label: "Số buổi khả dụng", value: sub.effectiveAvailableUnits },
    { key: "balance", label: "Số buổi lịch sử", value: sub.historicalBalance },
    { key: "service", label: "Bắt đầu dịch vụ", value: sub.serviceStartsOn },
    { key: "starts", label: "Bắt đầu hợp đồng", value: sub.contractualStartsOn },
    { key: "ends", label: "Kết thúc hợp đồng", value: sub.contractualEndsOn },
    { key: "term", label: "Thời hạn (tuần)", value: sub.termWeeks },
    { key: "reference", label: "Tham chiếu", value: sub.commercialReference },
    { key: "version", label: "Phiên bản", value: sub.version },
  ]} />;
}

function studentSubscriptionsHref(currentUrl: string, studentId: string) {
  const url = new URL(currentUrl, "https://bo.invalid");
  url.searchParams.set("student", studentId);
  url.searchParams.set("detail", studentId);
  url.searchParams.set("tab", "subscriptions");
  url.searchParams.delete("subscription");
  return url.pathname + url.search;
}

export function StudentSubscriptionsTab({ record, studentId }: { record: BoLearnerLifecycle; studentId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SubscriptionEntry | null>(null);
  const entries = useMemo(() => studentSubscriptionEntries(record, studentId), [record, studentId]);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return needle ? entries.filter(entry => {
      const sub = entry.subscription;
      return [sub.id, sub.pathDisplayName, sub.lifecycle, sub.commercialReference ?? ""]
        .some(value => value.toLocaleLowerCase("vi").includes(needle));
    }) : entries;
  }, [entries, query]);

  function fullDetailHref(subscriptionId: string) {
    const params = new URLSearchParams(search.toString());
    params.set("student", studentId);
    params.set("detail", studentId);
    params.set("subscription", subscriptionId);
    params.set("tab", "detail");
    return `${pathname}?${params}`;
  }

  const columns: BoDataGridColumn<SubscriptionEntry>[] = [
    { key: "path", header: "Path", sticky: true, minWidth: 170, render: entry => (
      <button type="button" onClick={() => setSelected(entry)} aria-label={`Mở Subscription ${entry.subscription.pathDisplayName}`}>
        {entry.subscription.pathDisplayName}
      </button>
    ) },
    { key: "id", header: "Subscription ID", minWidth: 170, render: entry => <BoDataGridCanonicalId value={entry.subscription.id} /> },
    { key: "status", header: "Trạng thái", minWidth: 125, render: entry => (
      <BoDataGridStatus value={entry.subscription.lifecycle} tone={entry.subscription.lifecycle === "ACTIVE" ? "success" : "neutral"} />
    ) },
    { key: "weekly", header: "Buổi/tuần", minWidth: 95, render: entry => entry.subscription.weeklyCommitment },
    { key: "service", header: "Bắt đầu", minWidth: 125, render: entry => entry.subscription.serviceStartsOn ?? "—" },
    { key: "end", header: "Kết thúc", minWidth: 125, render: entry => entry.subscription.contractualEndsOn ?? "—" },
    { key: "units", header: "Buổi khả dụng", minWidth: 110, render: entry => entry.subscription.effectiveAvailableUnits },
  ];

  return <>
    <BoDataGrid
      rows={visible}
      columns={columns}
      rowKey={entry => entry.subscription.id}
      caption={`Subscriptions của ${record.student.displayName}`}
      resultLabel={`${visible.length} Subscription · học viên ${record.student.displayName}`}
      filterChips={[{ key: "student", label: "Học viên", value: record.student.displayName }]}
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Tìm gói, Path, mã Subscription…"
      onRowOpen={setSelected}
      quickViewOpener
      selectedRowKey={selected?.subscription.id ?? null}
      emptyTitle="Chưa có Subscription"
      emptyMessage="Không tìm thấy gói học thuộc học viên này."
    />
    {selected ? <BoDataGridSidePeek
      title={selected.subscription.pathDisplayName}
      eyebrow="School · Subscription"
      onClose={() => setSelected(null)}
      footer={<Link href={fullDetailHref(selected.subscription.id)} onClick={() => setSelected(null)}>↗ Full Detail</Link>}
    >
      <SubscriptionProperties entry={selected} compact />
    </BoDataGridSidePeek> : null}
  </>;
}

/** Full Detail uses the selected student's own Core record, and fails closed for foreign subscription IDs. */
export function StudentSubscriptionFullDetail({ record, studentId, subscriptionId, currentUrl }: {
  record: BoLearnerLifecycle; studentId: string; subscriptionId: string; currentUrl: string;
}) {
  const entry = studentSubscriptionEntries(record, studentId).find(item => item.subscription.id === subscriptionId);
  const returnTo = studentSubscriptionsHref(currentUrl, studentId);
  if (!entry) return <section role="alert">
    <p>Không tìm thấy Subscription thuộc học viên đang chọn.</p>
    <Link href={returnTo}>Về Subscription của học viên</Link>
  </section>;
  const sub = entry.subscription;
  return <BoFullDetail
    designVariant="v25"
    title={sub.pathDisplayName}
    description={`Subscription ID: ${sub.id}`}
    currentUrl={currentUrl}
    returnTo={returnTo}
    activeTab={new URL(currentUrl, "https://bo.invalid").searchParams.get("tab")}
    tabs={[
      { id: "detail", label: "Detail", content: <section className={styles.section}>
        <h2>Chi tiết Subscription</h2>
        <SubscriptionProperties entry={entry} />
      </section> },
      { id: "specialized", label: "Chuyên Sâu", content: <section className={styles.section}>
        <h2>Enrollment liên kết ({entry.enrollments.length})</h2>
        {entry.enrollments.length ? <BoProperties items={entry.enrollments.flatMap(enrollment => [
          { key: `${enrollment.id}-class`, label: "Running Class", value: enrollment.runningClassName },
          { key: `${enrollment.id}-from`, label: "Hiệu lực từ", value: enrollment.effectiveFromLocalDate },
          { key: `${enrollment.id}-until`, label: "Đến trước ngày", value: enrollment.effectiveUntilExclusiveLocalDate ?? "Đang hiệu lực" },
        ])} /> : <p>Chưa có Enrollment liên kết.</p>}
      </section> },
      { id: "history", label: "Lịch Sử", content: <section className={styles.section}>
        <h2>Mốc vòng đời</h2>
        <BoProperties items={[
          { key: "predecessor", label: "Gói trước đó", value: sub.predecessorSubscriptionId },
          { key: "transition", label: "Loại chuyển tiếp", value: sub.transitionType },
          { key: "completed", label: "Hoàn thành lúc", value: sub.completedAt },
        ]} />
        <p>Đây là các mốc lưu trên Subscription; lịch sử audit riêng chưa được Core cung cấp.</p>
      </section> },
    ]}
  />;
}
