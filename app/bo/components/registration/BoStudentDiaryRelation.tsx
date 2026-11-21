"use client";

import { useState } from "react";
import { type BoRecord, type BoTableState } from "@/lib/bo-registration";
import { studentSubscriptionTableState } from "@/lib/bo-student-subscription-rows";
import school from "@/public/bo-authority-source/school-adapters.js";
import { BoDataTable } from "./BoDataTable";
import { BoQuickView } from "./BoQuickView";
import { BoTableSettings, type BoSavedView } from "./BoTableSettings";

const diaryModule = {
  ...school.modules.subscriptions,
  label: "Diary",
  fields: [
    ["name", "Học viên"], ["mission", "Nhiệm vụ"], ["date", "Ngày học"], ["className", "Lớp"],
    ["createdAt", "Created Time"], ["createdBy", "Created By"],
    ["updatedAt", "Last Modified Time"], ["updatedBy", "Last Modified By"],
  ].map(([key, label]) => ({key, label, type: "text" as const, icon: "Aa", w: 160, readonly: true})),
};

export function BoStudentDiaryRelation({studentName}: {studentName: string}) {
  const rows: BoRecord[] = [{
    id: "preview-diary", name: studentName, mission: "Luyện nhịp", date: "20/11/2026",
    className: "Piano", createdAt: "20/11/2026 · 18:00", createdBy: "Giáo viên mẫu",
    updatedAt: "—", updatedBy: "—",
  }];
  const [detail, setDetail] = useState<BoRecord | null>(null);
  const [drawer, setDrawer] = useState<BoRecord | null>(null);
  const [table, setTable] = useState<BoTableState>(() => studentSubscriptionTableState(diaryModule.fields));
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [settings, setSettings] = useState<string | null>(null);
  const [views, setViews] = useState<BoSavedView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);

  const update = (patch: Partial<BoTableState>) => {
    setTable(current => ({ ...current, ...patch }));
    setActiveView(null);
    setPage(1);
  };

  if (detail) return <section className="v24-prop-section" aria-label="Chi tiết Diary">
    <button type="button" onClick={() => setDetail(null)}>Quay lại Diary</button>
    <div className="v24-prop-grid">{diaryModule.fields.map(field => <div className="v24-prop-item" key={field.key}>
      <div className="v24-prop-key">{field.label}</div>
      <div className="v24-prop-value readonly">{String(detail[field.key] ?? "—")}</div>
    </div>)}</div>
  </section>;

  return <>

    <BoDataTable
      module={diaryModule}
      showChrome={false}
      rows={rows}
      loadState={"ready"}
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
        setTable(view?.state ?? studentSubscriptionTableState(diaryModule.fields));
        setActiveView(view?.id ?? null);
        setPage(1);
      }}
      reset={() => update(studentSubscriptionTableState(diaryModule.fields))}
      undo={() => {}}
      canUndo={false}
    />
    {drawer ? <BoQuickView
      module={diaryModule}
      record={drawer}
      onClose={() => setDrawer(null)}
      onDetail={() => { setDetail(drawer); setDrawer(null); }}
    /> : null}
    {settings ? <BoTableSettings
      screen={settings}
      setScreen={setSettings}
      onClose={() => setSettings(null)}
      fields={diaryModule.fields}
      rows={rows}
      value={table}
      update={update}
      views={views}
      setViews={setViews}
      applyView={view => { setTable(view.state); setActiveView(view.id); }}
    /> : null}
  </>;
}
