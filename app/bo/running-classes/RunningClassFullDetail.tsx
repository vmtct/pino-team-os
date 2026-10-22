"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { F3RunningClass } from "@/lib/f3-delivery-api";
import { BoFullDetail } from "../components/BoFullDetail";

export function RunningClassFullDetail({ record }: { record: F3RunningClass | null }) {
  const pathname = usePathname();
  const search = useSearchParams();
  if (!record) return <p role="status">Running Class not found or unavailable.</p>;
  const currentUrl = `${pathname}?${search.toString()}`;
  const tableQuery = new URLSearchParams(search.toString());
  tableQuery.delete("detail");
  tableQuery.delete("tab");
  const tableReturn = `/bo/running-classes${tableQuery.size ? `?${tableQuery.toString()}` : ""}`;
  return <BoFullDetail title={record.operationalName} description="Canonical Running Class · Core read-only projection" currentUrl={currentUrl} returnTo={tableReturn} activeTab={search.get("tab")} tabs={[
    { id: "overview", label: "Overview", content: <dl><dt>Status</dt><dd>{record.status}</dd><dt>Weekday</dt><dd>{record.weekdayIso}</dd><dt>Time</dt><dd>{record.windowStartsLocal}–{record.windowEndsLocal}</dd><dt>Optimal capacity</dt><dd>{record.optimalConcurrentCapacity}</dd><dt>Hard capacity</dt><dd>{record.hardConcurrentCapacity ?? "Not set"}</dd></dl> },
    { id: "identity", label: "Identity", content: <dl><dt>Canonical ID</dt><dd>{record.id}</dd><dt>Program ID</dt><dd>{record.pathProgramId}</dd><dt>Center ID</dt><dd>{record.centerId}</dd><dt>Space ID</dt><dd>{record.learningSpaceId}</dd><dt>Version</dt><dd>{record.version}</dd></dl> },
  ]} />;
}
