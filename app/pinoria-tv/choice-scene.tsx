"use client";

import { companionView } from "./companion-view";
import { prototypeChoiceAssets, PrototypeCompanion } from "./prototype-assets";
import type { CompanionProjectionSnapshot } from "./shop-types";

type ChoiceSubject = {
  name: string;
  pls: number;
  companion?: string;
  companionState?: CompanionProjectionSnapshot;
};

type Crop = {
  scale: number;
  x: number;
  y: number;
};

type ChoiceItem = {
  number: number;
  title: string;
  meta: string;
  kind: "owned" | "shop" | "current";
  src?: string;
  crop?: Crop;
  featured?: boolean;
};

const items = (pls: number): ChoiceItem[] => [
  {
    number: 1,
    title: prototypeChoiceAssets.A1.displayName,
    meta: "Đang mang",
    kind: "owned",
    src: prototypeChoiceAssets.A1.src,
    crop: { scale: 4.3, x: .5, y: .15 },
  },
  {
    number: 2,
    title: prototypeChoiceAssets.A2.displayName,
    meta: "Đã có",
    kind: "owned",
    src: prototypeChoiceAssets.A2.src,
    crop: { scale: 4.7, x: .5, y: .335 },
  },
  {
    number: 3,
    title: "Giữ hiện tại",
    meta: "Giữ nguyên",
    kind: "current",
  },
  {
    number: 4,
    title: prototypeChoiceAssets.B1.displayName,
    meta: prototypeChoiceAssets.B1.price,
    kind: "shop",
    src: prototypeChoiceAssets.B1.src,
    crop: { scale: 2.05, x: .5, y: .49 },
  },
  {
    number: 5,
    title: prototypeChoiceAssets.B2.displayName,
    meta: prototypeChoiceAssets.B2.price,
    kind: "shop",
    src: prototypeChoiceAssets.B2.src,
    crop: { scale: 2.45, x: .5, y: .565 },
    featured: true,
  },
  {
    number: 6,
    title: prototypeChoiceAssets.B3.displayName,
    meta: prototypeChoiceAssets.B3.price,
    kind: "shop",
    src: prototypeChoiceAssets.B3.src,
    crop: { scale: 3.4, x: .5, y: .31 },
  },
];

function AssetPreview({ item }: { item: ChoiceItem }) {
  if (!item.src || !item.crop) {
    return <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#f0cf73", boxShadow: "0 0 16px #f0cf7366" }} />;
  }

  const { scale, x, y } = item.crop;
  const left = 50 - x * scale * 100;
  const top = 50 - y * scale * 100;

  return (
    <img
      src={item.src}
      alt=""
      draggable={false}
      decoding="async"
      loading="eager"
      style={{
        position: "absolute",
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        maxWidth: "none",
        left: `${left}%`,
        top: `${top}%`,
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
        filter: "drop-shadow(0 5px 8px rgba(0,0,0,.2))",
      }}
    />
  );
}

