"use client";

import { useState } from "react";
import { DetailFrame } from "@/app/components/workspace-renderer/DetailFrame";
import { BoValue } from "./BoValue";
import { defaultTable, type BoRecord, type BoTableState } from "@/lib/bo-registration";
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
  const [table, setTable] = useState<BoTableState>(() => defaultTable(diaryModule.fields));
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

  if (detail) return <DetailFrame title="Diary" subtitle={detail.name} mobileMenu={null} onBack={() => setDetail(null)}>
    <section className="v24-prop-section">
      <div className="v24-section-heading"><h4>Thông tin chính</h4></div>
      <div className="v24-prop-grid">{diaryModule.fields.map(field => <div className="v24-prop-item" key={field.key}>
        <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
        <div className="v24-prop-value readonly"><BoValue field={field} value={detail[field.key]} full /></div>
      </div>)}</div>
    </section>
  </DetailFrame>;

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
        setTable(view?.state ?? defaultTable(diaryModule.fields));
        setActiveView(view?.id ?? null);
        setPage(1);
      }}
      reset={() => update(defaultTable(diaryModule.fields))}
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
