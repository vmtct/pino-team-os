"use client";

import { useState } from "react";
import { BoApiError } from "@/lib/bo-api";
import { f3DeliveryApi } from "@/lib/f3-delivery-api";
import { usePathname, useSearchParams } from "next/navigation";
import type { F3RunningClass, F3RunningClassBlock } from "@/lib/f3-delivery-api";
import { BoFullDetail } from "../components/BoFullDetail";
import { RunningClassProperties } from "./RunningClassProperties";
import { useBoEditPermission } from "../components/useBoEditPermission";
import styles from "../components/BoFullDetail.module.css";
import { BoSubjectHistory } from "../components/BoSubjectHistory";
import { RunningClassSessionRoster } from "./RunningClassSessionRoster";
import { RunningClassWeeklyTeachers } from "./RunningClassWeeklyTeachers";

export function RunningClassFullDetail({ record, sessions, blocks, centerName, pathName, spaceName, centerTimeZone }: { record: F3RunningClass | null; centerName: string | null; centerTimeZone: string | null; pathName: string | null; spaceName: string | null; blocks: readonly F3RunningClassBlock[]; sessions: readonly { id: string; runningClassId: string | null; localDate: string; startsAt: string; endsAt: string; startsLocal: string; endsLocal: string; timeZone: string }[] }) {
  const canEdit = useBoEditPermission("delivery.schedule.manage");
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(record?.operationalName ?? "");
  const [capacity, setCapacity] = useState(String(record?.optimalConcurrentCapacity ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function saveClass() {
    if (!record || saving || !canEdit) return;
    const nextCapacity = Number(capacity);
    if (!name.trim() || !Number.isSafeInteger(nextCapacity) || nextCapacity < 1 || (record.hardConcurrentCapacity !== null && nextCapacity > record.hardConcurrentCapacity)) {
      setError("Enter a class name and a valid optimal capacity within the hard capacity limit."); return;
    }
    setSaving(true); setError("");
    try {
      const { id, version, ...original } = record;
      await f3DeliveryApi.updateRunningClass(id, { ...original, expectedVersion: version, operationalName: name.trim(), optimalConcurrentCapacity: nextCapacity });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof BoApiError && caught.status === 409 ? "Class changed elsewhere. Reload before retrying." : caught instanceof BoApiError && caught.status === 403 ? "You do not have permission to update this class." : caught instanceof Error ? caught.message : "Class update failed.");
      setSaving(false);
    }
  }
  const classBlocks = record ? blocks.filter((block) => block.runningClassId === record.id).sort((a, b) => a.startsOffsetMinutes - b.startsOffsetMinutes) : [];
  const upcomingClassSessions = record ? sessions.filter((session) => session.runningClassId === record.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
  const pathname = usePathname();
  const search = useSearchParams();
  if (!record) return <p role="status">Running Class not found or unavailable.</p>;
  const currentUrl = `${pathname}?${search.toString()}`;
  const tableQuery = new URLSearchParams(search.toString());
  tableQuery.delete("detail");
  tableQuery.delete("tab");
  const tableReturn = `/bo/running-classes${tableQuery.size ? `?${tableQuery.toString()}` : ""}`;
  return <BoFullDetail designVariant="v25" title={record.operationalName} description="Lớp đang chạy" currentUrl={currentUrl} returnTo={tableReturn} activeTab={search.get("tab")} tabs={[
    { id: "detail", label: "Detail", content: <section className={styles.section} aria-label="Thuộc tính lớp học">
      <h2>Thuộc tính lớp học</h2>
      <RunningClassProperties record={record} centerName={centerName} pathName={pathName} spaceName={spaceName} centerTimeZone={centerTimeZone}
        nameControl={canEdit ? <button type="button" aria-label="Chỉnh sửa tên lớp" disabled={saving} onClick={() => { setName(record.operationalName); setCapacity(String(record.optimalConcurrentCapacity)); setError(""); setEditOpen(true); }}>{record.operationalName} <span aria-hidden="true">✎</span></button> : undefined}
        capacityControl={canEdit ? <button type="button" aria-label="Chỉnh sửa sĩ số tối ưu" disabled={saving} onClick={() => { setName(record.operationalName); setCapacity(String(record.optimalConcurrentCapacity)); setError(""); setEditOpen(true); }}>{record.optimalConcurrentCapacity} <span aria-hidden="true">✎</span></button> : undefined} />
      {editOpen && canEdit ? <form aria-label="Chỉnh sửa lớp học" onSubmit={event => { event.preventDefault(); void saveClass(); }}>
        <label>Tên lớp<input autoFocus aria-label="Tên lớp" required value={name} onChange={event => setName(event.target.value)} disabled={saving} /></label>
        <label>Sĩ số tối ưu<input aria-label="Sĩ số tối ưu" type="number" min="1" max={record.hardConcurrentCapacity ?? undefined} required value={capacity} onChange={event => setCapacity(event.target.value)} disabled={saving} /></label>
        <button type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
        <button type="button" disabled={saving} onClick={() => setEditOpen(false)}>Hủy chỉnh sửa</button>
        {error ? <p role="alert">{error}</p> : null}
      </form> : null}
    </section> },
    { id: "specialized", label: "Chuyên Sâu", content: <><section className={styles.section}><RunningClassWeeklyTeachers centerId={record.centerId} runningClassId={record.id} /></section><section className={styles.section}><h2>Cấu trúc buổi học</h2><p>Canonical running-class blocks from Core bootstrap.</p>{classBlocks.length ? <ul>{classBlocks.map((block) => <li key={block.id}>{block.blockKind} · {block.startsOffsetMinutes}–{block.endsOffsetMinutes} min ({block.endsOffsetMinutes - block.startsOffsetMinutes} min duration){block.label ? ` · ${block.label}` : ""}{block.sharedBlockKey ? ` · Shared block: ${block.sharedBlockKey}` : ""}</li>)}</ul> : <p>No blocks returned for this class.</p>}</section><section className={styles.section}><h2>Buổi học sắp tới</h2><p>Upcoming canonical sessions only. This is not a complete historical calendar.</p>{upcomingClassSessions.length ? <ul>{upcomingClassSessions.map((session) => <li key={session.id}>{session.localDate} · {session.startsLocal}–{session.endsLocal} ({session.timeZone})<RunningClassSessionRoster sessionId={session.id} /></li>)}</ul> : <p>No upcoming sessions returned for this class.</p>}</section></> },
    { id: "history", label: "Lịch Sử", content: <BoSubjectHistory key={record.id} subjectType="running_class" subjectId={record.id} /> },
  ]} />;
}
