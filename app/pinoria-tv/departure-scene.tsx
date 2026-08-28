"use client";

import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PinoriaStage } from "./pinoria-stage";
import { activatedMarkIdsFromEarned, characterAccessoriesFromEquipment, characterLayerOverridesFromEquipment, PinoriaCharacterFrame } from "./character-frame";
import { companionView } from "./companion-view";
import type { CharacterProjectionSnapshot, CompanionProjectionSnapshot, ShopCatalogItem } from "./shop-types";
import { PrototypeCharacter, PrototypeCompanion } from "./prototype-assets";

type DepartureSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  character?: CharacterProjectionSnapshot;
  companionState?: CompanionProjectionSnapshot;
};


function DepartureHouseScrim() {
  return (
    <div
      data-pinoria-departure-house-scrim
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "radial-gradient(circle at 68% 40%,rgba(140,149,109,.24) 0,rgba(73,84,57,.34) 34%,rgba(39,49,38,.50) 67%,rgba(23,30,24,.64) 100%),linear-gradient(90deg,rgba(12,18,13,.28),rgba(12,18,13,.10) 48%,rgba(13,18,13,.22))",
        backdropFilter: "blur(7px) brightness(.62) saturate(.78) contrast(.98)",
        WebkitBackdropFilter: "blur(7px) brightness(.62) saturate(.78) contrast(.98)",
      }}
    />
  );
}

export function DepartureScene({ subject, catalog = [] }: { subject: DepartureSubject; catalog?: readonly ShopCatalogItem[] }) {
  const companion = companionView(subject);
  const hasCompanion = companion.active;
  const characterAccessories = characterAccessoriesFromEquipment(subject.character?.equipment);
  const layerOverrides = characterLayerOverridesFromEquipment(subject.character?.equipment, catalog);
  const prestigeMarkIds = activatedMarkIdsFromEarned(subject.character?.earnedAchievementIds);


  return (
    <div data-pinoria-departure-reveal style={{ position: "absolute", inset: 0, overflow: "hidden", background: "transparent", color: "#fff" }}>
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

      <PinoriaStage dataStage="departure" style={{ background: "transparent" }}>
        <DepartureHouseScrim />
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
            <SummaryCard label="HỘ LINH" value={companion.fullLabel} delay=".34s" />
            <SummaryCard label="NHẬT KÝ" value="Khoảnh khắc hôm nay đã được lưu" delay=".42s" />
          </div>

          <div className="pinoriaDepartureCard" style={{ marginTop: 14, maxWidth: 650, padding: "12px 14px", borderRadius: 18, background: "linear-gradient(110deg,rgba(225,199,116,.16),rgba(255,255,255,.045))", border: "1px solid rgba(232,208,135,.28)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)", animation: "pinoriaDepartureCard 8.6s .22s cubic-bezier(.18,.82,.2,1) both" }}>
            <span style={{ display: "block", color: "#e8cb7d", fontSize: 9, fontWeight: 900, letterSpacing: ".14em", marginBottom: 5 }}>KHOẢNH KHẮC RA VỀ NỔI BẬT</span>
            <strong style={{ display: "block", fontSize: 17, lineHeight: 1.28, color: "#f7f2e8" }}>{subject.path}</strong>
            <small style={{ display: "block", marginTop: 4, color: "#cfd5ca", fontSize: 11 }}>Một dấu mốc nhỏ của hành trình hôm nay đã được mang theo về nhà.</small>
          </div>
        </section>

        <section aria-hidden="true" className="pinoriaDepartureCharacter" data-departure-hero-anchor style={{ position: "absolute", left: `${DEPARTURE_HERO_TARGET.leftPct}%`, top: `${DEPARTURE_HERO_TARGET.topPct}%`, width: `${DEPARTURE_HERO_TARGET.widthPct}%`, aspectRatio: "1 / 1", zIndex: 3, animation: "pinoriaDepartureCharacter 8.6s cubic-bezier(.18,.8,.2,1) both", transformOrigin: "50% 50%" }}>
          <PinoriaCharacterFrame
            subjectId={subject.id}
            subjectName={subject.name}
            accessories={characterAccessories}
            style={{ width: "100%", height: "100%" }}
            identityStyle={{ padding: "5px 8px 10px" }}
            companion={hasCompanion ? <div data-departure-companion style={{ position: "absolute", right: "clamp(70px,6vw,96px)", bottom: "8%", width: "clamp(112px,8vw,150px)", zIndex: 5 }}><PrototypeCompanion displayName={companion.displayName} visualId={companion.visualId ?? undefined} size="100%" style={{ filter: "drop-shadow(0 16px 18px rgba(0,0,0,.24))", animation: "pinoriaDepartureFloat 3.8s ease-in-out infinite" }} /></div> : undefined}
          >
            <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", placeItems: "center" }}>
              <div style={{ position: "absolute", inset: "12%", borderRadius: "50%", border: "1px solid rgba(236,216,146,.16)", boxShadow: "0 0 70px rgba(223,205,119,.14),inset 0 0 60px rgba(255,255,255,.025)" }} />
              <div style={{ position: "absolute", left: "20%", right: "5%", bottom: "8%", height: "7%", borderRadius: "50%", background: "rgba(4,8,5,.55)", filter: "blur(16px)" }} />
              <PrototypeCharacter subjectId={subject.id} wingMotion="idle" layerOverrides={layerOverrides} prestigeMarkIds={prestigeMarkIds} size="min(88%,52vh)" style={{ position: "relative", zIndex: 2, filter: "drop-shadow(0 30px 30px rgba(0,0,0,.30))", animation: "pinoriaDepartureFloat 3.8s ease-in-out infinite" }} />
            </div>
          </PinoriaCharacterFrame>
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
