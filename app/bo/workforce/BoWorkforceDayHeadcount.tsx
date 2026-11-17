"use client";
// PAP-1939 / PAP-1934 · Epic PAP-1064 Shift Scheduling.
// Founder-approved single compact table; local presentation, no shared BO/HO schema mutation.
import type { CSSProperties } from "react";

export interface BoWorkforceDayHeadcount {
  centerId: string;
  localDate: string;
  rows: Array<{ pathProgramId: string; pathDisplayName: string; male: number; female: number; unknown: number; total: number }>;
  coverage: "PROJECTED_ENROLLMENTS_GRACE_AND_MANUAL_ONLY";
  diagnostics: string[];
}
export type DayHeadcountLoad =
  | { scope: string; status: "loading" }
  | { scope: string; status: "error" }
  | { scope: string; status: "ready"; data: BoWorkforceDayHeadcount };

export async function fetchWorkforceDayHeadcount(centerId: string, localDate: string): Promise<BoWorkforceDayHeadcount> {
  const query = new URLSearchParams({ centerId, localDate });
  const response = await fetch("/api/bo/classroom/day-headcounts?" + query, {
    method: "GET", credentials: "same-origin", cache: "no-store",
  });
  if (!response.ok) throw new Error("Không thể đọc số học viên từ Core.");
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) throw new Error("Thiếu dữ liệu học viên");
  const data = parsed.data as BoWorkforceDayHeadcount | null;
  if (!data || data.centerId !== centerId || data.localDate !== localDate || !Array.isArray(data.rows)
    || data.coverage !== "PROJECTED_ENROLLMENTS_GRACE_AND_MANUAL_ONLY"
    || !data.rows.every(r => typeof r.pathProgramId === "string" && typeof r.pathDisplayName === "string"
      && [r.male, r.female, r.unknown, r.total].every(n => Number.isSafeInteger(n) && n >= 0)
      && r.total === r.male + r.female)) {
    throw new Error("Dữ liệu học viên không khớp Center/ngày hoặc contract.");
  }
  return data;
}

const shell: CSSProperties = {
  minWidth: 0, marginBottom: 10, border: "1px solid var(--bo-color-border)",
  borderRadius: 7, overflow: "hidden",
};
const table: CSSProperties = {
  width: "100%", minWidth: 0, maxWidth: "100%", tableLayout: "fixed",
  borderCollapse: "collapse", borderSpacing: 0, fontSize: "var(--bo-font-caption)", lineHeight: 1.3,
};
const cell: CSSProperties = {
  height: 26, minHeight: 0, position: "static", padding: "4px",
  borderBottom: "1px solid var(--bo-color-border)", background: "var(--bo-color-surface)",
  fontVariantNumeric: "tabular-nums", boxSizing: "border-box",
};
const head: CSSProperties = {
  ...cell, background: "var(--bo-color-table-heading)", fontWeight: 650, cursor: "default",
  letterSpacing: "normal",
};
const first: CSSProperties = { ...cell, textAlign: "left", width: "auto", minWidth: 0, fontWeight: 600, whiteSpace: "normal", overflowWrap: "anywhere" };
const number: CSSProperties = { ...cell, width: 28, textAlign: "center", whiteSpace: "nowrap", overflow: "visible", textOverflow: "clip" };
const total: CSSProperties = { ...number, width: 34, fontWeight: 700 };
const caption: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" };

export function BoWorkforceDayHeadcount({ state, scope }: { state: DayHeadcountLoad; scope: string }) {
  const ready = state.scope === scope && state.status === "ready" ? state.data : null;
  const rows = ready?.rows ?? [];
  const emptyMessage = state.scope !== scope || state.status === "loading"
    ? "Đang tải số học viên…" : state.status === "error" ? "Không thể tải số học viên" : "Chưa có học viên dự kiến";
  return <div style={shell}>
    <table style={table} aria-label="Học viên dự kiến theo Path và giới tính">
      <caption style={caption}>
        Roster dự kiến theo ngày, chưa gồm Booking hoặc đổi lịch kiểu cũ; không phải điểm danh thực tế.
      </caption>
      <thead><tr>
        <th scope="col" style={{ ...head, textAlign: "left", width: "auto" }}>Path</th>
        <th scope="col" style={{ ...head, width: 28, textAlign: "center" }}><span aria-label="Nam" style={{ color: "var(--bo-palette-blue-34)" }}>♂</span></th>
        <th scope="col" style={{ ...head, width: 28, textAlign: "center" }}><span aria-label="Nữ" style={{ color: "var(--bo-palette-rose-01)" }}>♀</span></th>
        <th scope="col" style={{ ...head, width: 34, textAlign: "center" }}>Tổng</th>
      </tr></thead>
      <tbody>{rows.length
        ? rows.map(row => <tr key={row.pathProgramId}>
            <th scope="row" style={first}>{row.pathDisplayName}</th>
            <td style={number}>{row.male}</td><td style={number}>{row.female}</td>
            <td style={total} title={row.unknown ? "Có " + row.unknown + " học viên chưa xác định giới tính; tổng chỉ tính nam và nữ." : undefined}>{row.total}</td>
          </tr>)
        : <tr><td style={{ ...cell, textAlign: "left", color: "var(--bo-color-muted)", whiteSpace: "normal" }} colSpan={4}>{emptyMessage}</td></tr>}
      </tbody>
    </table>
  </div>;
}
