"use client";

import { useEffect, useMemo, useState } from "react";
import { boApi } from "@/lib/bo-api";
import type { BoWorkforcePlanningBootstrap, BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import styles from "../../bo.module.css";

type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; value: BoWorkforceWeeklyPlanning };

export function WorkforceReadOnlyView() {
  const [bootstrap, setBootstrap] = useState<BoWorkforcePlanningBootstrap | null>(null);
  const [centerId, setCenterId] = useState("");
  const [weekId, setWeekId] = useState("");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [filter, setFilter] = useState("");
  const weeks = useMemo(() => bootstrap?.termWeeks ?? [], [bootstrap]);
  useEffect(() => {
    let alive = true;
    boApi.workforcePlanningBootstrap().then((data) => {
      if (!alive) return;
      setBootstrap(data);
      setCenterId(data.centers[0]?.id ?? "");
      setWeekId(data.termWeeks[0]?.id ?? "");
      if (!data.centers.length || !data.termWeeks.length) setState({ kind: "error", message: "Chưa có Center hoặc TermWeek được cấp quyền." });
    }).catch((error: unknown) => { if (alive) setState({ kind: "error", message: String(error) }); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!centerId || !weekId) return;
    let alive = true;
    boApi.workforcePlanning(centerId, weekId).then((value) => { if (alive) setState({ kind: "ready", value }); })
      .catch((error: unknown) => { if (alive) setState({ kind: "error", message: String(error) }); });
    return () => { alive = false; };
  }, [centerId, weekId]);
  const data = state.kind === "ready" ? state.value : null;
  const staffName = (id: string) => data?.staff.find((s) => s.id === id)?.displayLabel ?? id;
  const shiftName = (id: string) => data?.templates.find((s) => s.id === id)?.displayLabel ?? id;
  const matches = (values: unknown[]) => values.some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase()));
  const table = (title: string, headers: string[], rows: Array<Array<string | number>>) => (
    <section aria-label={title} style={{ marginTop: 24 }}>
      <h2>{title} <small>({rows.length})</small></h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead><tr>{headers.map((h) => <th key={h} style={{ padding: 12, borderBottom: "1px solid #ccc" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.filter(matches).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} style={{ padding: 12, borderBottom: "1px solid #eee" }}>{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
  return <main className={styles.page ?? ""} style={{ padding: 24 }}>
    <h1>Workforce · Read-only</h1>
    <p>Chỉ đọc dữ liệu API theo Center được cấp quyền. Không tạo hoặc thay đổi lịch.</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <label>Center <select aria-label="Center" value={centerId} onChange={(e) => { setCenterId(e.target.value); setState({ kind: "loading" }); }}>{bootstrap?.centers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>
      <label>TermWeek <select aria-label="TermWeek" value={weekId} onChange={(e) => { setWeekId(e.target.value); setState({ kind: "loading" }); }}>{weeks.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.startDate}</option>)}</select></label>
      <label>Tìm kiếm <input aria-label="Tìm kiếm" value={filter} onChange={(e) => setFilter(e.target.value)} /></label>
    </div>
    {state.kind === "loading" && <p role="status">Đang tải dữ liệu…</p>}
    {state.kind === "error" && <p role="alert">{state.message}</p>}
    {data && <>
      {table("Term Weeks", ["Mã tuần", "Bắt đầu", "Kết thúc"], weeks.map((w) => [w.code, w.startDate, w.endDate]))}
      {table("Center Shift Plan", ["Center", "Tuần", "Đăng ký", "Lập lịch"], [[centerId, weekId, data.windows?.availability.state ?? "Chưa có", data.windows?.planning.state ?? "Chưa có"]])}
      {table("Staff Availability", ["Nhân sự", "Trạng thái", "Ngày", "Ca"], data.availability.flatMap((a) => a.items.length ? a.items.map((item) => [staffName(a.staffMemberId), a.status, item.workDate, shiftName(item.shiftTemplateId)]) : [[staffName(a.staffMemberId), a.status, "—", "—"]]))}
      {table("Shift Assignments", ["Nhân sự", "Ngày", "Ca", "Trạng thái"], data.assignments.map((a) => [staffName(a.staffMemberId), a.workDate, shiftName(a.shiftTemplateId), a.status]))}
    </>}
  </main>;
}
