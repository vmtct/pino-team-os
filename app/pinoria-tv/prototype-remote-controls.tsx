"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  PINORIA_SHOP_CATEGORIES,
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  type ShopCatalogItem,
  type ShopCategoryId,
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
const SHOP_PAGE_SIZE = 6;
const SHOP_MOCK_STUDENT = MOCK_STUDENTS[0];

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

function RemoteShell({ title, open, setOpen, children, panelWidth = 360 }: { title: string; open: boolean; setOpen: (next: boolean) => void; children: React.ReactNode; panelWidth?: number }) {
  return <>
    <button data-prototype-remote-launcher style={launcherStyle} onClick={() => setOpen(!open)}>{open ? "Đóng remote" : `Remote · ${title}`}</button>
    {open ? <aside data-prototype-remote-panel style={{ ...panelStyle, width: `min(${panelWidth}px,calc(100vw - 28px))` }}>
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
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Chạm tab hoặc món để điều khiển màn hình TV.");

  useEffect(() => {
    let stopped = false;
    const loadCatalog = () => void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { items?: ShopCatalogItem[] }) => { if (!stopped && Array.isArray(data.items)) setCatalog(data.items); })
      .catch(() => undefined);

    const poll = () => void fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${SURFACE_ID}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(async (data: { session?: ShopSessionSnapshot }) => {
        if (stopped || !data.session) return;
        if (data.session.subject.id !== SHOP_MOCK_STUDENT.id) {
          const response = await fetch(PINORIA_SHOP_RELAY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ surfaceId: SURFACE_ID, op: "set-subject", subject: SHOP_MOCK_STUDENT }) });
          const fixed = await response.json().catch(() => ({})) as { session?: ShopSessionSnapshot };
          if (!stopped && fixed.session) setSession(fixed.session);
          return;
        }
        setSession(data.session);
      })
      .catch(() => undefined);

    loadCatalog();
    poll();
    const timer = window.setInterval(poll, 650);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  const category = session?.category ?? "all";
  const filtered = useMemo(() => category === "all" ? catalog : catalog.filter((item) => item.category === category), [catalog, category]);
  const current = useMemo(() => catalog.find((item) => item.assetId === session?.selectedAssetId) ?? filtered[0] ?? catalog[0], [catalog, filtered, session?.selectedAssetId]);
  const selectedIndex = current ? filtered.findIndex((item) => item.assetId === current.assetId) : -1;
  const page = Math.max(0, Math.floor(Math.max(0, selectedIndex) / SHOP_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(filtered.length / SHOP_PAGE_SIZE));
  const visibleItems = filtered.slice(page * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE + SHOP_PAGE_SIZE);
  const owned = !!current && !!session?.ownedAssetIds.includes(current.assetId);

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

  async function selectCategory(next: ShopCategoryId) {
    const ok = await post({ op: "set-category", category: next }, `Đang xem ${PINORIA_SHOP_CATEGORIES.find((item) => item.id === next)?.label ?? "danh mục"}.`);
    if (!ok) return;
    const first = next === "all" ? catalog[0] : catalog.find((item) => item.category === next);
    if (first) await post({ op: "preview", assetId: first.assetId }, `Đang thử ${first.displayName}.`);
  }

  async function preview(item: ShopCatalogItem) {
    await post({ op: "preview", assetId: item.assetId }, `Đang thử ${item.displayName}.`);
  }

  async function goPage(nextPage: number) {
    const first = filtered[nextPage * SHOP_PAGE_SIZE];
    if (first) await preview(first);
  }

  async function purchaseCurrent() {
    if (!current || owned) return;
    await post({ op: "confirm-purchase", assetId: current.assetId, pricePls: current.pricePls }, `Đã xử lý mua ${current.displayName}.`);
  }

  return <RemoteShell title="Pinoria Shop" open={open} setOpen={setOpen}>
    <div data-remote-fixed-student style={{ marginTop: 13, padding: "11px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderRadius: 15, border: "1px solid rgba(255,255,255,.09)", background: "rgba(255,255,255,.035)" }}>
      <div><small style={{ display: "block", color: "rgba(230,224,214,.44)", fontSize: 8.5, fontWeight: 900, letterSpacing: ".12em" }}>HỌC VIÊN MẪU</small><strong style={{ display: "block", marginTop: 2, fontSize: 15 }}>{SHOP_MOCK_STUDENT.name}</strong></div>
      <div style={{ textAlign: "right" }}><strong style={{ color: "#ecd184", fontSize: 15 }}>{session?.subject.pls ?? SHOP_MOCK_STUDENT.pls} PLS</strong><small style={{ display: "block", marginTop: 2, color: "rgba(230,224,214,.42)", fontSize: 8.5 }}>TV đồng bộ trực tiếp</small></div>
    </div>

    <span style={sectionLabel}>NAV TRÊN TV</span>
    <div data-remote-shop-tabs style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
      {PINORIA_SHOP_CATEGORIES.map((item) => {
        const active = item.id === category;
        return <button key={item.id} disabled={busy} data-active={active ? "true" : "false"} onClick={() => void selectCategory(item.id)} style={{ minWidth: 0, minHeight: 42, padding: "7px 5px", borderRadius: 12, border: active ? "1px solid rgba(241,207,127,.58)" : "1px solid rgba(255,255,255,.08)", background: active ? "linear-gradient(180deg,rgba(235,201,119,.28),rgba(198,151,66,.16))" : "rgba(255,255,255,.035)", color: active ? "#f3d88e" : "rgba(245,239,229,.66)", boxShadow: active ? "0 8px 20px rgba(204,158,73,.13),inset 0 1px rgba(255,255,255,.08)" : undefined, fontSize: 9.5, lineHeight: 1.05, fontWeight: 900, cursor: "pointer", overflow: "hidden" }}><span style={{ display: "block", marginBottom: 3, fontSize: 13 }}>{item.icon}</span><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span></button>;
      })}
    </div>

    <div style={{ ...sectionLabel, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span>ITEM ĐANG HIỆN TRÊN TV</span>
      <span style={{ color: "rgba(235,226,207,.62)", letterSpacing: 0, fontSize: 9 }}>{filtered.length} món · trang {page + 1}/{totalPages}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, margin: "-2px 0 8px" }}>
      {Array.from({ length: totalPages }).map((_, index) => <button key={index} aria-label={`Trang ${index + 1}`} disabled={busy} onClick={() => void goPage(index)} style={{ width: index === page ? 25 : 9, height: 8, padding: 0, borderRadius: 99, border: 0, background: index === page ? "#dbc06f" : "rgba(255,255,255,.14)", cursor: "pointer" }} />)}
    </div>

    <div data-remote-shop-grid style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 }}>
      {visibleItems.map((item) => {
        const active = current?.assetId === item.assetId;
        const isOwned = !!session?.ownedAssetIds.includes(item.assetId);
        return <button key={item.assetId} data-remote-shop-item data-active={active ? "true" : "false"} disabled={busy} onClick={() => void preview(item)} style={{ minWidth: 0, minHeight: 58, padding: "10px 11px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 10px", alignItems: "center", gap: 8, borderRadius: 13, border: active ? "1px solid rgba(237,199,111,.76)" : "1px solid rgba(255,255,255,.08)", background: active ? "linear-gradient(180deg,rgba(111,74,43,.42),rgba(40,28,22,.72))" : "rgba(255,255,255,.035)", color: "#f1ece3", boxShadow: active ? "0 8px 22px rgba(205,158,69,.13)" : undefined, textAlign: "left", cursor: "pointer" }}>
          <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}><strong style={{ minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 11.5, lineHeight: 1.18 }}>{item.displayName}</strong>{isOwned ? <span aria-label="Đã sở hữu" style={{ flex: "0 0 auto", color: "#a9da91", fontSize: 11 }}>✓</span> : null}</span>
          <span aria-label={active ? "Đang thử" : undefined} style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#e2bf68" : "transparent", boxShadow: active ? "0 0 12px rgba(226,191,104,.45)" : undefined }} />
        </button>;
      })}
      {!visibleItems.length ? <div style={{ gridColumn: "1 / -1", padding: 20, borderRadius: 14, border: "1px dashed rgba(255,255,255,.1)", color: "rgba(240,235,224,.45)", fontSize: 10, textAlign: "center" }}>Đang tải các món trên TV…</div> : null}
    </div>

    {current ? <div data-remote-shop-action style={{ marginTop: 9, padding: "9px 10px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 10, borderRadius: 13, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
      <div style={{ minWidth: 0 }}><small style={{ display: "block", color: "rgba(230,224,214,.42)", fontSize: 7.5, fontWeight: 900, letterSpacing: ".08em" }}>ĐANG THỬ TRÊN TV</small><strong style={{ display: "block", marginTop: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: 11 }}>{current.displayName}</strong></div>
      <button disabled={busy || owned} data-remote-buy onClick={() => void purchaseCurrent()} style={{ ...actionStyle, minHeight: 36, padding: "0 12px", background: owned ? "rgba(83,127,69,.13)" : "linear-gradient(180deg,rgba(226,190,105,.24),rgba(180,131,54,.16))", color: owned ? "#a9d79a" : "#f0d183", borderColor: owned ? "rgba(139,193,119,.2)" : "rgba(231,194,106,.25)", fontSize: 9.5 }}>{owned ? "✓ Đã có" : `Mua · ${current.pricePls} PLS`}</button>
    </div> : null}

    <p style={{ minHeight: 17, margin: "9px 0 0", color: "rgba(235,229,218,.52)", fontSize: 9.5, lineHeight: 1.4 }}>{status}</p>
  </RemoteShell>;
}
