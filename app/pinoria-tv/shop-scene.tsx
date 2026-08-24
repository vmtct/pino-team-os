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

const PAGE_SIZE = 6;
const STACK_ORDER: Record<PrototypeCharacterSlot, number> = {
  back: 10,
  body: 20,
  hair: 30,
  face: 40,
  headwear: 50,
  eyewear: 60,
};

const SPARKLES = [
  { left: "20%", top: "24%", delay: "0ms", size: 15 },
  { left: "76%", top: "20%", delay: "90ms", size: 11 },
  { left: "83%", top: "50%", delay: "170ms", size: 13 },
  { left: "18%", top: "57%", delay: "230ms", size: 10 },
  { left: "67%", top: "72%", delay: "310ms", size: 9 },
] as const;

type PreviewLayer = {
  slot: PrototypeCharacterSlot;
  src: string;
  fallbackSrc: string;
  order: number;
};

function ShopLayerImage({ layer }: { layer: PreviewLayer }) {
  const [src, setSrc] = useState(layer.src);

  useEffect(() => {
    setSrc(layer.src);
  }, [layer.src]);

  return (
    <img
      data-pinoria-shop-character-layer={layer.slot}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading="eager"
      onError={() => {
        if (src !== layer.fallbackSrc) setSrc(layer.fallbackSrc);
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        zIndex: layer.order,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function ShopCharacterPreview({ subjectId, selected }: { subjectId: string; selected?: ShopCatalogItem }) {
  const profile = prototypeCharacterProfileForSubject(subjectId);
  const selectedSlot = selected?.previewable ? selected.slot as PrototypeCharacterSlot : null;
  const layers = prototypeCharacterManifest.layers
    .map((base) => {
      const profileSrc = profile?.layers[base.slot];
      const baseSrc = base.src;
      const resolvedBaseSrc = profileSrc === null ? null : profileSrc || baseSrc;
      const selectedSrc = selectedSlot === base.slot && selected?.layerUrl ? selected.layerUrl : undefined;
      const src = selectedSrc ?? resolvedBaseSrc;
      return src ? { slot: base.slot, src, fallbackSrc: baseSrc, order: STACK_ORDER[base.slot] } : null;
    })
    .filter((layer): layer is PreviewLayer => !!layer)
    .sort((a, b) => a.order - b.order);

  return (
    <div style={{ position: "relative", width: "min(480px,38.5vw)", aspectRatio: "1 / 1" }}>
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
      {layers.map((layer) => <ShopLayerImage key={`${layer.slot}:${layer.src}`} layer={layer} />)}
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
  const pendingItem = catalog.find((item) => item.assetId === session?.pendingPurchaseAssetId);
  const owned = !!selected && !!session?.ownedAssetIds.includes(selected.assetId);
  const subjectPls = session?.subject.pls ?? 420;
  const canAfford = !!selected && subjectPls >= selected.pricePls;
  const missingPls = selected ? Math.max(0, selected.pricePls - subjectPls) : 0;
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

      <div style={{ position: "absolute", inset: "28px 46px 32px", display: "grid", gridTemplateColumns: "41% 59%", gridTemplateRows: "92px 1fr", gap: "15px 24px", animation: "pinoriaShopEnter .48s ease-out both" }}>
        <header style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "300px minmax(0,1fr) 150px", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={PINORIA_SHOP_LOGO} alt="Pinoria" style={{ width: 150, maxHeight: 60, objectFit: "contain", objectPosition: "left center", filter: "drop-shadow(0 7px 18px rgba(0,0,0,.32))" }} />
            <div style={{ width: 1, height: 42, background: "rgba(245,214,155,.24)" }} />
            <div>
              <div style={{ color: "#f0cb80", fontSize: 13, fontWeight: 950, letterSpacing: ".15em" }}>SHOP</div>
              <div style={{ marginTop: 2, color: "#f7e5c4", fontSize: 17, fontWeight: 950, letterSpacing: ".07em" }}>PINORIA</div>
            </div>
          </div>

          <nav style={{ minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 4, padding: 7, borderRadius: 20, background: "rgba(39,27,21,.76)", border: "1px solid rgba(239,199,120,.17)", boxShadow: "0 14px 34px rgba(0,0,0,.18)" }}>
            {PINORIA_SHOP_CATEGORIES.filter((item) => item.id !== "all").map((category) => {
              const active = session?.category === category.id;
              return (
                <div key={category.id} style={{ minWidth: category.id === "body" ? 102 : 70, padding: "11px 9px", borderRadius: 13, display: "grid", gridTemplateColumns: "17px auto", alignItems: "center", justifyContent: "center", gap: 6, color: active ? "#2a1b12" : "rgba(249,235,210,.72)", background: active ? "linear-gradient(180deg,#f7d98f,#dcac51)" : "transparent", border: active ? "1px solid #ffe9b4" : "1px solid transparent", boxShadow: active ? "0 8px 24px rgba(225,176,78,.2)" : undefined, fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 15, textAlign: "center" }}>{category.icon}</span>
                  <span>{category.label}</span>
                </div>
              );
            })}
          </nav>

          <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
            <strong style={{ fontSize: 17, color: "#f6ead8" }}>{session?.subject.name ?? "Bơ"}</strong>
            <span style={{ color: owned ? "#9fd18f" : canAfford ? "#efc875" : "rgba(245,226,193,.58)", fontSize: 11.5, fontWeight: 900 }}>
              {owned ? "Đã có món này" : canAfford ? "✦ Có thể đổi" : selected ? `Cần thêm ${missingPls} PLS` : "Đang chọn món"}
            </span>
          </div>
        </header>

        <section style={{ position: "relative", minHeight: 0, borderRadius: 26, overflow: "hidden", border: "1px solid rgba(236,194,115,.2)", background: "linear-gradient(180deg,rgba(46,30,25,.61),rgba(24,16,14,.76))", boxShadow: "0 30px 60px rgba(0,0,0,.28)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 41%,rgba(143,78,195,.14),transparent 50%)" }} />
          <div style={{ position: "relative", height: "100%", display: "grid", gridTemplateRows: "1fr auto", alignItems: "center", justifyItems: "center", padding: "15px 17px 17px" }}>
            <div style={{ position: "relative", display: "grid", placeItems: "center", alignSelf: "stretch", width: "100%" }}>
              <div style={{ position: "absolute", left: 12, top: 12, zIndex: 80, padding: "7px 11px", borderRadius: 999, border: "1px solid rgba(239,195,110,.18)", background: "rgba(23,15,13,.64)", color: "rgba(248,232,204,.68)", fontSize: 10, fontWeight: 950, letterSpacing: ".11em" }}>ĐANG THỬ</div>
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
              <div style={{ position: "absolute", right: 14, bottom: 14, width: 120, zIndex: 82 }}>
                <PrototypeCompanion size="100%" style={{ filter: "drop-shadow(0 16px 18px rgba(0,0,0,.32))" }} />
              </div>
            </div>
            <div style={{ width: "100%", padding: "14px 16px", borderRadius: 17, background: "rgba(20,13,11,.72)", border: "1px solid rgba(240,196,112,.17)", boxSizing: "border-box", boxShadow: "0 12px 30px rgba(0,0,0,.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 20, color: "#f4cf86" }}>{selected?.displayName ?? "Chọn một món để thử"}</strong>
                {selected ? <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 950, color: owned ? "#9bd18d" : "rgba(246,232,208,.6)" }}>{owned ? "ĐÃ CÓ" : "ĐANG XEM"}</span> : null}
              </div>
              <p style={{ margin: "7px 0 0", color: "rgba(246,235,217,.62)", fontSize: 12, lineHeight: 1.45 }}>{descriptionFor(selected)}</p>
            </div>
          </div>
        </section>

        <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}>
            <div style={{ color: "rgba(247,233,210,.62)", fontSize: 12.5 }}><strong style={{ color: "#f1cb7e" }}>{categoryLabel(session?.category ?? "all")}</strong> · {filtered.length} món</div>
            <div style={{ display: "flex", gap: 6 }}>{Array.from({ length: totalPages }).map((_, index) => <i key={index} style={{ width: index === page ? 21 : 7, height: 7, borderRadius: 99, background: index === page ? "#e1b45d" : "rgba(238,218,180,.2)" }} />)}</div>
          </div>

          <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridTemplateRows: "repeat(2,minmax(0,1fr))", gap: 11 }}>
            {visibleItems.map((item) => {
              const active = selected?.assetId === item.assetId;
              const isOwned = !!session?.ownedAssetIds.includes(item.assetId);
              return (
                <article key={item.assetId} style={{ position: "relative", minHeight: 0, overflow: "hidden", borderRadius: 18, padding: "12px 12px 11px", display: "grid", gridTemplateRows: "1fr auto", gap: 7, background: active ? "linear-gradient(180deg,rgba(88,60,38,.95),rgba(52,34,25,.98))" : "linear-gradient(180deg,rgba(53,37,29,.73),rgba(34,23,19,.82))", border: active ? "1.5px solid rgba(250,207,116,.86)" : "1px solid rgba(236,195,116,.15)", boxShadow: active ? "0 12px 34px rgba(226,177,82,.12)" : "0 10px 24px rgba(0,0,0,.08)", animation: active ? "pinoriaShopSelect .42s ease-out both" : undefined }}>
                  {active ? <span style={{ position: "absolute", right: 10, top: 10, zIndex: 3, padding: "5px 8px", borderRadius: 999, background: "#edc66f", color: "#2c1c12", fontSize: 9.5, fontWeight: 950, letterSpacing: ".05em" }}>ĐANG THỬ</span> : null}
                  <div style={{ minHeight: 0, display: "grid", placeItems: "center", borderRadius: 13, background: "radial-gradient(circle,rgba(255,226,169,.085),transparent 66%)" }}>
                    <img src={item.imageUrl} alt="" draggable={false} style={{ width: "89%", height: "89%", objectFit: "contain", filter: active ? "drop-shadow(0 9px 14px rgba(0,0,0,.27)) brightness(1.07)" : "drop-shadow(0 7px 11px rgba(0,0,0,.22))" }} />
                  </div>
                  <div>
                    <strong style={{ display: "block", minHeight: 32, overflow: "hidden", fontSize: 13.5, lineHeight: 1.17, color: active ? "#ffe0a0" : "#f0e2cd" }}>{item.displayName}</strong>
                    <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 7, color: "#e5bc68", fontSize: 11.5, fontWeight: 900 }}><span>✦ {item.pricePls} PLS</span>{isOwned ? <span style={{ color: "#9bd18d", fontSize: 10.5 }}>ĐÃ CÓ</span> : null}</div>
                  </div>
                </article>
              );
            })}
            {!visibleItems.length ? <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", display: "grid", placeItems: "center", color: "rgba(245,232,210,.48)", fontSize: 14, border: "1px dashed rgba(240,196,112,.16)", borderRadius: 18 }}>Chưa có món nào trong khu này.</div> : null}
          </div>

          <div style={{ minHeight: 86, borderRadius: 19, border: "1px solid rgba(239,196,112,.18)", background: "rgba(29,19,16,.77)", padding: "13px 16px", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 20, boxShadow: "0 12px 28px rgba(0,0,0,.12)" }}>
            <div>
              <strong style={{ display: "block", fontSize: 16.5, color: "#f0c878" }}>{owned ? "Món này đã ở trong tủ của con" : "Con thích món này?"}</strong>
              <div style={{ marginTop: 5, color: "rgba(247,235,215,.52)", fontSize: 11.5 }}>{owned ? "Có thể thử lại bất cứ lúc nào." : "Nói với staff để xác nhận trên điện thoại."}</div>
            </div>
            {selected ? (
              <div style={{ display: "grid", justifyItems: "end", gap: 5 }}>
                <div style={{ padding: "11px 16px", borderRadius: 14, minWidth: 154, textAlign: "center", background: owned ? "rgba(77,112,65,.19)" : canAfford ? "rgba(218,166,69,.15)" : "rgba(92,67,48,.22)", border: owned ? "1px solid rgba(141,196,117,.32)" : canAfford ? "1px solid rgba(236,187,89,.3)" : "1px solid rgba(214,181,135,.17)", color: owned ? "#a7d694" : canAfford ? "#f2ca76" : "rgba(245,223,188,.62)", fontWeight: 950, fontSize: 14 }}>
                  {owned ? "Đã sở hữu" : canAfford ? `✦ ${selected.pricePls} PLS · Có thể đổi` : `Cần thêm ${missingPls} PLS`}
                </div>
              </div>
            ) : null}
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
