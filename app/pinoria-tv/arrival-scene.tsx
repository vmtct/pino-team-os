"use client";

import { useEffect, useRef, useState } from "react";
import { activatedMarkIdsFromEarned, characterAccessoriesFromEquipment, characterLayerOverridesFromEquipment, PinoriaCharacterFrame } from "./character-frame";
import { companionView } from "./companion-view";
import type { CharacterProjectionSnapshot, CompanionProjectionSnapshot, ShopCatalogItem } from "./shop-types";
import {
  AMBIENT_HOUSE_ARRIVAL_ASSETS,
  DEFAULT_ARRIVAL_BACKGROUND,
  normalizeArrivalBackgroundVariant,
  PINORIA_ARRIVAL_BACKGROUND_EVENT,
  PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY,
  type ArrivalBackgroundVariant,
} from "./arrival-visual-config";
import {
  PrototypeCharacter,
  PrototypeCompanion,
  prototypeCharacterEffects,
} from "./prototype-assets";

type ArrivalSubject = {
  id: string;
  name: string;
  path: string;
  companion: string;
  character?: CharacterProjectionSnapshot;
  companionState?: CompanionProjectionSnapshot;
};

const HOUSE_COVER_SECONDS = .72;

function HouseAmbientScrim() {
  return (
    <div
      data-pinoria-arrival-house-scrim
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "radial-gradient(circle at 62% 43%,rgba(103,82,68,.15),rgba(31,23,20,.35) 47%,rgba(24,18,16,.62) 100%),linear-gradient(90deg,rgba(28,21,18,.48) 0%,rgba(28,21,18,.24) 48%,rgba(25,18,16,.40) 100%)",
        backdropFilter: "blur(18px) brightness(.58) saturate(.72) contrast(.96)",
        WebkitBackdropFilter: "blur(18px) brightness(.58) saturate(.72) contrast(.96)",
        animation: `pinoriaHouseScrimCover ${HOUSE_COVER_SECONDS}s cubic-bezier(.22,.72,.2,1) both`,
        willChange: "opacity, backdrop-filter",
      }}
    />
  );
}

