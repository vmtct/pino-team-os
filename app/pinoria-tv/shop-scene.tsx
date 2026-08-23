"use client";

import { useEffect, useMemo, useState } from "react";
import { AMBIENT_HOUSE_ARRIVAL_ASSETS } from "./arrival-visual-config";
import { PrototypeCompanion, prototypeCharacterEffects, prototypeCharacterManifest, type PrototypeCharacterSlot } from "./prototype-assets";
import { prototypeCharacterProfileForSubject } from "./prototype-character-profiles";
import {
  PINORIA_SHOP_CATALOG_URL,
  PINORIA_SHOP_CATEGORIES,
  PINORIA_SHOP_LOGO,
  PINORIA_SHOP_RELAY_URL,
  PINORIA_SHOP_SURFACE_ID,
  categoryLabel,
  type ShopCatalogItem,
  type ShopSessionSnapshot,
} from "./shop-types";

const PAGE_SIZE = 8;
const STACK_ORDER: Record<PrototypeCharacterSlot, number> = {
  back: 10,
  body: 20,
  hair: 30,
  face: 40,
  headwear: 50,
  eyewear: 60,
};

function ShopCharacterPreview({ subjectId, selected }: { subjectId: string; selected?: ShopCatalogItem }) {
  const profile = prototypeCharacterProfileForSubject(subjectId);
  const selectedSlot = selected?.previewable ? selected.slot as PrototypeCharacterSlot : null;
  const layers = prototypeCharacterManifest.layers
    .map((base) => {
      const profileSrc = profile?.layers[base.slot];
      const baseSrc = profileSrc === null ? null : profileSrc || base.src;
      const selectedSrc = selectedSlot === base.slot && selected?.layerUrl ? selected.layerUrl : undefined;
      const src = selectedSrc ?? baseSrc;
      return src ? { slot: base.slot, src, order: STACK_ORDER[base.slot] } : null;
    })
    .filter((layer): layer is { slot: PrototypeCharacterSlot; src: string; order: number } => !!layer)
    .sort((a, b) => a.order - b.order);

  return (
    <div style={{ position: "relative", width: "min(430px,35vw)", aspectRatio: "1 / 1" }}>
      <img
        src={prototypeCharacterEffects.aura.src}
        alt=""
        draggable={false}
        style={{ position: "absolute", inset: "2%", width: "96%", height: "96%", objectFit: "contain", opacity: .72, filter: "brightness(.92) drop-shadow(0 0 28px rgba(181,100,255,.28))" }}
      />
      {layers.map((layer) => (
        <img
          key={`${layer.slot}:${layer.src}`}
          src={layer.src}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", zIndex: layer.order }}
        />
      ))}
      <div style={{ position: "absolute", left: "50%", bottom: "2%", width: "45%", height: 20, transform: "translateX(-50%)", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(12,7,5,.5),transparent 70%)", filter: "blur(6px)", zIndex: 5 }} />
    </div>
  );
}

function HouseShopBackdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#1c1512" }}>
      {(Object.values(AMBIENT_HOUSE_ARRIVAL_ASSETS) as string[]).map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: "-4%",
            width: "108%",
            height: "108%",
            objectFit: "cover",
            opacity: index === 0 ? .78 : .54,
            filter: "blur(14px) brightness(.36) saturate(.58) sepia(.12)",
            transform: "scale(1.03)",
          }}
        />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 28% 48%,rgba(104,64,44,.15),transparent 38%),linear-gradient(100deg,rgba(19,12,10,.72),rgba(34,23,18,.76) 48%,rgba(17,11,9,.88))" }} />
    </div>
  );
}

