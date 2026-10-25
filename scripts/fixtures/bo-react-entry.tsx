// Local-only test entry; never an application route or deployed fixture.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BoRegistrationWorkspace } from "../../app/bo/components/registration/BoRegistrationWorkspace";
import { BoTypedEditor } from "../../app/bo/components/registration/BoTypedEditor";
import { BoValue } from "../../app/bo/components/registration/BoValue";
import { BoFullDetail } from "../../app/bo/components/registration/BoFullDetail";
import { BoQuickView } from "../../app/bo/components/registration/BoQuickView";
import { BoDataTable } from "../../app/bo/components/registration/BoDataTable";
import { defaultTable, type BoField, type BoRecord } from "../../lib/bo-registration";
const query = new URLSearchParams(location.search);
const types = ["text", "number", "currency", "date", "datetime", "select", "boolean", "relation", "multirelation", "multiselect", "person", "textarea", "email", "url"] as const;
const fields: BoField[] = types.map((type, i) => ({ key: type, label: type, type, icon: "Aa", w: 172, options: ["Một", "Hai", "Ba", "Bốn", "Năm"] }));
const notes = "Dòng đầu đầy đủ, dài hơn bốn mươi hai ký tự để kiểm tra toàn bộ nội dung.\nDòng thứ hai có dấu tiếng Việt và giữ nguyên xuống dòng.";
const initial = Object.fromEntries(types.map(type => [type, ["multiselect", "multirelation"].includes(type) ? ["Một", "Hai", "Ba", "Bốn", "Năm"] : type === "boolean" ? true : type === "date" ? "2026-10-25" : type === "datetime" ? "2026-10-25T17:30" : type === "email" ? "" : type === "url" ? "https://pinohouse.art" : ["number", "currency"].includes(type) ? 12 : type === "textarea" ? notes : "Một"]));
const record: BoRecord = { ...initial, id: "00000000-0000-4000-8000-000000000001", name: "Hồ sơ kiểm tra" };
function TypesHarness() {
  const [row, setRow] = useState(record), [editor, setEditor] = useState<{ field: BoField; anchor: HTMLElement } | null>(null);
  const mode = query.get("testTypes");
  return <><div id="app"><main id="detail-body"><div id="type-values" className={mode === "drawer" ? "property-section" : mode === "detail" ? "v24-prop-grid" : "table-scroll"}>{fields.map(f => <div className={mode === "drawer" ? "property-row" : "v24-prop-item"} key={f.key}><div className="v24-prop-key">{f.label}</div><button type="button" className={mode === "drawer" ? "property-control" : "v24-prop-value writable"} data-type={f.type} onClick={e => setEditor({ field: f, anchor: e.currentTarget })}><BoValue field={f} value={row[f.key]} full={mode === "detail"} /></button></div>)}</div></main></div>{editor ? <BoTypedEditor field={editor.field} value={row[editor.field.key]} anchor={editor.anchor} onClose={() => setEditor(null)} onSave={v => setRow(r => ({ ...r, [editor.field.key]: v }))} /> : null}</>;
}
function AnchorHarness() {
  const [table, setTable] = useState(defaultTable(fields)), [drawer, setDrawer] = useState(false), [detail, setDetail] = useState(false);
  const definition = { label: "Hồ sơ đăng ký", group: "HỒ SƠ", fields };
  return <div id="app"><div className="shell"><main className="workspace">{detail ? <BoFullDetail module={definition} moduleKey="anchor" record={record} onBack={() => setDetail(false)} mobileMenu={null} /> : <section id="list-screen"><div className="page-heading"><h1>Hồ sơ đăng ký</h1></div><BoDataTable module={definition} rows={[record]} loadState="ready" value={table} update={p => setTable(t => ({ ...t, ...p }))} page={1} setPage={() => {}} onOpen={() => setDrawer(true)} onSettings={() => {}} filterOpen={false} setFilterOpen={() => {}} views={[]} changeViews={() => {}} activeView={null} applyView={() => {}} reset={() => {}} undo={() => {}} canUndo={false} /></section>}</main></div>{drawer ? <BoQuickView module={definition} record={record} onClose={() => setDrawer(false)} onDetail={() => { setDrawer(false); setDetail(true); }} /> : null}</div>;
}
const options = Object.fromEntries(["centerId", "from", "to"].flatMap(key => query.has(key) ? [[key, query.get(key)!]] : []));
createRoot(document.getElementById("root")!).render(query.has("testTypes") ? <TypesHarness /> : query.has("anchor") ? <AnchorHarness /> : <BoRegistrationWorkspace currentUser={{ displayName: "BO Manager" }} moduleKey={query.get("module") || "students"} options={options} />);
