"use client";

import { useState } from "react";
import { BoApiError } from "@/lib/bo-api";
import { f3DeliveryApi } from "@/lib/f3-delivery-api";
import { usePathname, useSearchParams } from "next/navigation";
import type { F3RunningClass, F3RunningClassBlock } from "@/lib/f3-delivery-api";
import { BoFullDetail } from "../components/BoFullDetail";
import { RunningClassSessionRoster } from "./RunningClassSessionRoster";
import { RunningClassWeeklyTeachers } from "./RunningClassWeeklyTeachers";

export function RunningClassFullDetail({ record, sessions, blocks, centerName, pathName, spaceName, centerTimeZone }: { record: F3RunningClass | null; centerName: string | null; centerTimeZone: string | null; pathName: string | null; spaceName: string | null; blocks: readonly F3RunningClassBlock[]; sessions: readonly { id: string; runningClassId: string | null; localDate: string; startsAt: string; endsAt: string; startsLocal: string; endsLocal: string; timeZone: string }[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(record?.operationalName ?? "");
  const [capacity, setCapacity] = useState(String(record?.optimalConcurrentCapacity ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function saveClass() {
    if (!record || saving) return;
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
  return <BoFullDetail title={record.operationalName} description="Canonical Running Class · Core read-only projection" currentUrl={currentUrl} returnTo={tableReturn} activeTab={search.get("tab")} tabs={[
    { id: "overview", label: "Overview", content: <><section aria-label="Edit Running Class"><button type="button" onClick={() => { setName(record.operationalName); setCapacity(String(record.optimalConcurrentCapacity)); setError(""); setEditOpen(!editOpen); }}>{editOpen ? "Cancel edit" : "Edit class"}</button>{editOpen ? <form onSubmit={(event) => { event.preventDefault(); void saveClass(); }}><label>Class name<input aria-label="Class name" required value={name} onChange={(event) => setName(event.target.value)} disabled={saving} /></label><label>Optimal capacity<input aria-label="Optimal capacity" type="number" min="1" max={record.hardConcurrentCapacity ?? undefined} required value={capacity} onChange={(event) => setCapacity(event.target.value)} disabled={saving} /></label><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>{error ? <p role="alert">{error}</p> : null}</form> : null}</section><dl><dt>Center</dt><dd>{centerName ?? record.centerId}</dd><dt>Program</dt><dd>{pathName ?? record.pathProgramId}</dd><dt>Learning space</dt><dd>{spaceName ?? record.learningSpaceId}</dd><dt>Status</dt><dd>{record.status}</dd><dt>Weekday (ISO)</dt><dd>{record.weekdayIso}</dd><dt>Topology</dt><dd>{record.deliveryTopology}</dd><dt>Default participation</dt><dd>{record.defaultParticipationMinutes == null ? "Not set" : `${record.defaultParticipationMinutes} min`}</dd><dt>Time</dt><dd>{record.windowStartsLocal}–{record.windowEndsLocal}{centerTimeZone ? ` (${centerTimeZone})` : ""}</dd><dt>Optimal capacity</dt><dd>{record.optimalConcurrentCapacity}</dd><dt>Hard capacity</dt><dd>{record.hardConcurrentCapacity ?? "Not set"}</dd></dl></> },
    { id: "teachers", label: "Teachers", content: <RunningClassWeeklyTeachers centerId={record.centerId} runningClassId={record.id} /> },
    { id: "blocks", label: "Blocks", content: <div><p>Canonical running-class blocks from Core bootstrap.</p>{classBlocks.length ? <ul>{classBlocks.map((block) => <li key={block.id}>{block.blockKind} · {block.startsOffsetMinutes}–{block.endsOffsetMinutes} min ({block.endsOffsetMinutes - block.startsOffsetMinutes} min duration){block.label ? ` · ${block.label}` : ""}{block.sharedBlockKey ? ` · Shared block: ${block.sharedBlockKey}` : ""}</li>)}</ul> : <p>No blocks returned for this class.</p>}</div> },
    { id: "calendar", label: "Calendar", content: <div><p>Upcoming canonical sessions only. This is not a complete historical calendar.</p>{upcomingClassSessions.length ? <ul>{upcomingClassSessions.map((session) => <li key={session.id}>{session.localDate} · {session.startsLocal}–{session.endsLocal} ({session.timeZone})<RunningClassSessionRoster sessionId={session.id} /></li>)}</ul> : <p>No upcoming sessions returned for this class.</p>}</div> },
    { id: "identity", label: "Identity", content: <dl><dt>Canonical ID</dt><dd>{record.id}</dd><dt>Program ID</dt><dd>{record.pathProgramId}</dd><dt>Center ID</dt><dd>{record.centerId}</dd><dt>Space ID</dt><dd>{record.learningSpaceId}</dd><dt>Version</dt><dd>{record.version}</dd></dl> },
  ]} />;
}
