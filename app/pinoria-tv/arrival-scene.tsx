"use client";

import { useEffect, useRef } from "react";
import {
  PrototypeCharacter,
  PrototypeCompanion,
  prototypeCharacterEffects,
  prototypeCompanionManifest,
  prototypeFloatingProps,
} from "./prototype-assets";

type ArrivalSubject = {
  id: string;
  name: string;
  path: string;
  companion: string;
};

const INVENTORY_PLACEHOLDERS = ["Huy hiệu", "Dây chuyền", "Vòng tay", "Nhẫn"] as const;

function InventoryGrid() {
  return (
    <div
      data-pinoria-arrival-inventory
      style={{
        position: "absolute",
        right: 24,
        top: 18,
        zIndex: 24,
        display: "grid",
        justifyItems: "end",
        gap: 6,
        pointerEvents: "none",
        animation: "pinoriaInventoryReveal .72s .48s cubic-bezier(.18,.82,.2,1) both",
      }}
    >
      <div
        style={{
          paddingRight: 2,
          color: "rgba(244,232,210,.68)",
          fontSize: 9,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: ".16em",
        }}
      >
        TRANG BỊ
      </div>

      <div
        data-pinoria-arrival-inventory-grid
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 63px)",
          gridTemplateRows: "repeat(4, 63px)",
          gap: 6,
          padding: 7,
          borderRadius: 14,
          background: "rgba(43,32,27,.50)",
          border: "1px solid rgba(255,255,255,.11)",
          boxShadow: "0 15px 31px rgba(0,0,0,.19), inset 0 1px 0 rgba(255,255,255,.045)",
          backdropFilter: "blur(10px)",
        }}
      >
        {prototypeFloatingProps.map((prop, index) => (
          <div
            key={prop.id}
            data-pinoria-inventory-item={prop.id}
            style={{
              position: "relative",
              width: 63,
              height: 63,
              borderRadius: 11,
              overflow: "hidden",
              background: "linear-gradient(160deg,rgba(255,255,255,.085),rgba(255,255,255,.022))",
              border: "1px solid rgba(240,213,142,.15)",
              boxShadow: "inset 0 0 15px rgba(215,194,117,.03)",
              animation: `pinoriaInventoryItemReveal .54s ${.58 + index * .08}s cubic-bezier(.18,.82,.2,1) both`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "13%",
                borderRadius: "50%",
                background: "radial-gradient(circle,rgba(231,211,145,.12),transparent 70%)",
                filter: "blur(6px)",
              }}
            />
            <img
              src={prop.src}
              alt=""
              draggable={false}
              decoding="async"
              loading="eager"
              style={{
                position: "absolute",
                inset: 5,
                width: "calc(100% - 10px)",
                height: "calc(100% - 10px)",
                objectFit: "contain",
                filter: "drop-shadow(0 5px 7px rgba(0,0,0,.2))",
              }}
            />
          </div>
        ))}

        {INVENTORY_PLACEHOLDERS.map((label, index) => (
          <div
            key={label}
            data-pinoria-inventory-placeholder={label}
            style={{
              position: "relative",
              width: 63,
              height: 63,
              display: "grid",
              placeItems: "center",
              borderRadius: 11,
              boxSizing: "border-box",
              background: "rgba(255,255,255,.02)",
              border: "1px dashed rgba(229,216,175,.17)",
              color: "rgba(235,230,211,.40)",
              textAlign: "center",
              fontSize: 7.7,
              lineHeight: 1.2,
              letterSpacing: ".02em",
              padding: 6,
              animation: `pinoriaInventoryItemReveal .54s ${.9 + index * .08}s cubic-bezier(.18,.82,.2,1) both`,
            }}
          >
            <span style={{ display: "grid", gap: 3, justifyItems: "center" }}>
              <i
                aria-hidden="true"
                style={{
                  display: "block",
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  border: "1px solid rgba(235,230,211,.20)",
                  position: "relative",
                }}
              >
                <b style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-54%)", fontSize: 10, fontWeight: 400, lineHeight: 1, color: "rgba(235,230,211,.28)" }}>+</b>
              </i>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
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

export function ArrivalScene({ subject }: { subject: ArrivalSubject }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "radial-gradient(circle at 61% 42%,rgba(126,103,89,.24) 0,rgba(84,66,57,.12) 34%,transparent 62%),linear-gradient(135deg,#443a35 0%,#392f2b 48%,#292320 100%)",
        color: "#f8f3ee",
      }}
    >
      <style>{`
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
          [data-pinoria-full-character-aura] img { animation:none!important; opacity:.82!important; }
          [data-pinoria-full-character-glow] img { animation:none!important; opacity:.18!important; }
          [data-pinoria-arrival-inventory],[data-pinoria-inventory-item],[data-pinoria-inventory-placeholder] { animation:none!important; }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          left: "30%",
          right: "5%",
          top: "5%",
          height: "82%",
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(151,123,105,.15) 0,rgba(111,88,75,.06) 44%,transparent 72%)",
          filter: "blur(26px)",
          animation: "pinoriaArrivalGlow 4s ease-in-out infinite",
        }}
      />

      <InventoryGrid />

      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", padding: "76px clamp(70px,7vw,110px) 58px", display: "grid", gridTemplateColumns: "minmax(0,.82fr) minmax(500px,1.18fr)", alignItems: "center", gap: 34 }}>
        <section style={{ maxWidth: 560, animation: "pinoriaArrivalCopy 6.2s cubic-bezier(.2,.75,.2,1) both" }}>
          <span style={{ display: "block", marginBottom: 12, color: "#e7c77a", fontSize: 11, fontWeight: 900, letterSpacing: ".18em" }}>CHÀO ĐẾN · {subject.name.toUpperCase()}</span>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(50px,5.2vw,72px)", lineHeight: .94, letterSpacing: "-.05em" }}>Chào {subject.name} ✦</h1>
          <p style={{ margin: 0, maxWidth: 520, color: "#eee6d7", fontSize: "clamp(19px,1.75vw,24px)", lineHeight: 1.42 }}>{`“Hôm nay ${prototypeCompanionManifest.displayName} đi cùng mình!”`}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 26 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HÀNH TRÌNH</strong>{subject.path}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 30, padding: "6px 10px", borderRadius: 999, background: "#ffffff0b", border: "1px solid #ffffff1b", color: "#dfe4da", fontSize: 10 }}><strong style={{ color: "#f0d58d", fontSize: 9, letterSpacing: ".06em" }}>HỘ LINH</strong>{prototypeCompanionManifest.displayName}</span>
          </div>
        </section>

        <section aria-hidden="true" style={{ position: "relative", width: "min(610px,48vw)", height: "min(530px,70vh)", justifySelf: "end", display: "grid", placeItems: "center", animation: "pinoriaArrivalCharacter 6.2s cubic-bezier(.18,.8,.2,1) both" }}>
          <div style={{ position: "absolute", width: "76%", aspectRatio: "1", borderRadius: "50%", border: "1px solid #ead89322", boxShadow: "0 0 54px #dfcd7720" }} />

          <OrbitingMarks />

          <div
            data-pinoria-full-character-aura
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "min(500px,42vw)",
              aspectRatio: "1 / 1",
              transform: "translate(-50%,-50%) translateX(-11px)",
              zIndex: 0,
              pointerEvents: "none",
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

          <PrototypeCharacter subjectId={subject.id} wingMotion="arrival" size="min(500px,42vw)" style={{ position: "relative", zIndex: 2, marginRight: 22, filter: "drop-shadow(0 28px 28px rgba(0,0,0,.28))" }} />

          <div
            data-pinoria-full-character-companion
            style={{
              position: "absolute",
              zIndex: 8,
              right: "13%",
              bottom: "calc(-6% + 10px)",
              width: "min(212px,16.8vw)",
              display: "grid",
              justifyItems: "center",
              gap: 2,
              animation: "pinoriaArrivalCompanion 6.2s cubic-bezier(.18,.82,.2,1) both",
            }}
          >
            <PrototypeCompanion size="100%" style={{ animation: "pinoriaArrivalFloat 3.2s ease-in-out infinite", filter: "drop-shadow(0 14px 18px rgba(0,0,0,.20))" }} />
          </div>

          <div
            data-pinoria-full-character-glow
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "min(500px,42vw)",
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
          </div>
        </section>
      </div>
    </div>
  );
}
