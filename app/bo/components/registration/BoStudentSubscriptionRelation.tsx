"use client";

import { useEffect, useState } from "react";
import { boApi } from "@/lib/bo-api";
import { defaultTable, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import { studentSubscriptionRows } from "@/lib/bo-student-subscription-rows";
import school from "@/public/bo-authority-source/school-adapters.js";
import { BoDataTable } from "./BoDataTable";
import { BoQuickView } from "./BoQuickView";
import { BoTableSettings, type BoSavedView } from "./BoTableSettings";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; studentName: string; rows: BoRecord[] };

export const subscriptionModule = school.modules.subscriptions;

/** Native V2.5 grid/drawer reused inside the active /bo Student Full Detail. Read-only. */
export function BoStudentSubscriptionRelation({
  studentId, onFullDetail,
}: {
  studentId: string;
  onFullDetail: (record: BoRecord) => void;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [drawer, setDrawer] = useState<BoRecord | null>(null);
  const [table, setTable] = useState<BoTableState>(() => defaultTable(subscriptionModule.fields));
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settings, setSettings] = useState<string | null>(null);
  const [views, setViews] = useState<BoSavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoad({ state: "loading" });
    setDrawer(null);
    void boApi.learnerLifecycle(studentId).then(data => {
      if (active) setLoad({ state: "ready", studentName: data.student.displayName, rows: studentSubscriptionRows(data, studentId) });
    }).catch((err: unknown) => {
      if (active) setLoad({ state: "error", message: err instanceof Error ? err.message : "Không thể tải Subscription." });
    });
    return () => { active = false; };
  }, [studentId]);

  const update = (patch: Partial<BoTableState>) => {
    setTable(current => ({ ...current, ...patch }));
    setActiveView(null);
    setPage(1);
  };

  return <>
    <div className="filter-chips active" aria-label="Bộ lọc cố định theo học viên">
      <span className="chip">Học viên = {load.state === "ready" ? load.studentName : studentId}</span>
    </div>
    <BoDataTable
      module={subscriptionModule}
      rows={load.state === "ready" ? load.rows : []}
      loadState={load.state === "error" ? load.message : load.state}
      value={table}
      update={update}
      page={page}
      setPage={setPage}
      onOpen={setDrawer}
      selected={drawer?.id}
      onSettings={setSettings}
      filterOpen={filterOpen}
      setFilterOpen={setFilterOpen}
      views={views}
      changeViews={setViews}
      activeView={activeView}
      applyView={view => {
        setTable(view?.state ?? defaultTable(subscriptionModule.fields));
        setActiveView(view?.id ?? null);
        setPage(1);
      }}
      reset={() => update(defaultTable(subscriptionModule.fields))}
      undo={() => {}}
      canUndo={false}
    />
    {drawer ? <BoQuickView
      module={subscriptionModule}
      record={drawer}
      onClose={() => setDrawer(null)}
      onDetail={() => { onFullDetail(drawer); setDrawer(null); }}
    /> : null}
    {settings ? <BoTableSettings
      screen={settings}
      setScreen={setSettings}
      onClose={() => setSettings(null)}
      fields={subscriptionModule.fields}
      rows={load.state === "ready" ? load.rows : []}
      value={table}
      update={update}
      views={views}
      setViews={setViews}
      applyView={view => { setTable(view.state); setActiveView(view.id); }}
    /> : null}
  </>;
}
