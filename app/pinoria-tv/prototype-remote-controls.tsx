"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  PINORIA_SHOP_CATEGORIES,
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  type ShopCatalogItem,
  type ShopSessionSnapshot,
} from "./shop-types";

type MockStudent = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

const MOCK_STUDENTS: MockStudent[] = [
  { id: "bo", name: "Bơ", path: "ArtChitect · Màu nước II", room: "Phòng Họa", companion: "Bùm · Ploo · Cấp 2", pls: 420, fruit: 2 },
  { id: "tri", name: "Trí", path: "PianoHouse · Cấp 4", room: "Piano House", companion: "Mây · Ploo · Cấp 2", pls: 680, fruit: 4 },
  { id: "an", name: "An", path: "ArtChitect · Minh họa I", room: "Phòng Họa", companion: "Mầm · Ploo · Cấp 1", pls: 360, fruit: 1 },
  { id: "mai", name: "Mai", path: "Little Piner · Khéo tay sáng tạo", room: "Little Piner", companion: "Chưa có Hộ Linh", pls: 240, fruit: 1 },
];

const TV_RELAY_URL = "/api/pinoria-prototype/tv-relay";
const SURFACE_ID = PINORIA_SHOP_SURFACE_ID;

const launcherStyle: CSSProperties = {
  position: "fixed", right: 14, top: 14, zIndex: 1500, padding: "9px 13px", borderRadius: 999,
  border: "1px solid rgba(255,255,255,.14)", background: "rgba(17,22,18,.88)", color: "#f4efe7",
  boxShadow: "0 12px 34px rgba(0,0,0,.28)", backdropFilter: "blur(16px)", cursor: "pointer",
  fontSize: 11, fontWeight: 900, letterSpacing: ".04em",
};

const panelStyle: CSSProperties = {
  position: "fixed", right: 14, top: 58, zIndex: 1499, width: "min(360px,calc(100vw - 28px))",
  maxHeight: "calc(100vh - 72px)", overflow: "auto", boxSizing: "border-box", padding: 16, borderRadius: 22,
  border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(160deg,rgba(32,38,31,.97),rgba(12,16,13,.97))",
  color: "#f3eee5", boxShadow: "0 28px 80px rgba(0,0,0,.44),inset 0 1px rgba(255,255,255,.04)",
  backdropFilter: "blur(22px)", fontFamily: "system-ui,sans-serif",
};