export function ShopScene({ surfaceId = PINORIA_SHOP_SURFACE_ID }: { surfaceId?: string }) {
  const [catalog, setCatalog] = useState<ShopCatalogItem[]>([]);
  const [session, setSession] = useState<ShopSessionSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(PINORIA_SHOP_CATALOG_URL, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { items?: ShopCatalogItem[] }) => {
        if (!cancelled && Array.isArray(data.items)) setCatalog(data.items);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`${PINORIA_SHOP_RELAY_URL}?surfaceId=${encodeURIComponent(surfaceId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { session?: ShopSessionSnapshot };
        if (!stopped && data.session) setSession(data.session);
      } catch {
        // Keep the last shared-screen state if the local relay pauses briefly.
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 320);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [surfaceId]);

  const filtered = useMemo(() => {
    if (!session || session.category === "all") return catalog;
    return catalog.filter((item) => item.category === session.category);
  }, [catalog, session]);

  const selected = useMemo(() => {
    if (!session) return filtered[0];
    return catalog.find((item) => item.assetId === session.selectedAssetId) ?? filtered[0] ?? catalog[0];
  }, [catalog, filtered, session]);

  const page = useMemo(() => {
    const selectedIndex = selected ? filtered.findIndex((item) => item.assetId === selected.assetId) : -1;
    return Math.max(0, Math.floor(Math.max(0, selectedIndex) / PAGE_SIZE));
  }, [filtered, selected]);

  const visibleItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pendingItem = catalog.find((item) => item.assetId === session?.pendingPurchaseAssetId);
  const owned = !!selected && !!session?.ownedAssetIds.includes(selected.assetId);
  const purchaseResult = session?.purchaseResult;
  const resultItem = purchaseResult ? catalog.find((item) => item.assetId === purchaseResult.assetId) : undefined;

  return (
    <div data-pinoria-shop-scene style={{ position: "absolute", inset: 0, overflow: "hidden", color: "#f7ead7", background: "#1d1512" }}>
      <HouseShopBackdrop />
      <style>{`
        @keyframes pinoriaShopEnter { from { opacity:0; transform:scale(1.012) } to { opacity:1; transform:scale(1) } }
        @keyframes pinoriaShopSelect { 0% { box-shadow:0 0 0 rgba(245,197,91,0) } 45% { box-shadow:0 0 34px rgba(245,197,91,.28) } 100% { box-shadow:0 0 20px rgba(245,197,91,.16) } }
        @keyframes pinoriaShopToast { 0% { opacity:0; transform:translate(-50%,14px) } 18%,78% { opacity:1; transform:translate(-50%,0) } 100% { opacity:0; transform:translate(-50%,-8px) } }
      `}</style>

      <div style={{ position: "absolute", inset: "34px 52px 38px", display: "grid", gridTemplateColumns: "39% 61%", gridTemplateRows: "82px 1fr", gap: "16px 22px", animation: "pinoriaShopEnter .48s ease-out both" }}>
        <header style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={PINORIA_SHOP_LOGO} alt="Pinoria" style={{ width: 152, maxHeight: 58, objectFit: "contain", objectPosition: "left center", filter: "drop-shadow(0 7px 18px rgba(0,0,0,.32))" }} />
            <div style={{ width: 1, height: 34, background: "rgba(245,214,155,.22)" }} />
            <div>
              <div style={{ color: "#f0cb80", fontSize: 13, fontWeight: 900, letterSpacing: ".15em" }}>SHOP PINORIA</div>
              <div style={{ marginTop: 3, color: "rgba(245,235,218,.56)", fontSize: 11 }}>Con muốn thử món nào hôm nay?</div>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: 7, padding: 7, borderRadius: 18, background: "rgba(39,27,21,.74)", border: "1px solid rgba(239,199,120,.16)", boxShadow: "0 14px 34px rgba(0,0,0,.18)" }}>
            {PINORIA_SHOP_CATEGORIES.filter((item) => item.id !== "all").map((category) => {
              const active = session?.category === category.id;
              return (
                <div key={category.id} style={{ minWidth: category.id === "body" ? 104 : 72, padding: "9px 11px", borderRadius: 12, display: "grid", gridTemplateColumns: "18px auto", alignItems: "center", gap: 6, color: active ? "#2a1b12" : "rgba(249,235,210,.72)", background: active ? "linear-gradient(180deg,#f6d78d,#dcae55)" : "transparent", border: active ? "1px solid #ffe7ac" : "1px solid transparent", fontSize: 10, fontWeight: 800 }}>
                  <span style={{ fontSize: 15, textAlign: "center" }}>{category.icon}</span>
                  <span>{category.label}</span>
                </div>
              );
            })}
          </nav>

          <div style={{ display: "grid", justifyItems: "end", gap: 3, minWidth: 132 }}>
            <strong style={{ fontSize: 16 }}>{session?.subject.name ?? "Bơ"}</strong>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#f0c96f", fontSize: 13, fontWeight: 900 }}><b style={{ fontSize: 16 }}>✦</b>{session?.subject.pls ?? 420} PLS</span>
          </div>
        </header>

        <section style={{ position: "relative", minHeight: 0, borderRadius: 24, overflow: "hidden", border: "1px solid rgba(236,194,115,.18)", background: "linear-gradient(180deg,rgba(47,31,25,.62),rgba(27,18,15,.72))", boxShadow: "0 28px 54px rgba(0,0,0,.25)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 44%,rgba(133,70,183,.12),transparent 48%)" }} />
          <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "1fr auto", alignItems: "center", justifyItems: "center", padding: "18px 20px 20px" }}>
            <div style={{ position: "relative", display: "grid", placeItems: "center", alignSelf: "stretch", width: "100%" }}>
              <ShopCharacterPreview subjectId={session?.subject.id ?? "bo"} selected={selected} />
              <div style={{ position: "absolute", right: 16, bottom: 20, width: 126 }}>
                <PrototypeCompanion size="100%" style={{ filter: "drop-shadow(0 16px 18px rgba(0,0,0,.28))" }} />
              </div>
            </div>
            <div style={{ width: "100%", padding: "14px 16px", borderRadius: 16, background: "rgba(23,15,13,.68)", border: "1px solid rgba(240,196,112,.16)", boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <strong style={{ fontSize: 18, color: "#f4cf86" }}>{selected?.displayName ?? "Chọn một món để thử"}</strong>
                {selected ? <span style={{ fontSize: 11, color: owned ? "#9bd18d" : "rgba(246,232,208,.58)" }}>{owned ? "Đã có" : "Đang xem"}</span> : null}
              </div>
              <p style={{ margin: "6px 0 0", color: "rgba(246,235,217,.58)", fontSize: 11, lineHeight: 1.45 }}>
                {selected?.previewable ? "Món đang chọn được thử trực tiếp trên nhân vật của con." : "Món đang chọn được hiển thị để cả con và staff cùng xem trên TV."}
              </p>
            </div>
          </div>
        </section>

        <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
            <div style={{ color: "rgba(247,233,210,.62)", fontSize: 11 }}><strong style={{ color: "#f1cb7e" }}>{categoryLabel(session?.category ?? "all")}</strong> · {filtered.length} món</div>
            <div style={{ display: "flex", gap: 5 }}>{Array.from({ length: totalPages }).map((_, index) => <i key={index} style={{ width: index === page ? 18 : 6, height: 6, borderRadius: 99, background: index === page ? "#e1b45d" : "rgba(238,218,180,.2)" }} />)}</div>
          </div>

          <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 11 }}>
            {visibleItems.map((item) => {
              const active = selected?.assetId === item.assetId;
              const isOwned = !!session?.ownedAssetIds.includes(item.assetId);
              return (
                <article key={item.assetId} style={{ position: "relative", minHeight: 0, overflow: "hidden", borderRadius: 17, padding: "11px 10px 10px", display: "grid", gridTemplateRows: "1fr auto", gap: 6, background: active ? "linear-gradient(180deg,rgba(85,58,36,.94),rgba(52,34,25,.96))" : "linear-gradient(180deg,rgba(53,37,29,.74),rgba(35,24,20,.78))", border: active ? "1px solid rgba(250,207,116,.78)" : "1px solid rgba(236,195,116,.14)", animation: active ? "pinoriaShopSelect .42s ease-out both" : undefined }}>
                  <div style={{ minHeight: 0, display: "grid", placeItems: "center", borderRadius: 12, background: "radial-gradient(circle,rgba(255,226,169,.08),transparent 66%)" }}>
                    <img src={item.imageUrl} alt="" draggable={false} style={{ width: "86%", height: "86%", objectFit: "contain", filter: active ? "drop-shadow(0 8px 12px rgba(0,0,0,.25)) brightness(1.06)" : "drop-shadow(0 7px 10px rgba(0,0,0,.22))" }} />
                  </div>
                  <div>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, color: active ? "#ffe0a0" : "#f0e2cd" }}>{item.displayName}</strong>
                    <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, color: "#e5bc68", fontSize: 10, fontWeight: 800 }}><span>✦ {item.pricePls} PLS</span>{isOwned ? <span style={{ color: "#94c985", fontSize: 9 }}>ĐÃ CÓ</span> : null}</div>
                  </div>
                </article>
              );
            })}
            {!visibleItems.length ? <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", display: "grid", placeItems: "center", color: "rgba(245,232,210,.42)", border: "1px dashed rgba(240,196,112,.16)", borderRadius: 18 }}>Chưa có asset phù hợp trong publisher registry.</div> : null}
          </div>

          <div style={{ minHeight: 70, borderRadius: 18, border: "1px solid rgba(239,196,112,.17)", background: "rgba(31,20,17,.72)", padding: "13px 17px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 18 }}>
            <div>
              <strong style={{ fontSize: 15, color: "#f0c878" }}>{selected?.displayName ?? "Chọn món trên remote"}</strong>
              <div style={{ marginTop: 4, color: "rgba(247,235,215,.48)", fontSize: 10 }}>{selected ? `${selected.version} · ${selected.gender} · ${selected.slot}` : "Staff dùng điện thoại để điều khiển món đang hiển thị."}</div>
            </div>
            {selected ? <div style={{ padding: "10px 14px", borderRadius: 13, minWidth: 144, textAlign: "center", background: owned ? "rgba(77,112,65,.18)" : "rgba(218,166,69,.12)", border: owned ? "1px solid rgba(141,196,117,.3)" : "1px solid rgba(236,187,89,.25)", color: owned ? "#a7d694" : "#f2ca76", fontWeight: 900, fontSize: 13 }}>{owned ? "Đã sở hữu" : `${selected.pricePls} PLS · Có thể mua`}</div> : null}
          </div>
        </section>
      </div>

      {pendingItem ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(12,8,7,.58)", backdropFilter: "blur(10px)" }}>
          <div style={{ width: 520, padding: 28, borderRadius: 24, textAlign: "center", background: "linear-gradient(180deg,#39251d,#241713)", border: "1px solid rgba(246,201,112,.38)", boxShadow: "0 28px 80px rgba(0,0,0,.42)" }}>
            <div style={{ fontSize: 11, color: "#d5a957", fontWeight: 900, letterSpacing: ".14em" }}>XÁC NHẬN TRÊN ĐIỆN THOẠI</div>
            <h2 style={{ margin: "10px 0 8px", fontSize: 28 }}>{session?.subject.name} muốn nhận {pendingItem.displayName}?</h2>
            <p style={{ margin: 0, color: "rgba(246,232,209,.58)", fontSize: 14 }}>{session?.subject.pls} PLS → {Math.max(0, (session?.subject.pls ?? 0) - pendingItem.pricePls)} PLS</p>
          </div>
        </div>
      ) : null}

      {purchaseResult && resultItem ? (
        <div key={purchaseResult.id} style={{ position: "absolute", left: "50%", bottom: 42, zIndex: 60, transform: "translateX(-50%)", padding: "13px 20px", borderRadius: 999, background: purchaseResult.status === "purchased" ? "rgba(67,100,57,.94)" : "rgba(61,42,31,.94)", border: "1px solid rgba(255,226,162,.28)", boxShadow: "0 14px 40px rgba(0,0,0,.3)", fontSize: 13, fontWeight: 900, animation: "pinoriaShopToast 3.2s ease both" }}>
          {purchaseResult.status === "purchased" ? `✦ Đã nhận ${resultItem.displayName}` : purchaseResult.status === "already-owned" ? `Đã có ${resultItem.displayName}` : "Chưa đủ PLS để mua món này"}
        </div>
      ) : null}
    </div>
  );
}