function ChoiceCard({ item }: { item: ChoiceItem }) {
  const isShop = item.kind === "shop";
  const cardBackground = item.featured
    ? "radial-gradient(circle at 45% 45%,rgba(227,199,112,.24),transparent 50%),linear-gradient(145deg,rgba(99,87,45,.84),rgba(43,50,31,.94))"
    : isShop
      ? "linear-gradient(145deg,rgba(74,67,39,.78),rgba(37,45,29,.92))"
      : "linear-gradient(145deg,rgba(36,58,39,.93),rgba(24,42,29,.94))";

  return (
    <div
      className="pinoriaChoiceCardDirect"
      data-choice-order={item.number}
      style={{
        position: "relative",
        minWidth: 0,
        minHeight: 0,
        borderRadius: 20,
        background: cardBackground,
        border: `1px solid ${item.featured ? "rgba(230,205,126,.58)" : isShop ? "rgba(226,200,116,.30)" : "rgba(214,231,207,.13)"}`,
        display: "grid",
        gridTemplateColumns: "48px 78px minmax(0,1fr)",
        gap: 13,
        alignItems: "center",
        padding: "12px 16px",
        overflow: "hidden",
        boxShadow: item.featured ? "0 0 28px rgba(216,189,114,.1),inset 0 1px 0 rgba(255,255,255,.08)" : "inset 0 1px 0 rgba(255,255,255,.05)",
      }}
    >
      <b style={{ width: 44, height: 44, borderRadius: 15, display: "grid", placeItems: "center", background: isShop ? "#3c3823" : "#203524", color: isShop ? "#f4d77d" : "#e5efdc", fontSize: 20, fontWeight: 900, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08),0 8px 18px rgba(0,0,0,.12)" }}>{item.number}</b>

      <div style={{ position: "relative", width: 74, height: 74, borderRadius: 22, overflow: "hidden", display: "grid", placeItems: "center", background: item.featured ? "radial-gradient(circle,#f0d58b33,#a18f5630 58%,#1f291d88 100%)" : "radial-gradient(circle,#ffffff12,#1f291d88 75%)", border: "1px solid #f1d99428", boxShadow: item.featured ? "0 0 22px #e0c47420,inset 0 1px 0 #ffffff0f" : "inset 0 1px 0 #ffffff0d" }}>
        <AssetPreview item={item} />
      </div>

      <div style={{ minWidth: 0, display: "grid", gap: 8, alignContent: "center", paddingRight: item.featured ? 40 : 0 }}>
        <strong style={{ fontSize: 16, lineHeight: 1.08, color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.title}</strong>
        <span style={{ width: "max-content", maxWidth: "100%", padding: "4px 7px", borderRadius: 999, background: isShop ? "#e4c97714" : "#ffffff0b", color: isShop ? "#efd793" : "#cbd2c6", fontSize: 9 }}>{item.meta}</span>
      </div>

      {item.featured ? <span style={{ position: "absolute", right: 14, top: 12, padding: "4px 8px", borderRadius: 999, background: "#d9c47b", color: "#263023", fontSize: 7, fontWeight: 900, letterSpacing: ".1em" }}>GỢI Ý</span> : null}
    </div>
  );
}

function ChoiceGroup({ title, meta, kind, children }: { title: string; meta: string; kind: "bag" | "shop"; children: React.ReactNode }) {
  const shop = kind === "shop";
  return (
    <section
      className={shop ? "pinoriaChoiceShopDirect" : "pinoriaChoiceBagDirect"}
      style={{
        minHeight: 0,
        display: "grid",
        gridTemplateRows: "auto minmax(0,1fr)",
        gap: 8,
        padding: "10px 12px 12px",
        borderRadius: 24,
        overflow: "hidden",
        background: shop ? "linear-gradient(115deg,rgba(91,76,35,.38),rgba(49,48,27,.55))" : "linear-gradient(115deg,rgba(27,48,31,.78),rgba(21,37,26,.63))",
        border: `1px solid ${shop ? "rgba(229,202,116,.34)" : "rgba(203,224,197,.13)"}`,
        boxShadow: shop ? "0 16px 38px rgba(8,12,7,.12),inset 0 1px 0 rgba(255,245,197,.05)" : "inset 0 1px 0 rgba(255,255,255,.055)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "0 3px" }}>
        <strong style={{ fontSize: 11, letterSpacing: ".16em", color: shop ? "#f3d681" : "#d7e8cf" }}>{title}</strong>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: shop ? "#f0d18a14" : "#dcebd60a", border: `1px solid ${shop ? "#f0d18a34" : "#dcebd612"}`, color: shop ? "#eadba7" : "#bfcdb8", fontSize: 9 }}>{meta}</span>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>{children}</div>
    </section>
  );
}

export function ChoiceScene({ subject }: { subject: ChoiceSubject }) {
  const companion = companionView(subject);
  const all = items(subject.pls);
  const owned = all.slice(0, 3);
  const shop = all.slice(3);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(circle at 50% 38%,#788a67 0,#354530 38%,#1c241b 72%)", color: "#fff" }}>
      <style>{`
        @keyframes pinoriaChoiceHeaderDirect { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pinoriaChoiceBagDirect { from { opacity:0; transform:translateX(-34px) scale(.985) } to { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaChoiceShopDirect { from { opacity:0; transform:translateX(34px) scale(.985) } to { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaChoiceCardDirect { from { opacity:0; transform:translateY(16px) scale(.955) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes pinoriaChoiceTimerDirect { from { transform:scaleX(1) } to { transform:scaleX(.05) } }
        .pinoriaChoiceHeaderDirect { animation:pinoriaChoiceHeaderDirect .48s cubic-bezier(.2,.82,.2,1) both; }
        .pinoriaChoiceBagDirect { animation:pinoriaChoiceBagDirect .55s .20s cubic-bezier(.2,.82,.2,1) both; }
        .pinoriaChoiceShopDirect { animation:pinoriaChoiceShopDirect .55s .42s cubic-bezier(.2,.82,.2,1) both; }
        .pinoriaChoiceCardDirect { opacity:0; animation:pinoriaChoiceCardDirect .42s cubic-bezier(.18,.82,.2,1) forwards; }
        .pinoriaChoiceCardDirect[data-choice-order="1"] { animation-delay:.43s }
        .pinoriaChoiceCardDirect[data-choice-order="2"] { animation-delay:.51s }
        .pinoriaChoiceCardDirect[data-choice-order="3"] { animation-delay:.59s }
        .pinoriaChoiceCardDirect[data-choice-order="4"] { animation-delay:.73s }
        .pinoriaChoiceCardDirect[data-choice-order="5"] { animation-delay:.81s }
        .pinoriaChoiceCardDirect[data-choice-order="6"] { animation-delay:.89s }
        .pinoriaChoiceTimerDirect { transform-origin:left center; animation:pinoriaChoiceTimerDirect 8s linear both; }
        @media (prefers-reduced-motion:reduce) { .pinoriaChoiceHeaderDirect,.pinoriaChoiceBagDirect,.pinoriaChoiceShopDirect,.pinoriaChoiceCardDirect,.pinoriaChoiceTimerDirect { animation:none!important; opacity:1!important; transform:none!important; } }
      `}</style>

      <div style={{ position: "absolute", left: "25%", right: "25%", top: "7%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle,#f3dd9f55 0,transparent 70%)", filter: "blur(20px)" }} />
      {companion.active ? <div data-pinoria-choice-companion={companion.displayName} style={{ position: "absolute", right: "3.5%", top: "3.5%", width: 112, zIndex: 4, display: "grid", justifyItems: "center", gap: 2, pointerEvents: "none", filter: "drop-shadow(0 10px 16px rgba(0,0,0,.18))" }}><PrototypeCompanion displayName={companion.displayName} visualId={companion.visualId ?? undefined} size="100%" /><strong style={{ fontSize: 10, color: "#efe5c9", textShadow: "0 3px 10px #0008" }}>{companion.displayName}</strong></div> : null}

      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", padding: "64px clamp(52px,6.4vw,92px) 70px", display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 15, overflow: "hidden" }}>
        <header className="pinoriaChoiceHeaderDirect" style={{ width: "100%", maxWidth: 1040, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: ".18em", fontWeight: 900, color: "#e7c77a" }}>CHỌN NHANH</span>
            <div aria-label="Còn 8 giây" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 999, background: "#f2e3ba18", border: "1px solid #f2e3ba44", color: "#f3dfaa" }}>
              <strong style={{ fontSize: 13, lineHeight: 1 }}>8</strong><span style={{ fontSize: 8, fontWeight: 900, letterSpacing: ".08em" }}>GIÂY</span>
              <span style={{ width: 34, height: 3, borderRadius: 999, background: "#ffffff18", overflow: "hidden" }}><i className="pinoriaChoiceTimerDirect" style={{ display: "block", width: "100%", height: "100%", borderRadius: 999, background: "#e3c97f" }} /></span>
            </div>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(36px,3.75vw,50px)", lineHeight: .98, letterSpacing: "-.045em" }}>{subject.name} muốn mang gì theo hôm nay?</h1>
          <p style={{ margin: 0, fontSize: "clamp(14px,1.28vw,17px)", lineHeight: 1.35, color: "#ddd9d0" }}>Nói số 1 đến 6 để thầy cô chọn giúp con.</p>
        </header>

        <div style={{ minHeight: 0, width: "100%", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateRows: "1fr 1fr", gap: 15 }}>
          <ChoiceGroup title="TÚI ĐỒ CỦA CON" meta="Con đang có sẵn" kind="bag">{owned.map((item) => <ChoiceCard key={item.number} item={item} />)}</ChoiceGroup>
          <ChoiceGroup title="CỬA HÀNG HÔM NAY" meta={`Đổi bằng PLS · ${subject.pls} PLS hiện có`} kind="shop">{shop.map((item) => <ChoiceCard key={item.number} item={item} />)}</ChoiceGroup>
        </div>
      </div>
    </div>
  );
}