const sectionLabel: CSSProperties = { display: "block", margin: "14px 0 8px", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", color: "rgba(216,228,213,.52)", fontSize: 9, fontWeight: 900, letterSpacing: ".13em" };
const actionStyle: CSSProperties = { minHeight: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.055)", color: "#f2ece3", fontWeight: 850, cursor: "pointer" };

function RemoteShell({ title, open, setOpen, children }: { title: string; open: boolean; setOpen: (next: boolean) => void; children: React.ReactNode }) {
  return <>
    <button data-prototype-remote-launcher style={launcherStyle} onClick={() => setOpen(!open)}>{open ? "Đóng remote" : `Remote · ${title}`}</button>
    {open ? <aside data-prototype-remote-panel style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div><small style={{ display: "block", color: "rgba(220,230,218,.45)", fontSize: 9, fontWeight: 900, letterSpacing: ".14em" }}>PROTOTYPE REMOTE · RECEPTION_TV</small><strong style={{ display: "block", marginTop: 4, fontSize: 19 }}>{title}</strong></div>
        <button aria-label="Đóng remote" onClick={() => setOpen(false)} style={{ border: 0, background: "transparent", color: "rgba(245,239,229,.55)", fontSize: 20, cursor: "pointer" }}>×</button>
      </div>
      {children}
    </aside> : null}
  </>;
}

function StudentPicker({ selectedId, onSelect }: { selectedId: string; onSelect: (student: MockStudent) => void }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
    {MOCK_STUDENTS.map((student) => {
      const active = student.id === selectedId;
      return <button key={student.id} onClick={() => onSelect(student)} style={{ textAlign: "left", padding: 10, borderRadius: 13, border: active ? "1px solid rgba(199,220,177,.42)" : "1px solid rgba(255,255,255,.09)", background: active ? "rgba(142,176,120,.16)" : "rgba(255,255,255,.035)", color: "#f1ece3", cursor: "pointer" }}>
        <strong style={{ display: "block", fontSize: 13 }}>{student.name}</strong><span style={{ display: "block", marginTop: 3, color: "rgba(240,235,224,.48)", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.path}</span>
      </button>;
    })}
  </div>;
}

export function OperationalTvRemoteControl() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("bo");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Chọn học viên rồi Check-in / Check-out.");
  const student = MOCK_STUDENTS.find((item) => item.id === selectedId) ?? MOCK_STUDENTS[0];

  async function enqueue(mode: "arrival" | "departure") {
    setBusy(true);
    setStatus(`${mode === "arrival" ? "Đang check-in" : "Đang check-out"} ${student.name}…`);
    try {
      const response = await fetch(TV_RELAY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ op: "enqueue-play", surfaceId: SURFACE_ID, mode, subject: student }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      setStatus(response.ok && data.ok !== false ? `${student.name}: ${mode === "arrival" ? "Check-in đã vào hàng đợi" : "Check-out đã vào hàng đợi"}.` : `Không gửi được: ${data.error ?? response.status}`);
    } catch { setStatus("Remote tạm mất kết nối."); }
    finally { setBusy(false); }
  }

  async function ambient() {
    setBusy(true);
    try {
      const response = await fetch(TV_RELAY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ op: "enqueue-control", surfaceId: SURFACE_ID }) });
      setStatus(response.ok ? "Đã yêu cầu TV trở về Ambient." : "Không gửi được lệnh Ambient.");
    } finally { setBusy(false); }
  }

  return <RemoteShell title="Operational TV" open={open} setOpen={setOpen}>
    <span style={sectionLabel}>MOCK STUDENTS</span>
    <StudentPicker selectedId={selectedId} onSelect={(next) => setSelectedId(next.id)} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
      <button disabled={busy} data-remote-checkin style={{ ...actionStyle, background: "#dfead4", color: "#1b261c", borderColor: "#dfead4" }} onClick={() => void enqueue("arrival")}>Check-in</button>
      <button disabled={busy} data-remote-checkout style={{ ...actionStyle, background: "rgba(178,93,82,.16)", color: "#f0c1b9", borderColor: "rgba(222,130,117,.28)" }} onClick={() => void enqueue("departure")}>Check-out</button>
    </div>
    <button disabled={busy} style={{ ...actionStyle, width: "100%", marginTop: 8 }} onClick={() => void ambient()}>Trở về Ambient</button>
    <p style={{ minHeight: 17, margin: "9px 0 0", color: "rgba(235,229,218,.56)", fontSize: 10, lineHeight: 1.45 }}>{status}</p>
  </RemoteShell>;
}

