"use client";

import { prototypeChoiceAssets } from "./prototype-assets";

type ChoiceSubject = {
  name: string;
  pls: number;
};

export function ChoiceScene({ subject }: { subject: ChoiceSubject }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 38%,#788a67 0,#354530 38%,#1c241b 72%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "25%", right: "25%", top: "7%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle,#f3dd9f55 0,transparent 70%)", filter: "blur(20px)" }} />
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", padding: "64px clamp(52px,6.4vw,92px) 70px", display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 15, overflow: "hidden" }}>
        <header style={{ width: "100%", maxWidth: 1040, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: ".18em", fontWeight: 900, color: "#e7c77a" }}>CHỌN NHANH</span>
            <div aria-label="Còn 8 giây" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 9px", borderRadius: 999, background: "#f2e3ba18", border: "1px solid #f2e3ba44", color: "#f3dfaa", boxShadow: "inset 0 1px 0 #ffffff10" }}>
              <strong style={{ fontSize: 13, lineHeight: 1 }}>8</strong><span style={{ fontSize: 8, fontWeight: 900, letterSpacing: ".08em" }}>GIÂY</span>
              <span style={{ width: 34, height: 3, borderRadius: 999, background: "#ffffff18", overflow: "hidden" }}><i style={{ display: "block", width: "72%", height: "100%", borderRadius: 999, background: "#e3c97f" }} /></span>
            </div>
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(38px,4.1vw,54px)", lineHeight: .98, letterSpacing: "-.045em", color: "#fff" }}>{subject.name} muốn mang gì theo hôm nay?</h1>
          <p style={{ margin: 0, fontSize: "clamp(14px,1.28vw,17px)", lineHeight: 1.35, color: "#ddd9d0" }}>Nói số 1 đến 6 để thầy cô chọn giúp con.</p>
        </header>

        <div style={{ minHeight: 0, width: "100%", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateRows: "1fr 1fr", gap: 13 }}>
          <ChoiceGroup title="Túi đồ · đã sở hữu" meta="A1–A3">
            <ChoiceCard code="A1" title={prototypeChoiceAssets.A1.displayName} meta="Đang trang bị" imageSrc={prototypeChoiceAssets.A1.src} kind="owned" />
            <ChoiceCard code="A2" title={prototypeChoiceAssets.A2.displayName} meta="Đã sở hữu" imageSrc={prototypeChoiceAssets.A2.src} kind="owned" />
            <ChoiceCard code="A3" title="Giữ hiện tại" meta="Không đổi trang phục" icon="●" kind="current" />
          </ChoiceGroup>
          <ChoiceGroup title="Cửa hàng · gợi ý hôm nay" meta={`${subject.pls} PLS`}>
            <ChoiceCard code="B1" title={prototypeChoiceAssets.B1.displayName} meta={prototypeChoiceAssets.B1.price} imageSrc={prototypeChoiceAssets.B1.src} kind="shop" />
            <ChoiceCard code="B2" title={prototypeChoiceAssets.B2.displayName} meta={prototypeChoiceAssets.B2.price} imageSrc={prototypeChoiceAssets.B2.src} kind="shop" hero />
            <ChoiceCard code="B3" title={prototypeChoiceAssets.B3.displayName} meta={prototypeChoiceAssets.B3.price} imageSrc={prototypeChoiceAssets.B3.src} kind="shop" />
          </ChoiceGroup>
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <section style={{ minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "0 3px" }}>
        <strong style={{ fontSize: 10, letterSpacing: ".14em", color: "#f0d18a", textTransform: "uppercase" }}>{title}</strong>
        <span style={{ fontSize: 10, color: "#aeb7aa", letterSpacing: ".04em" }}>{meta}</span>
      </div>
      <div style={{ minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>{children}</div>
    </section>
  );
}

function ChoiceCard({ code, title, meta, imageSrc, icon, kind, hero = false }: { code: string; title: string; meta: string; imageSrc?: string; icon?: string; kind: "owned" | "shop" | "current"; hero?: boolean }) {
  const isShop = kind === "shop";
  const background = hero
    ? "radial-gradient(circle at 36% 38%,#e2cb7c32,transparent 44%),linear-gradient(145deg,#d8bd7228,#ffffff0b)"
    : isShop
      ? "radial-gradient(circle at 36% 38%,#d8bd721c,transparent 45%),linear-gradient(145deg,#ffffff0c,#ffffff07)"
      : "radial-gradient(circle at 36% 38%,#ffffff12,transparent 44%),linear-gradient(145deg,#ffffff0d,#ffffff07)";
  const borderColor = hero ? "#e6d28a88" : isShop ? "#dfca8550" : "#ffffff20";
  const objectBackground = hero ? "radial-gradient(circle,#f0d58b33,#a18f5630 58%,#1f291d88 100%)" : "radial-gradient(circle,#ffffff12,#1f291d88 75%)";

  return (
    <div style={{ position: "relative", minWidth: 0, minHeight: 0, borderRadius: 18, background, border: `1px solid ${borderColor}`, display: "grid", gridTemplateColumns: "42px 66px minmax(0,1fr)", gap: 12, alignItems: "center", padding: "13px 15px", boxSizing: "border-box", boxShadow: hero ? "0 0 28px #d8bd7216,inset 0 1px 0 #ffffff12" : "inset 0 1px 0 #ffffff08" }}>
      <b style={{ width: 38, height: 38, borderRadius: 11, background: "#1c271b", color: "#f5df9f", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, boxShadow: "inset 0 0 0 1px #ffffff08" }}>{code}</b>
      <div style={{ position: "relative", width: 62, height: 62, borderRadius: 20, background: objectBackground, border: "1px solid #f1d99428", overflow: "hidden", display: "grid", placeItems: "center", boxShadow: hero ? "0 0 22px #e0c47420,inset 0 1px 0 #ffffff0f" : "inset 0 1px 0 #ffffff0d" }}>
        {imageSrc ? <img src={imageSrc} alt="" draggable={false} decoding="async" loading="eager" style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scale(1.18)", pointerEvents: "none" }} /> : <span style={{ color: "#eccb78", fontSize: 27, lineHeight: 1, textShadow: "0 4px 14px #0005" }}>{icon}</span>}
      </div>
      <div style={{ minWidth: 0, display: "grid", gap: 8, alignContent: "center", paddingRight: hero ? 42 : 0 }}>
        <strong style={{ fontSize: 16, lineHeight: 1.15, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</strong>
        <span style={{ width: "max-content", maxWidth: "100%", padding: "4px 7px", borderRadius: 999, background: isShop ? "#e4c97714" : "#ffffff0b", color: isShop ? "#efd793" : "#cbd2c6", fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
      </div>
      {hero ? <span style={{ position: "absolute", right: 12, top: 10, padding: "4px 7px", borderRadius: 999, background: "#e8cf83", color: "#263023", fontSize: 7, fontWeight: 900, letterSpacing: ".1em" }}>GỢI Ý</span> : null}
    </div>
  );
}
