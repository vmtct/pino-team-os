"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_CATEGORIES,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  type ShopCatalogItem,
  type ShopCategoryId,
  type ShopSessionSnapshot,
  type ShopSubject,
} from "../../../pinoria-tv/shop-types";

const SUBJECTS: ShopSubject[] = [
  { id: "bo", name: "Bơ", pls: 420 },
  { id: "tri", name: "Trí", pls: 360 },
  { id: "an", name: "An", pls: 280 },
  { id: "lan", name: "Lan", pls: 520 },
  { id: "mai", name: "Mai", pls: 340 },
];

const TV_RELAY_URL = "/api/pinoria-prototype/tv-relay";

async function postShop(body: Record<string, unknown>) {
  const response = await fetch(PINORIA_SHOP_RELAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surfaceId: PINORIA_SHOP_SURFACE_ID, ...body }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { session?: ShopSessionSnapshot; error?: string };
  if (!response.ok) throw new Error(data.error || `SHOP_${response.status}`);
  return data.session;
}

export function ShopRemote() {
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);
  const [tvOnline, setTvOnline] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setCatalog(data.items);
      })
      .catch(() => setError("Không đọc được catalog asset."));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void postShop({ op: "open", subject: SUBJECTS[0] })
      .then((next) => next && setSession(next))
      .catch(() => setError("Không mở được Shop trên TV."));
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [shopResponse, tvResponse] = await Promise.all([
          fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${PINORIA_SHOP_SURFACE_ID}`, { cache: "no-store" }),
          fetch(`${TV_RELAY_URL}?surfaceId=${PINORIA_SHOP_SURFACE_ID}`, { cache: "no-store" }),
        ]);
        if (shopResponse.ok) {
          const data = await shopResponse.json() as { session?: ShopSessionSnapshot };
          if (!stopped && data.session) setSession(data.session);
        }
        if (tvResponse.ok) {
          const data = await tvResponse.json() as { surface?: { online?: boolean } };
          if (!stopped) setTvOnline(!!data.surface?.online);
        }
      } catch {
        if (!stopped) setTvOnline(false);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 900);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  const category = session?.category ?? "all";
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    return catalog.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!normalized) return true;
      return `${item.displayName} ${item.slug}`.toLocaleLowerCase("vi-VN").includes(normalized);
    });
  }, [catalog, category, query]);

  const selected = catalog.find((item) => item.assetId === session?.selectedAssetId) ?? visible[0];
  const selectedOwned = !!selected && !!session?.ownedAssetIds.includes(selected.assetId);
  const pending = catalog.find((item) => item.assetId === session?.pendingPurchaseAssetId);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const next = await postShop(body);
      if (next) setSession(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Shop relay error");
    } finally {
      setBusy(false);
    }
  }

  function selectCategory(next: ShopCategoryId) {
    setQuery("");
    void mutate({ op: "set-category", category: next });
  }

  function selectSubject(next: ShopSubject) {
    void mutate({ op: "set-subject", subject: next });
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#110e0d", color: "#f5eee7", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", display: "grid", gridTemplateRows: "auto auto auto 1fr auto" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, padding: "14px 14px 12px", background: "rgba(17,14,13,.96)", borderBottom: "1px solid rgba(255,255,255,.07)", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "#caa465", fontWeight: 900, letterSpacing: ".12em" }}>PINORIA STAFF · SHOP REMOTE</div>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 850 }}>
              {session?.subject.name ?? "Bơ"} · {session?.subject.pls ?? 420} PLS
              <span style={{ width: 7, height: 7, borderRadius: 99, background: tvOnline ? "#7ecf82" : "#766c68", boxShadow: tvOnline ? "0 0 12px rgba(126,207,130,.55)" : "none" }} />
            </div>
            <div style={{ marginTop: 2, fontSize: 10, color: "rgba(246,238,229,.42)" }}>{tvOnline ? "Đang điều khiển RECEPTION TV" : "TV chưa heartbeat"}</div>
          </div>
          <button onClick={() => void mutate({ op: session?.open ? "close" : "open", subject: session?.subject ?? SUBJECTS[0] })} disabled={busy} style={{ border: "1px solid rgba(232,193,118,.22)", borderRadius: 10, padding: "8px 10px", background: session?.open ? "rgba(131,77,53,.22)" : "rgba(77,116,68,.22)", color: session?.open ? "#e6b69d" : "#a7d99b", fontSize: 10, fontWeight: 850 }}>
            {session?.open ? "Đóng Shop" : "Mở Shop"}
          </button>
        </div>

        <div style={{ marginTop: 11, display: "flex", gap: 6, overflowX: "auto", paddingBottom: 1 }}>
          {SUBJECTS.map((subject) => {
            const active = session?.subject.id === subject.id;
            return <button key={subject.id} onClick={() => selectSubject(subject)} style={{ flex: "0 0 auto", border: active ? "1px solid rgba(215,170,91,.5)" : "1px solid rgba(255,255,255,.08)", borderRadius: 999, padding: "5px 9px", background: active ? "rgba(195,143,66,.18)" : "rgba(255,255,255,.025)", color: active ? "#efc979" : "rgba(246,238,229,.55)", fontSize: 9, fontWeight: 800 }}>{subject.name}</button>;
          })}
        </div>
      </header>

      <nav style={{ display: "flex", gap: 5, overflowX: "auto", padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,.055)" }}>
        {PINORIA_SHOP_CATEGORIES.map((item) => {
          const active = category === item.id;
          return <button key={item.id} onClick={() => selectCategory(item.id)} style={{ flex: "0 0 auto", border: 0, borderRadius: 8, padding: "7px 9px", background: active ? "#7351a2" : "rgba(255,255,255,.05)", color: active ? "#fff" : "rgba(246,238,229,.62)", fontSize: 9, fontWeight: 850 }}>{item.label}</button>;
        })}
      </nav>

      <div style={{ padding: "8px 12px 7px" }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên vật phẩm..." style={{ width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.08)", borderRadius: 11, padding: "10px 11px", background: "rgba(255,255,255,.035)", color: "#f7f0e8", outline: "none", fontSize: 11 }} />
      </div>

      <section style={{ minHeight: 0, padding: "0 10px 10px", overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, padding: "6px 5px", color: "rgba(246,238,229,.38)", fontSize: 8, fontWeight: 850, letterSpacing: ".08em" }}><span>{visible.length} VẬT PHẨM</span><span>GIÁ</span><span>TV</span></div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.055)" }}>
          {visible.map((item, index) => {
            const active = selected?.assetId === item.assetId;
            const owned = !!session?.ownedAssetIds.includes(item.assetId);
            return (
              <button key={item.assetId} onClick={() => void mutate({ op: "preview", assetId: item.assetId })} disabled={busy} style={{ width: "100%", minHeight: 44, border: 0, borderBottom: "1px solid rgba(255,255,255,.055)", padding: "6px 5px", display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 54px 45px", alignItems: "center", gap: 7, textAlign: "left", background: active ? "linear-gradient(90deg,rgba(116,75,151,.44),rgba(116,75,151,.12))" : "transparent", color: "inherit" }}>
                <span style={{ color: active ? "#d7b5ff" : "rgba(246,238,229,.34)", fontSize: 9 }}>{String(index + 1).padStart(2, "0")}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: active ? "#f3e6ff" : "#eee7df" }}>{item.displayName}</strong>
                  <small style={{ display: "block", marginTop: 2, color: owned ? "#83c77c" : "rgba(246,238,229,.32)", fontSize: 8 }}>{owned ? "Đã có" : item.previewable ? "Thử trực tiếp" : item.category}</small>
                </span>
                <span style={{ justifySelf: "end", color: "#d7b56c", fontSize: 9, fontWeight: 800 }}>{item.pricePls}</span>
                <span style={{ justifySelf: "end", borderRadius: 7, padding: "5px 7px", background: active ? "rgba(124,82,163,.72)" : "rgba(255,255,255,.06)", color: active ? "#fff" : "rgba(246,238,229,.58)", fontSize: 8, fontWeight: 850 }}>{active ? "Đang hiện" : "Hiện"}</span>
              </button>
            );
          })}
          {!visible.length ? <div style={{ padding: 30, textAlign: "center", color: "rgba(246,238,229,.4)", fontSize: 11 }}>Chưa có asset trong category này.</div> : null}
        </div>
      </section>

      <footer style={{ position: "sticky", bottom: 0, zIndex: 30, padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", background: "rgba(17,14,13,.97)", borderTop: "1px solid rgba(255,255,255,.08)", backdropFilter: "blur(18px)" }}>
        {error ? <div style={{ marginBottom: 8, color: "#e9a29a", fontSize: 9 }}>{error}</div> : null}
        {pending ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 10, color: "rgba(246,238,229,.58)", textAlign: "center" }}>TV đang hỏi mua <strong style={{ color: "#f0d09a" }}>{pending.displayName}</strong></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.45fr", gap: 8 }}>
              <button disabled={busy} onClick={() => void mutate({ op: "cancel-purchase" })} style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,.09)", padding: 12, background: "rgba(255,255,255,.045)", color: "#eee6df", fontSize: 11, fontWeight: 850 }}>HỦY</button>
              <button disabled={busy} onClick={() => void mutate({ op: "confirm-purchase", assetId: pending.assetId, pricePls: pending.pricePls })} style={{ borderRadius: 11, border: "1px solid rgba(225,181,98,.35)", padding: 12, background: "linear-gradient(180deg,#8f67c7,#70439f)", color: "#fff", fontSize: 11, fontWeight: 900 }}>XÁC NHẬN · {pending.pricePls} PLS</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8 }}>
            <button disabled={busy} onClick={() => void mutate({ op: "set-category", category: "all" })} style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,.09)", padding: 12, background: "rgba(255,255,255,.045)", color: "#eee6df", fontSize: 10, fontWeight: 850 }}>← KỆ</button>
            <button disabled={busy || !selected || selectedOwned} onClick={() => selected && void mutate({ op: "begin-purchase", assetId: selected.assetId })} style={{ borderRadius: 11, border: "1px solid rgba(225,181,98,.35)", padding: 12, background: selectedOwned ? "rgba(77,116,68,.24)" : "linear-gradient(180deg,#8f67c7,#70439f)", color: selectedOwned ? "#a7d79a" : "#fff", fontSize: 11, fontWeight: 900, opacity: !selected ? .45 : 1 }}>{selectedOwned ? "ĐÃ SỞ HỮU" : selected ? `MUA · ${selected.pricePls} PLS` : "CHỌN VẬT PHẨM"}</button>
          </div>
        )}
      </footer>
    </main>
  );
}