export function PinoriaShopRemoteControl() {
  const [open, setOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("bo");
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Mở Shop rồi chọn món để thử trên TV.");

  useEffect(() => {
    let stopped = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" }).then((r) => r.json()).then((data: { items?: ShopCatalogItem[] }) => { if (!stopped && Array.isArray(data.items)) setCatalog(data.items); }).catch(() => undefined);
    const poll = () => void fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${SURFACE_ID}`, { cache: "no-store" }).then((r) => r.json()).then((data: { session?: ShopSessionSnapshot }) => { if (!stopped && data.session) { setSession(data.session); setSelectedStudentId(data.session.subject.id); } }).catch(() => undefined);
    poll(); const timer = window.setInterval(poll, 700); return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  const category = session?.category ?? "all";
  const filtered = useMemo(() => category === "all" ? catalog : catalog.filter((item) => item.category === category), [catalog, category]);
  const current = useMemo(() => catalog.find((item) => item.assetId === session?.selectedAssetId) ?? filtered[0] ?? catalog[0], [catalog, filtered, session?.selectedAssetId]);
  const currentIndex = current ? Math.max(0, filtered.findIndex((item) => item.assetId === current.assetId)) : 0;
  const selectedStudent = MOCK_STUDENTS.find((item) => item.id === selectedStudentId) ?? MOCK_STUDENTS[0];

  async function post(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch(PINORIA_SHOP_RELAY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ surfaceId: SURFACE_ID, ...body }) });
      const data = await response.json().catch(() => ({})) as { session?: ShopSessionSnapshot; error?: string };
      if (data.session) setSession(data.session);
      setStatus(response.ok ? success : `Không thực hiện được: ${data.error ?? response.status}`);
      return response.ok;
    } catch { setStatus("Remote tạm mất kết nối."); return false; }
    finally { setBusy(false); }
  }

  async function selectStudent(next: MockStudent) {
    setSelectedStudentId(next.id);
    await post({ op: "set-subject", subject: next }, `Đã chọn ${next.name}.`);
  }

  async function selectCategory(next: string) {
    const ok = await post({ op: "set-category", category: next }, "Đã đổi nhóm món.");
    if (!ok) return;
    const first = next === "all" ? catalog[0] : catalog.find((item) => item.category === next);
    if (first) await post({ op: "preview", assetId: first.assetId }, `Đang thử ${first.displayName}.`);
  }

  async function move(delta: number) {
    if (!filtered.length) return;
    const next = filtered[(currentIndex + delta + filtered.length) % filtered.length];
    await post({ op: "preview", assetId: next.assetId }, `Đang thử ${next.displayName}.`);
  }

  const owned = !!current && !!session?.ownedAssetIds.includes(current.assetId);

  return <RemoteShell title="Pinoria Shop" open={open} setOpen={setOpen}>
    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, color: "rgba(240,235,224,.56)", fontSize: 10 }}><span>Phiên: <b style={{ color: "#eee8df" }}>{session?.open ? "ĐANG MỞ" : "ĐÃ ĐÓNG"}</b></span><span>{session?.subject.name ?? selectedStudent.name} · <b style={{ color: "#e8cf86" }}>{session?.subject.pls ?? selectedStudent.pls} PLS</b></span></div>
    <span style={sectionLabel}>HỌC VIÊN</span>
    <StudentPicker selectedId={selectedStudentId} onSelect={(next) => void selectStudent(next)} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
      <button disabled={busy} data-remote-open-shop style={{ ...actionStyle, background: "#e5dfc9", color: "#282116" }} onClick={() => void post({ op: "open", subject: selectedStudent }, `Đã mở Shop cho ${selectedStudent.name}.`)}>Mở Shop</button>
      <button disabled={busy} style={actionStyle} onClick={() => void post({ op: "close" }, "Đã đóng Shop.")}>Đóng Shop</button>
    </div>
    <span style={sectionLabel}>DANH MỤC</span>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{PINORIA_SHOP_CATEGORIES.map((item) => <button key={item.id} disabled={busy} onClick={() => void selectCategory(item.id)} style={{ borderRadius: 999, padding: "6px 9px", border: item.id === category ? "1px solid rgba(224,198,125,.34)" : "1px solid rgba(255,255,255,.08)", background: item.id === category ? "rgba(216,193,132,.16)" : "rgba(255,255,255,.035)", color: item.id === category ? "#f0d58e" : "rgba(245,239,229,.7)", fontSize: 9, fontWeight: 850, cursor: "pointer" }}>{item.label}</button>)}</div>
    <span style={sectionLabel}>MÓN ĐANG THỬ</span>
    {current ? <div style={{ padding: 11, borderRadius: 15, border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.035)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ fontSize: 13 }}>{current.displayName}</strong><b style={{ color: owned ? "#a9d39b" : "#e6c879", fontSize: 10 }}>{owned ? "ĐÃ CÓ" : `${current.pricePls} PLS`}</b></div>
      <div style={{ marginTop: 4, color: "rgba(240,235,224,.45)", fontSize: 9 }}>{currentIndex + 1}/{filtered.length} · {current.category}</div>
      <div style={{ display: "grid", gridTemplateColumns: "42px 1fr 42px", gap: 7, marginTop: 9 }}><button disabled={busy} style={actionStyle} onClick={() => void move(-1)}>‹</button><button disabled={busy || owned} data-remote-buy style={{ ...actionStyle, background: owned ? "rgba(255,255,255,.035)" : "rgba(221,190,112,.15)", color: owned ? "rgba(245,239,229,.4)" : "#f2d68d" }} onClick={() => void post({ op: "confirm-purchase", assetId: current.assetId, pricePls: current.pricePls }, `Đã xử lý mua ${current.displayName}.`)}>{owned ? "Đã sở hữu" : `Mua · ${current.pricePls} PLS`}</button><button disabled={busy} style={actionStyle} onClick={() => void move(1)}>›</button></div>
    </div> : <p style={{ color: "rgba(240,235,224,.46)", fontSize: 10 }}>Đang tải catalog…</p>}
    <p style={{ minHeight: 17, margin: "9px 0 0", color: "rgba(235,229,218,.56)", fontSize: 10, lineHeight: 1.45 }}>{status}</p>
  </RemoteShell>;
}
