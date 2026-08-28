"use client";

import { useEffect, useMemo, useState } from "react";
import { AMBIENT_HOUSE_ARRIVAL_ASSETS } from "./arrival-visual-config";
import { JourneyRankPanel } from "./journey-rank";
import {
  PrototypeCharacter,
  PrototypeCompanion,
  prototypeCharacterEffects,
  type PrototypeCharacterLayerOverrides,
  type PrototypeCharacterSlot,
} from "./prototype-assets";
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

const PAGE_SIZE = 6;

const SPARKLES = [
  { left: "20%", top: "24%", delay: "0ms", size: 15 },
  { left: "76%", top: "20%", delay: "90ms", size: 11 },
  { left: "83%", top: "50%", delay: "170ms", size: 13 },
  { left: "18%", top: "57%", delay: "230ms", size: 10 },
  { left: "67%", top: "72%", delay: "310ms", size: 9 },
] as const;

function ShopCharacterPreview({ subjectId, selected }: { subjectId: string; selected?: ShopCatalogItem }) {
  const layerOverrides: PrototypeCharacterLayerOverrides | undefined = selected?.previewable && selected.layerUrl
    ? { [selected.slot as PrototypeCharacterSlot]: selected.layerUrl }
    : undefined;

  return (
    <div style={{ position: "relative", width: "min(448px,35.5vw,50vh)", aspectRatio: "1 / 1" }}>
      <div
        style={{
          position: "absolute",
          inset: "8% 5% 4%",
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(151,92,207,.14),rgba(103,64,151,.05) 42%,transparent 68%)",
          filter: "blur(12px)",
          animation: "pinoriaShopAmbientGlow 4.8s ease-in-out infinite",
        }}
      />
      <img
        src={prototypeCharacterEffects.aura.src}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: "1%",
          width: "98%",
          height: "98%",
          objectFit: "contain",
          opacity: .8,
          filter: "brightness(.96) drop-shadow(0 0 28px rgba(181,100,255,.32))",
          animation: "pinoriaShopAuraPulse 5.4s ease-in-out infinite",
          zIndex: 2,
        }}
      />
      {prototypeCharacterEffects.glows.map((glow, index) => (
        <img
          key={glow.id}
          src={glow.src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: "4%",
            width: "92%",
            height: "92%",
            objectFit: "contain",
            opacity: index % 2 === 0 ? .08 : .055,
            transform: glow.mirrored ? "scaleX(-1)" : undefined,
            mixBlendMode: "screen",
            animation: `pinoriaShopGlowDrift ${6.4 + index * .7}s ease-in-out ${index * -.9}s infinite`,
            zIndex: 3,
          }}
        />
      ))}
      <PrototypeCharacter
        subjectId={subjectId}
        motion="shop-preview"
        layerOverrides={layerOverrides}
        size="100%"
        style={{ position: "absolute", inset: 0, zIndex: 10, filter: "drop-shadow(0 18px 20px rgba(0,0,0,.18))" }}
      />
      <div style={{ position: "absolute", left: "50%", bottom: "1%", width: "48%", height: 22, transform: "translateX(-50%)", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(9,6,5,.56),transparent 70%)", filter: "blur(7px)", zIndex: 5 }} />
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
            opacity: index === 0 ? .72 : .48,
            filter: "blur(15px) brightness(.33) saturate(.54) sepia(.12)",
            transform: "scale(1.04)",
          }}
        />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 26% 46%,rgba(112,70,49,.17),transparent 38%),radial-gradient(circle at 71% 41%,rgba(91,51,103,.08),transparent 34%),linear-gradient(100deg,rgba(18,12,10,.72),rgba(34,23,18,.78) 48%,rgba(16,10,8,.9))" }} />
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 120px rgba(8,4,3,.42)" }} />
    </div>
  );
}

