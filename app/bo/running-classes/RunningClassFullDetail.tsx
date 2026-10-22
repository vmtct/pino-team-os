"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { F3RunningClass, F3RunningClassBlock } from "@/lib/f3-delivery-api";
import { BoFullDetail } from "../components/BoFullDetail";

export function RunningClassFullDetail({ record, sessions, blocks, centerName, pathName, spaceName }: { record: F3RunningClass | null; centerName: string | null; pathName: string | null; spaceName: string | null; blocks: readonly F3RunningClassBlock[]; sessions: readonly { id: string; runningClassId: string | null; localDate: string; startsAt: string; endsAt: string }[] }) {
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
    { id: "overview", label: "Overview", content: <dl><dt>Center</dt><dd>{centerName ?? record.centerId}</dd><dt>Program</dt><dd>{pathName ?? record.pathProgramId}</dd><dt>Learning space</dt><dd>{spaceName ?? record.learningSpaceId}</dd><dt>Status</dt><dd>{record.status}</dd><dt>Weekday (ISO)</dt><dd>{record.weekdayIso}</dd><dt>Topology</dt><dd>{record.deliveryTopology}</dd><dt>Default participation</dt><dd>{record.defaultParticipationMinutes == null ? "Not set" : `${record.defaultParticipationMinutes} min`}</dd><dt>Time</dt><dd>{record.windowStartsLocal}–{record.windowEndsLocal}</dd><dt>Optimal capacity</dt><dd>{record.optimalConcurrentCapacity}</dd><dt>Hard capacity</dt><dd>{record.hardConcurrentCapacity ?? "Not set"}</dd></dl> },
    { id: "blocks", label: "Blocks", content: <div><p>Canonical running-class blocks from Core bootstrap.</p>{classBlocks.length ? <ul>{classBlocks.map((block) => <li key={block.id}>{block.blockKind} · {block.startsOffsetMinutes}–{block.endsOffsetMinutes} min{block.label ? ` · ${block.label}` : ""}</li>)}</ul> : <p>No blocks returned for this class.</p>}</div> },
    { id: "calendar", label: "Calendar", content: <div><p>Upcoming canonical sessions only. This is not a complete historical calendar.</p>{upcomingClassSessions.length ? <ul>{upcomingClassSessions.map((session) => <li key={session.id}>{session.localDate} · {session.startsAt} – {session.endsAt}</li>)}</ul> : <p>No upcoming sessions returned for this class.</p>}</div> },
    { id: "identity", label: "Identity", content: <dl><dt>Canonical ID</dt><dd>{record.id}</dd><dt>Program ID</dt><dd>{record.pathProgramId}</dd><dt>Center ID</dt><dd>{record.centerId}</dd><dt>Space ID</dt><dd>{record.learningSpaceId}</dd><dt>Version</dt><dd>{record.version}</dd></dl> },
  ]} />;
}
