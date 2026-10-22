"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { f3DeliveryApi, type F3RunningClass } from "@/lib/f3-delivery-api";
import { BoFullDetail } from "../components/BoFullDetail";

export function RunningClassFullDetail({ classId }: { classId: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [record, setRecord] = useState<F3RunningClass | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void f3DeliveryApi.bootstrap().then(snapshot => {
      if (!active) return;
      setRecord(snapshot.runningClasses.find(item => item.id === classId) ?? null);
      setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [classId]);
  if (status === "loading") return <p role="status">Loading Running Class…</p>;
  if (status === "error") return <p role="alert">Could not load Running Class. Check access and retry.</p>;
  if (!record) return <p role="status">Running Class not found or unavailable.</p>;
  const currentUrl = `${pathname}?${search.toString()}`;
  return <BoFullDetail title={record.operationalName} description="Canonical Running Class · Core read-only projection" currentUrl={currentUrl} returnTo={search.get("returnTo")} activeTab={search.get("tab")} tabs={[
    { id: "overview", label: "Overview", content: <dl><dt>Status</dt><dd>{record.status}</dd><dt>Weekday</dt><dd>{record.weekdayIso}</dd><dt>Time</dt><dd>{record.windowStartsLocal}–{record.windowEndsLocal}</dd><dt>Optimal capacity</dt><dd>{record.optimalConcurrentCapacity}</dd><dt>Hard capacity</dt><dd>{record.hardConcurrentCapacity ?? "Not set"}</dd></dl> },
    { id: "identity", label: "Identity", content: <dl><dt>Canonical ID</dt><dd>{record.id}</dd><dt>Program ID</dt><dd>{record.pathProgramId}</dd><dt>Center ID</dt><dd>{record.centerId}</dd><dt>Space ID</dt><dd>{record.learningSpaceId}</dd><dt>Version</dt><dd>{record.version}</dd></dl> },
  ]} />;
}