function descriptionFor(item?: ShopCatalogItem) {
  if (!item) return "Staff chọn một món trên điện thoại để cả House cùng xem trên TV.";
  if (item.category === "body") return "Thử trực tiếp trang phục này lên Piner của con.";
  if (item.category === "eyewear") return "Một thay đổi nhỏ, Piner trông khác hẳn ngay lập tức.";
  if (item.category === "headwear") return "Đội thử lên Piner trước khi con quyết định.";
  if (item.category === "back") return "Thử lên Piner mà không thay đổi các dấu mốc con đã đạt được.";
  if (item.category === "hair" || item.category === "face") return "Xem thử diện mạo này trên Piner của con.";
  return "Món này sẽ xuất hiện cùng Piner trong thế giới Pinoria.";
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
  const catalogLayout = visibleItems.length <= 2 ? "sparse" : visibleItems.length <= 4 ? "compact" : "dense";
  const pendingItem = catalog.find((item) => item.assetId === session?.pendingPurchaseAssetId);
  const owned = !!selected && !!session?.ownedAssetIds.includes(selected.assetId);
  const purchaseResult = session?.purchaseResult;
  const resultItem = purchaseResult ? catalog.find((item) => item.assetId === purchaseResult.assetId) : undefined;

  return (
    <div data-pinoria-shop-scene style={{ position: "absolute", inset: 0, overflow: "hidden", color: "#f7ead7", background: "#1d1512" }}>
      <HouseShopBackdrop />
      <style>{`
        @keyframes pinoriaShopEnter { from { opacity:0; transform:scale(1.012) } to { opacity:1; transform:scale(1) } }
        @keyframes pinoriaShopSelect { 0% { box-shadow:0 0 0 rgba(245,197,91,0) } 45% { box-shadow:0 0 38px rgba(245,197,91,.32) } 100% { box-shadow:0 0 22px rgba(245,197,91,.18) } }
        @keyframes pinoriaShopToast { 0% { opacity:0; transform:translate(-50%,14px) } 18%,78% { opacity:1; transform:translate(-50%,0) } 100% { opacity:0; transform:translate(-50%,-8px) } }
        @keyframes pinoriaShopAuraPulse { 0%,100% { opacity:.72; transform:scale(.99) } 50% { opacity:.88; transform:scale(1.018) } }
        @keyframes pinoriaShopAmbientGlow { 0%,100% { opacity:.72; transform:scale(.96) } 50% { opacity:1; transform:scale(1.05) } }
        @keyframes pinoriaShopGlowDrift { 0%,100% { opacity:.035; filter:blur(.2px) } 50% { opacity:.11; filter:blur(1px) } }
        @keyframes pinoriaShopSparkle { 0% { opacity:0; transform:scale(.35) rotate(-14deg) } 28% { opacity:.95; transform:scale(1.1) rotate(4deg) } 72% { opacity:.7; transform:scale(.82) rotate(12deg) } 100% { opacity:0; transform:scale(.3) rotate(18deg) } }
        @keyframes pinoriaShopPreviewNudge { 0% { transform:scale(.985); filter:brightness(.96) } 45% { transform:scale(1.012); filter:brightness(1.04) } 100% { transform:scale(1); filter:brightness(1) } }
      `}</style>

      <div style={{ position: "absolute", inset: "28px 46px 32px", display: "grid", gridTemplateColumns: "42% 58%", gridTemplateRows: "92px 1fr", gap: "15px 24px", animation: "pinoriaShopEnter .48s ease-out both" }}>
        <header style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "300px minmax(0,1fr) 150px", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={PINORIA_SHOP_LOGO} alt="Pinoria" style={{ width: 150, maxHeight: 60, objectFit: "contain", objectPosition: "left center", filter: "drop-shadow(0 7px 18px rgba(0,0,0,.32))" }} />
            <div style={{ width: 1, height: 42, background: "rgba(245,214,155,.24)" }} />
            <div>
              <div style={{ color: "#f0cb80", fontSize: 13, fontWeight: 950, letterSpacing: ".15em" }}>SHOP</div>
              <div style={{ marginTop: 2, color: "#f7e5c4", fontSize: 17, fontWeight: 950, letterSpacing: ".07em" }}>PINORIA</div>
            </div>
          </div>

          <nav data-shop-category-rail style={{ minWidth: 0, display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", alignItems: "stretch", gap: 5, padding: 6, borderRadius: 20, background: "rgba(39,27,21,.76)", border: "1px solid rgba(239,199,120,.17)", boxShadow: "0 14px 34px rgba(0,0,0,.18)" }}>
            {PINORIA_SHOP_CATEGORIES.map((category) => {
              const active = (session?.category ?? "all") === category.id;
              return (
                <div data-active={active ? "true" : "false"} key={category.id} style={{ minWidth: 0, padding: "12px 8px", borderRadius: 13, display: "grid", gridTemplateColumns: "18px minmax(0,auto)", alignItems: "center", justifyContent: "center", gap: 7, color: active ? "#2a1b12" : "rgba(249,235,210,.72)", background: active ? "linear-gradient(180deg,#ffe4a2,#d8a449)" : "transparent", border: active ? "1px solid #ffe9b4" : "1px solid transparent", boxShadow: active ? "0 9px 26px rgba(225,176,78,.26), inset 0 1px rgba(255,255,255,.42)" : undefined, fontSize: 12.5, fontWeight: 900, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 16, textAlign: "center" }}>{category.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{category.label}</span>
                </div>
              );
            })}
          </nav>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 7, color: "rgba(245,226,193,.56)", fontSize: 11.5, fontWeight: 900 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8fbd72", boxShadow: "0 0 12px rgba(143,189,114,.35)" }} />
            <span>Cửa hàng đang mở</span>
          </div>
        </header>

        <section style={{ position: "relative", minHeight: 0, borderRadius: 26, overflow: "hidden", border: "1px solid rgba(236,194,115,.2)", background: "radial-gradient(circle at 22% 12%,rgba(38,65,105,.14),transparent 32%),linear-gradient(180deg,rgba(43,31,29,.68),rgba(22,16,16,.82))", boxShadow: "0 30px 60px rgba(0,0,0,.28)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 41%,rgba(143,78,195,.14),transparent 50%)" }} />
          <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", alignItems: "center", justifyItems: "center", padding: "12px 17px 17px" }}>
            <JourneyRankPanel subjectId={session?.subject.id ?? "bo"} subjectName={session?.subject.name ?? "Bơ"} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 11px", borderBottom: "1px solid rgba(236,199,126,.09)" }} />
            <div style={{ position: "relative", display: "grid", placeItems: "center", alignSelf: "stretch", width: "100%" }}>
              <div key={selected?.assetId ?? "empty"} style={{ position: "relative", display: "grid", placeItems: "center", animation: "pinoriaShopPreviewNudge .5s ease-out both" }}>
                <ShopCharacterPreview subjectId={session?.subject.id ?? "bo"} selected={selected} />
                {selected ? (
                  <div style={{ position: "absolute", inset: "8%", zIndex: 75, pointerEvents: "none" }}>
                    {SPARKLES.map((sparkle, index) => (
                      <span key={`${selected.assetId}:${index}`} style={{ position: "absolute", left: sparkle.left, top: sparkle.top, color: "#f5cb72", fontSize: sparkle.size, textShadow: "0 0 16px rgba(244,197,100,.65)", opacity: 0, animation: `pinoriaShopSparkle 1.25s ease-out ${sparkle.delay} both` }}>✦</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div data-shop-companion style={{ position: "absolute", right: "clamp(18px,3.2vw,50px)", bottom: "clamp(22px,4.4vh,44px)", width: "clamp(132px,8.8vw,164px)", zIndex: 82 }}>
                <PrototypeCompanion size="100%" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,.36))" }} />
              </div>
            </div>
            <div data-shop-preview-info style={{ width: "100%", padding: "14px 16px", borderRadius: 17, background: "rgba(20,13,11,.72)", border: "1px solid rgba(240,196,112,.17)", boxSizing: "border-box", boxShadow: "0 12px 30px rgba(0,0,0,.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ flex: "0 0 auto", padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(239,195,110,.18)", background: "rgba(46,31,24,.72)", color: "rgba(248,232,204,.62)", fontSize: 9, fontWeight: 950, letterSpacing: ".09em" }}>ĐANG THỬ</span>
                <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 19, color: "#f4cf86" }}>{selected?.displayName ?? "Chọn một món để thử"}</strong>
                {owned ? <span aria-label="Đã sở hữu" style={{ flex: "0 0 auto", width: 19, height: 19, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(91,146,73,.22)", border: "1px solid rgba(142,203,118,.42)", color: "#a7df92", fontSize: 12, fontWeight: 950 }}>✓</span> : null}
              </div>
              <p style={{ margin: "7px 0 0", color: "rgba(246,235,217,.62)", fontSize: 12, lineHeight: 1.45 }}>{descriptionFor(selected)}</p>
            </div>
          </div>
        </section>

        <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr", gap: 13 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
            <div style={{ color: "rgba(247,233,210,.62)", fontSize: 12.5 }}><strong style={{ color: "#f1cb7e" }}>{categoryLabel(session?.category ?? "all")}</strong> · {filtered.length} món</div>
            <div style={{ display: "flex", gap: 6 }}>{Array.from({ length: totalPages }).map((_, index) => <i key={index} style={{ width: index === page ? 21 : 7, height: 7, borderRadius: 99, background: index === page ? "#e1b45d" : "rgba(238,218,180,.2)" }} />)}</div>
          </div>

          <div data-shop-grid data-layout={catalogLayout} style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 11 }}>
            {visibleItems.map((item) => {
              const active = selected?.assetId === item.assetId;
              const isOwned = !!session?.ownedAssetIds.includes(item.assetId);
              const attention = item.attention;
              return (
                <article data-shop-item-card data-active={active ? "true" : "false"} data-attention={attention} key={item.assetId} style={{ position: "relative", minHeight: 0, overflow: "hidden", borderRadius: 18, padding: "12px 12px 11px", display: "grid", gridTemplateRows: "1fr auto", gap: 7, background: active ? "linear-gradient(180deg,rgba(88,60,38,.95),rgba(52,34,25,.98))" : "linear-gradient(180deg,rgba(53,37,29,.73),rgba(34,23,19,.82))", border: active ? "1.5px solid rgba(250,207,116,.86)" : "1px solid rgba(236,195,116,.15)", boxShadow: active ? "0 12px 34px rgba(226,177,82,.12)" : "0 10px 24px rgba(0,0,0,.08)", animation: active ? "pinoriaShopSelect .42s ease-out both" : undefined }}>
                  {attention === "hot" ? <span data-shop-hot-badge><b>✦</b> HOT</span> : null}
                  {active ? <span data-shop-active-badge style={{ position: "absolute", right: 10, top: 10, zIndex: 3, padding: "5px 8px", borderRadius: 999, background: "#edc66f", color: "#2c1c12", fontSize: 9.5, fontWeight: 950, letterSpacing: ".05em" }}>ĐANG THỬ</span> : null}
                  <div data-shop-item-art style={{ minHeight: 0, display: "grid", placeItems: "center", borderRadius: 13, background: "radial-gradient(circle,rgba(255,226,169,.085),transparent 66%)" }}>
                    <img src={item.imageUrl} alt="" draggable={false} style={{ width: "89%", height: "89%", objectFit: "contain", filter: active ? "drop-shadow(0 9px 14px rgba(0,0,0,.27)) brightness(1.07)" : "drop-shadow(0 7px 11px rgba(0,0,0,.22))" }} />
                  </div>
                  <div data-shop-item-footer>
                    <div data-shop-item-name-row>
                      <strong>{item.displayName}</strong>
                      {isOwned ? <span data-owned-check aria-label="Đã sở hữu">✓</span> : null}
                    </div>
                    <div data-shop-price-box><span>PLS</span><strong>{item.pricePls}</strong></div>
                  </div>
                </article>
              );
            })}
            {!visibleItems.length ? <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", display: "grid", placeItems: "center", color: "rgba(245,232,210,.48)", fontSize: 14, border: "1px dashed rgba(240,196,112,.16)", borderRadius: 18 }}>Chưa có món nào trong khu này.</div> : null}
          </div>

        </section>
      </div>

      {pendingItem ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(12,8,7,.6)", backdropFilter: "blur(10px)" }}>
          <div style={{ width: 520, padding: 30, borderRadius: 25, textAlign: "center", background: "linear-gradient(180deg,#39251d,#241713)", border: "1px solid rgba(246,201,112,.4)", boxShadow: "0 28px 80px rgba(0,0,0,.44)" }}>
            <div style={{ fontSize: 12, color: "#d5a957", fontWeight: 950, letterSpacing: ".14em" }}>CON ĐÃ CHỌN</div>
            <h2 style={{ margin: "11px 0 9px", fontSize: 30 }}>{pendingItem.displayName}</h2>
            <p style={{ margin: 0, color: "rgba(246,232,209,.62)", fontSize: 14 }}>Staff xác nhận trên điện thoại để hoàn tất đổi món.</p>
          </div>
        </div>
      ) : null}

      {purchaseResult && resultItem ? (
        <div key={purchaseResult.id} style={{ position: "absolute", left: "50%", bottom: 38, zIndex: 60, transform: "translateX(-50%)", padding: "14px 22px", borderRadius: 999, background: purchaseResult.status === "purchased" ? "rgba(67,100,57,.94)" : "rgba(61,42,31,.94)", border: "1px solid rgba(255,226,162,.28)", boxShadow: "0 14px 40px rgba(0,0,0,.3)", fontSize: 14, fontWeight: 900, animation: "pinoriaShopToast 3.2s ease both" }}>
          {purchaseResult.status === "purchased" ? `✦ Đã nhận ${resultItem.displayName}` : purchaseResult.status === "already-owned" ? `Đã có ${resultItem.displayName}` : "Chưa đủ PLS để đổi món này"}
        </div>
      ) : null}
    </div>
  );
}