function OrbitingMarks() {
  const markRefs = useRef<Array<HTMLImageElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const periodMs = 10800;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderFrame = (now: number) => {
      const firstMark = markRefs.current[0];
      const stage = firstMark?.offsetParent as HTMLElement | null;
      if (!stage) {
        frame = window.requestAnimationFrame(renderFrame);
        return;
      }

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const centerX = width * .5 - 11;
      const centerY = height * .68;
      const radiusX = Math.min(205, width * .34);
      const radiusY = Math.min(74, height * .14);
      const baseAngle = reducedMotion ? 0 : ((now % periodMs) / periodMs) * Math.PI * 2;

      prototypeCharacterEffects.marks.forEach((_, index) => {
        const element = markRefs.current[index];
        if (!element) return;

        const angle = baseAngle + index * (Math.PI * 2 / 3);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const depth = (sin + 1) / 2;
        const frontHalf = sin >= 0;
        const x = centerX + radiusX * cos - 50;
        const y = centerY + radiusY * sin - 50;
        const scale = .90 + depth * .12;
        const opacity = .72 + depth * .28;
        const blur = (1 - depth) * .7;
        const tilt = Math.sin(angle * 1.7 + index) * 3.5;

        element.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${tilt}deg)`;
        element.style.opacity = `${opacity}`;
        element.style.zIndex = frontHalf ? "18" : "-1";
        element.style.filter = `brightness(${.92 + depth * .13}) saturate(${.94 + depth * .10}) blur(${blur}px) drop-shadow(0 9px 14px rgba(0,0,0,${.12 + depth * .08}))`;
        element.dataset.pinoriaOrbitDepth = frontHalf ? "front" : "behind";
      });

      if (!reducedMotion) frame = window.requestAnimationFrame(renderFrame);
    };

    frame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {prototypeCharacterEffects.marks.map((mark, index) => (
        <img
          key={mark.id}
          ref={(element) => { markRefs.current[index] = element; }}
          data-pinoria-orbit-mark={mark.id}
          data-pinoria-orbit-depth="behind"
          src={mark.src}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 100,
            height: 100,
            objectFit: "contain",
            opacity: 0,
            pointerEvents: "none",
            transformOrigin: "50% 50%",
            willChange: "transform, opacity, filter",
          }}
        />
      ))}
    </>
  );
}

export function ArrivalScene({ subject, catalog = [] }: { subject: ArrivalSubject; catalog?: readonly ShopCatalogItem[] }) {
  const [backgroundVariant, setBackgroundVariant] = useState<ArrivalBackgroundVariant>(DEFAULT_ARRIVAL_BACKGROUND);

  useEffect(() => {
    const syncFromStorage = () => {
      setBackgroundVariant(normalizeArrivalBackgroundVariant(window.localStorage.getItem(PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY)));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PINORIA_ARRIVAL_BACKGROUND_STORAGE_KEY) syncFromStorage();
    };
    const onDirectChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setBackgroundVariant(normalizeArrivalBackgroundVariant(detail));
    };

    syncFromStorage();
    window.addEventListener("storage", onStorage);
    window.addEventListener(PINORIA_ARRIVAL_BACKGROUND_EVENT, onDirectChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PINORIA_ARRIVAL_BACKGROUND_EVENT, onDirectChange);
    };
  }, []);

  const characterAccessories = characterAccessoriesFromEquipment(subject.character?.equipment);
  const layerOverrides = characterLayerOverridesFromEquipment(subject.character?.equipment, catalog);
  const prestigeMarkIds = activatedMarkIdsFromEarned(subject.character?.earnedAchievementIds);
  const companion = companionView(subject);
  const houseBackground = backgroundVariant === "ambient-house-blur";
  const foregroundDelay = houseBackground ? HOUSE_COVER_SECONDS : 0;

  return (
    <div
      data-pinoria-arrival-background={backgroundVariant}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        overflow: "hidden",
        background: houseBackground
          ? "transparent"
          : "radial-gradient(circle at 61% 42%,rgba(126,103,89,.24) 0,rgba(84,66,57,.12) 34%,transparent 62%),linear-gradient(135deg,#443a35 0%,#392f2b 48%,#292320 100%)",
        color: "#f8f3ee",
      }}
    >
      {houseBackground ? <HouseAmbientScrim /> : null}

      <style>{`
        @keyframes pinoriaHouseScrimCover {
          0% { opacity:0; }
          100% { opacity:1; }
        }
        @keyframes pinoriaArrivalCopy { 0%,18% { opacity:0; transform:translateY(16px) } 48%,100% { opacity:1; transform:translateY(0) } }
        @keyframes pinoriaArrivalCharacter { 0%,8% { opacity:0; transform:translateX(56px) scale(.94) } 43% { opacity:1; transform:translateX(0) scale(1.015) } 58%,100% { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaArrivalCompanion { 0%,36% { opacity:0; transform:translate(20px,14px) scale(.7) } 62% { opacity:1; transform:translate(-3px,-3px) scale(1.04) } 74%,100% { opacity:1; transform:translate(0,0) scale(1) } }
        @keyframes pinoriaArrivalGlow { 0%,100% { opacity:.41; transform:scale(.97) } 50% { opacity:.65; transform:scale(1.035) } }
        @keyframes pinoriaArrivalFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-7px) } }
        @keyframes pinoriaAuraPulse {
          0%,100% { transform:scale(.985); }
          50% { transform:scale(1.018); }
        }
        @keyframes pinoriaAuraRadiance {
          0%,16%,100% { opacity:.72; filter:brightness(.98) drop-shadow(0 0 10px rgba(182,111,255,.14)); }
          28% { opacity:.9; filter:brightness(1.07) drop-shadow(0 0 24px rgba(182,111,255,.28)); }
          44% { opacity:.76; filter:brightness(1) drop-shadow(0 0 13px rgba(182,111,255,.18)); }
          67% { opacity:.96; filter:brightness(1.1) drop-shadow(0 0 31px rgba(182,111,255,.34)); }
          82% { opacity:.79; filter:brightness(1.02) drop-shadow(0 0 16px rgba(182,111,255,.2)); }
        }
        /* 6.4s loop, 1.6s between variants, 0.4s crossfade. Each outgoing
           glow fades for exactly the same 0.4s that the incoming glow fades in. */
        @keyframes pinoriaVioletGlowCycle {
          0% { opacity:0; filter:brightness(.96) saturate(.98); }
          6.25% { opacity:.72; filter:brightness(1.08) saturate(1.06); }
          25% { opacity:.72; filter:brightness(1.08) saturate(1.06); }
          31.25% { opacity:0; filter:brightness(.98) saturate(1); }
          100% { opacity:0; filter:brightness(.98) saturate(1); }
        }
        @keyframes pinoriaInventoryReveal {
          0% { opacity:0; transform:translate(14px,-8px) scale(.94); }
          100% { opacity:1; transform:translate(0,0) scale(1); }
        }
        @keyframes pinoriaInventoryItemReveal {
          0% { opacity:0; transform:translateY(-7px) scale(.9); }
          72% { opacity:1; transform:translateY(1px) scale(1.025); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-arrival-house-scrim] { animation:none!important; opacity:1!important; }
          [data-pinoria-full-character-aura] img { animation:none!important; opacity:.82!important; }
          [data-pinoria-full-character-glow] img { animation:none!important; opacity:.18!important; }
          [data-pinoria-arrival-inventory],[data-pinoria-inventory-item],[data-pinoria-inventory-placeholder] { animation:none!important; }
          .pinoriaArrivalCopy,.pinoriaArrivalCharacter { animation:none!important; opacity:1!important; transform:none!important; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          left: "30%",
          right: "5%",
          top: "5%",
          height: "82%",
          zIndex: 1,
          borderRadius: "50%",
          background: houseBackground
            ? "radial-gradient(circle,rgba(151,123,105,.10) 0,rgba(111,88,75,.04) 44%,transparent 72%)"
            : "radial-gradient(circle,rgba(151,123,105,.15) 0,rgba(111,88,75,.06) 44%,transparent 72%)",
          filter: "blur(26px)",
          animation: `pinoriaArrivalGlow 4s ${foregroundDelay}s ease-in-out infinite`,
        }}
      />

      <div style={{ position: "absolute", inset: 0, zIndex: 2, boxSizing: "border-box", padding: "76px clamp(70px,7vw,110px) 58px", display: "grid", gridTemplateColumns: "minmax(0,.82fr) minmax(500px,1.18fr)", alignItems: "center", gap: 34 }}>
        <section className="pinoriaArrivalCopy" style={{ maxWidth: 560, animation: `pinoriaArrivalCopy 6.2s ${foregroundDelay}s cubic-bezier(.2,.75,.2,1) both` }}>
          <span style={{ display: "block", marginBottom: 12, color: "#e7c77a", fontSize: 11, fontWeight: 900, letterSpacing: ".18em" }}>CHÀO ĐẾN · {subject.name.toUpperCase()}</span>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(50px,5.2vw,72px)", lineHeight: .94, letterSpacing: "-.05em" }}>Chào {subject.name} ✦</h1>
          <p style={{ margin: 0, maxWidth: 520, color: "#eee6d7", fontSize: "clamp(19px,1.75vw,24px)", lineHeight: 1.42 }}>{companion.active ? `“Hôm nay ${companion.displayName} đi cùng mình!”` : "“Hôm nay mình cùng khám phá Pinoria nhé!”"}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 26 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HÀNH TRÌNH</strong>{subject.path}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HỘ LINH</strong>{companion.fullLabel}</span>
          </div>
        </section>

        <section aria-hidden="true" className="pinoriaArrivalCharacter" style={{ position: "relative", width: "min(650px,50vw)", height: "min(590px,76vh)", justifySelf: "end", display: "grid", placeItems: "center", animation: `pinoriaArrivalCharacter 6.2s ${foregroundDelay}s cubic-bezier(.18,.8,.2,1) both` }}>
          <PinoriaCharacterFrame subjectId={subject.id} subjectName={subject.name} accessories={characterAccessories} style={{ width: "100%", height: "100%" }} identityStyle={{ padding: "5px 8px 10px" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", placeItems: "center" }}>
          <OrbitingMarks />

          <div
            data-pinoria-full-character-aura
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "min(430px,36vw,52vh)",
              aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%) translateX(-11px)",
              zIndex: 0,
              pointerEvents: "none",
              filter: "drop-shadow(0 0 54px #dfcd7720)",
            }}
          >
            <img
              src={prototypeCharacterEffects.aura.src}
              alt=""
              draggable={false}
              decoding="async"
              loading="eager"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transformOrigin: "50% 50%",
                animation: "pinoriaAuraPulse 4.8s ease-in-out infinite, pinoriaAuraRadiance 7.6s ease-in-out infinite",
              }}
            />
          </div>

          <div
            data-pinoria-character-foot-shadow
            style={{
              position: "absolute",
              left: "calc(50% - 11px)",
              top: "calc(50% + min(250px,21vw) - 15px)",
              width: "42%",
              height: 30,
              transform: "translateX(-50%)",
              zIndex: 1,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center,rgba(17,11,8,.58) 0%,rgba(17,11,8,.34) 38%,rgba(17,11,8,.10) 67%,transparent 82%)",
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "calc(50% - 11px)",
              top: "calc(50% + min(250px,21vw) - 6px)",
              width: "24%",
              height: 12,
              transform: "translateX(-50%)",
              zIndex: 1,
              borderRadius: "50%",
              background: "rgba(12,8,6,.36)",
              filter: "blur(5px)",
              pointerEvents: "none",
            }}
          />

          <PrototypeCharacter subjectId={subject.id} wingMotion="arrival" layerOverrides={layerOverrides} prestigeMarkIds={prestigeMarkIds} size="min(430px,36vw,52vh)" style={{ position: "relative", zIndex: 2, marginRight: 22, filter: "drop-shadow(0 28px 28px rgba(0,0,0,.28))" }} />

          {companion.active ? <div
            data-pinoria-full-character-companion
            data-pinoria-companion-name={companion.displayName}
            style={{
              position: "absolute",
              zIndex: 8,
              right: "13%",
              bottom: "calc(-6% + 10px)",
              width: "min(212px,16.8vw)",
              display: "grid",
              justifyItems: "center",
              gap: 2,
              animation: `pinoriaArrivalCompanion 6.2s ${foregroundDelay}s cubic-bezier(.18,.82,.2,1) both`,
            }}
          >
            <PrototypeCompanion displayName={companion.displayName} visualId={companion.visualId ?? undefined} size="100%" style={{ animation: "pinoriaArrivalFloat 3.2s ease-in-out infinite", filter: "drop-shadow(0 14px 18px rgba(0,0,0,.20))" }} />
          </div> : null}
          <div
            data-pinoria-full-character-glow
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "min(430px,36vw,52vh)",
              aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%) translateX(-11px)",
              zIndex: 12,
              pointerEvents: "none",
            }}
          >
            {prototypeCharacterEffects.glows.map((glow, index) => (
              <img
                key={glow.id}
                src={glow.src}
                alt=""
                draggable={false}
                decoding="async"
                loading="eager"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  opacity: 0,
                  transform: glow.mirrored ? "scaleX(-1)" : "scaleX(1)",
                  transformOrigin: "50% 50%",
                  mixBlendMode: "screen",
                  filter: "drop-shadow(0 0 13px rgba(183,104,255,.18))",
                  animation: `pinoriaVioletGlowCycle 6.4s ${index * 1.6}s linear infinite`,
                  willChange: "opacity, filter",
                }}
              />
            ))}
          </div>            </div>
          </PinoriaCharacterFrame>
        </section>
      </div>
    </div>
  );
}
