"use client";

import { useMemo, useState } from "react";

type Entry = { id: string; checkType: string; createdTime: string; roundedTime: string; ipAddress: string; workContent: string };

const PAGE_SIZE = 15;
const TZ = "Asia/Ho_Chi_Minh";

function parsePinoTime(value: string): Date | null {
  if (!value) return null;
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasTimezone ? value : `${value}+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPinoTime(value: string): string {
  const date = parsePinoTime(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function pinoDateKey(value: string): string {
  const date = parsePinoTime(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function TimesheetTable({ entries }: { entries: Entry[] }) {
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (type !== "all" && entry.checkType !== type) return false;
      const date = pinoDateKey(entry.roundedTime || entry.createdTime);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [entries, type, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetPage() { setPage(1); }
  function clearFilters() { setType("all"); setFrom(""); setTo(""); setPage(1); }

  return <>
    <div className="card section" style={{ marginTop: 24 }}>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}><span className="muted">Loại</span><select value={type} onChange={(e) => { setType(e.target.value); resetPage(); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}><option value="all">Tất cả</option><option value="Check in">Check in</option><option value="Check out">Check out</option></select></label>
        <label style={{ display: "grid", gap: 6 }}><span className="muted">Từ ngày</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }} /></label>
        <label style={{ display: "grid", gap: 6 }}><span className="muted">Đến ngày</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" }} /></label>
        <button type="button" onClick={clearFilters} className="button">Xóa bộ lọc</button>
      </div>
    </div>

    <div className="card section" style={{ marginTop: 16, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Thời gian tạo", "Rounded time · tính lương", "Loại", "IP Address", "Nội dung"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" }}>{heading}</th>)}</tr></thead><tbody>{visible.length ? visible.map((entry) => <tr key={entry.id}><td style={{ padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{formatPinoTime(entry.createdTime)}</td><td style={{ padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", fontWeight: 700 }}>{formatPinoTime(entry.roundedTime)}</td><td style={{ padding: "12px 10px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{entry.checkType || "—"}</td><td style={{ padding: "12px 10px", borderBottom: "1px solid #eee", fontFamily: "monospace" }}>{entry.ipAddress || "—"}</td><td style={{ padding: "12px 10px", borderBottom: "1px solid #eee" }}>{entry.workContent || "—"}</td></tr>) : <tr><td colSpan={5} style={{ padding: 24, textAlign: "center" }} className="muted">Không có bản ghi phù hợp.</td></tr>}</tbody></table>
    </div>

    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
      <span className="muted">Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} bản ghi</span>
      <div className="row" style={{ gap: 8 }}><button type="button" className="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Trước</button><span className="pill">{safePage} / {pageCount}</span><button type="button" className="button" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Sau →</button></div>
    </div>
  </>;
}
