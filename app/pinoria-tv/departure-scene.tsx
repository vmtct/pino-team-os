"use client";

import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PinoriaStage } from "./pinoria-stage";
import { PrototypeCharacter } from "./prototype-assets";

type DepartureSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

function companionLabel(value: string) {
  if (!value || value.startsWith("Chưa có")) return "Chưa có Hộ Linh";
  return value;
}

export function DepartureScene({ subject }: { subject: DepartureSubject }) {
  const hasCompanion = !!subject.companion && !subject.companion.startsWith("Chưa có");

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#111912", color: "#fff" }}>
      <style>{`
        @keyframes pinoriaDepartureCopy {
          0%,10% { opacity:0; transform:translateY(18px) }
          38%,100% { opacity:1; transform:translateY(0) }
        }
        @keyframes pinoriaDepartureCharacter {
          0% { opacity:1; transform:scale(1); filter:brightness(1.04) drop-shadow(0 30px 32px rgba(0,0,0,.30)); }
          18% { opacity:1; transform:scale(1.015); filter:brightness(1.08) drop-shadow(0 31px 34px rgba(0,0,0,.30)); }
          36%,100% { opacity:1; transform:scale(1); filter:brightness(1.03) drop-shadow(0 30px 32px rgba(0,0,0,.30)); }
        }
        @keyframes pinoriaDepartureCard {
          0%,22% { opacity:0; transform:translateY(14px) scale(.98) }
          46%,100% { opacity:1; transform:translateY(0) scale(1) }
        }
        @keyframes pinoriaDepartureRoute {
          0%,50% { opacity:0; transform:translate(-50%,10px) }
          68%,100% { opacity:1; transform:translate(-50%,0) }
        }
        @keyframes pinoriaDepartureGlow {
          0%,100% { opacity:.32; transform:scale(.96) }
          50% { opacity:.58; transform:scale(1.04) }
        }
        @keyframes pinoriaDepartureFloat {
          0%,100% { transform:translateY(0) }
          50% { transform:translateY(-6px) }
        }
        @media (prefers-reduced-motion: reduce) {
          .pinoriaDepartureCopy,.pinoriaDepartureCard,.pinoriaDepartureRoute,.pinoriaDepartureCharacter { animation:none!important; opacity:1!important; transform:none!important; }
        }
      `}</style>

      <PinoriaStage dataStage="departure" style={{ background: "radial-gradient(circle at 68% 40%,#8c956d 0,#495439 34%,#273126 67%,#171e18 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(12,18,13,.36),transparent 48%,rgba(13,18,13,.16))" }} />
        <div style={{ position: "absolute", right: "4%", top: "2%", width: "58%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle,#eadb9d38 0,#d7c68310 44%,transparent 70%)", filter: "blur(24px)", animation: "pinoriaDepartureGlow 4.8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", left: "-8%", bottom: "-24%", width: "56%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle,#6a86542b,transparent 69%)", filter: "blur(28px)" }} />

        <section className="pinoriaDepartureCopy" style={{ position: "absolute", left: "7%", top: "20%", width: "43%", animation: "pinoriaDepartureCopy 8.6s cubic-bezier(.18,.8,.2,1) both" }}>
          <span style={{ display: "block", marginBottom: 12, color: "#e7c77a", fontSize: 12, fontWeight: 900, letterSpacing: ".18em" }}>
            CHÀO VỀ · {subject.name.toUpperCase()}
          </span>
          <h1 style={{ margin: "0 0 14px", fontSize: "clamp(54px,4.4vw,84px)", lineHeight: .94, letterSpacing: "-.052em" }}>
            Hẹn gặp lại, {subject.name} ✦
          </h1>
          <p style={{ margin: 0, maxWidth: 620, color: "#e7e2d8", fontSize: "clamp(18px,1.35vw,24px)", lineHeight: 1.42 }}>
            {hasCompanion ? `${subject.name} và Hộ Linh đã hoàn thành thêm một buổi trong Pinoria.` : `${subject.name} đã hoàn thành thêm một buổi trong Pinoria.`}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 28, maxWidth: 650 }}>
            <SummaryCard label="HÀNH TRÌNH" value={subject.path} delay=".18s" />
            <SummaryCard label="KHU VỰC" value={subject.room} delay=".26s" />
            <SummaryCard label="HỘ LINH" value={companionLabel(subject.companion)} delay=".34s" />
            <SummaryCard label="TÀI NGUYÊN" value={`${subject.pls} PLS · ${subject.fruit} Fruit`} delay=".42s" />
          </div>

          <div className="pinoriaDepartureCard" style={{ marginTop: 14, maxWidth: 650, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(110deg,rgba(225,199,116,.16),rgba(255,255,255,.045))", border: "1px solid rgba(232,208,135,.28)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)", animation: "pinoriaDepartureCard 8.6s .22s cubic-bezier(.18,.82,.2,1) both" }}>
            <span style={{ display: "block", color: "#e8cb7d", fontSize: 9, fontWeight: 900, letterSpacing: ".14em", marginBottom: 5 }}>KHOẢNH KHẮC RA VỀ NỔI BẬT</span>
            <strong style={{ display: "block", fontSize: 17, lineHeight: 1.28, color: "#f7f2e8" }}>{subject.path}</strong>
            <small style={{ display: "block", marginTop: 4, color: "#cfd5ca", fontSize: 11 }}>Một dấu mốc nhỏ của hành trình hôm nay đã được mang theo về nhà.</small>
          </div>
        </section>

        <section aria-hidden="true" className="pinoriaDepartureCharacter" data-departure-hero-anchor style={{ position: "absolute", left: `${DEPARTURE_HERO_TARGET.leftPct}%`, top: `${DEPARTURE_HERO_TARGET.topPct}%`, width: `${DEPARTURE_HERO_TARGET.widthPct}%`, aspectRatio: "1 / 1", zIndex: 3, animation: "pinoriaDepartureCharacter 8.6s cubic-bezier(.18,.8,.2,1) both", transformOrigin: "50% 50%" }}>
          <div style={{ position: "absolute", inset: "10%", borderRadius: "50%", border: "1px solid rgba(236,216,146,.16)", boxShadow: "0 0 70px rgba(223,205,119,.14),inset 0 0 60px rgba(255,255,255,.025)" }} />
          <div style={{ position: "absolute", left: "20%", right: "5%", bottom: "8%", height: "7%", borderRadius: "50%", background: "rgba(4,8,5,.55)", filter: "blur(16px)" }} />
          <PrototypeCharacter subjectId={subject.id} wingMotion="idle" size="100%" style={{ position: "relative", zIndex: 2, filter: "drop-shadow(0 30px 30px rgba(0,0,0,.30))", animation: "pinoriaDepartureFloat 3.8s ease-in-out infinite" }} />
          <div style={{ position: "absolute", right: "6%", bottom: "10%", zIndex: 4, minWidth: 150, padding: "8px 12px", borderRadius: 999, textAlign: "center", background: "rgba(18,29,20,.84)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 12px 26px rgba(0,0,0,.18)", backdropFilter: "blur(9px)" }}>
            <strong style={{ display: "block", fontSize: 14 }}>{subject.name}</strong>
            <span style={{ display: "block", marginTop: 2, color: "#d8c990", fontSize: 9, letterSpacing: ".08em" }}>ĐÃ HOÀN THÀNH BUỔI HÔM NAY</span>
          </div>
        </section>

        <div className="pinoriaDepartureRoute" style={{ position: "absolute", left: "50%", bottom: "2.8%", minWidth: "43%", padding: "9px 16px", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(15,23,16,.72)", border: "1px solid rgba(255,255,255,.10)", color: "#d9ddd4", fontSize: 11, letterSpacing: ".05em", backdropFilter: "blur(10px)", animation: "pinoriaDepartureRoute 8.6s cubic-bezier(.18,.82,.2,1) both" }}>
          <strong style={{ color: "#f0d487" }}>{subject.name}</strong>
          <span>Nhà PINO</span><b style={{ color: "#d2b96e" }}>→</b><span>Reception</span><b style={{ color: "#d2b96e" }}>→</b><span>Về nhà</span>
        </div>
      </PinoriaStage>
    </div>
  );
}

function SummaryCard({ label, value, delay }: { label: string; value: string; delay: string }) {
  return (
    <div className="pinoriaDepartureCard" style={{ minHeight: 76, padding: "11px 13px", borderRadius: 17, background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.10)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)", animation: `pinoriaDepartureCard 8.6s ${delay} cubic-bezier(.18,.82,.2,1) both` }}>
      <span style={{ display: "block", color: "#d7c47f", fontSize: 8, fontWeight: 900, letterSpacing: ".13em", marginBottom: 6 }}>{label}</span>
      <strong style={{ display: "block", color: "#f5f1e8", fontSize: 13, lineHeight: 1.25 }}>{value}</strong>
    </div>
  );
}
