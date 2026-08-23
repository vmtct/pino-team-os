"use client";

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

function FloatingProp({ prop }: { prop: (typeof prototypeFloatingProps)[number] }) {
  const zIndex = prop.depth === "back" ? 1 : prop.depth === "mid" ? 3 : 6;
  return (
    <div style={{ position: "absolute", ...prop.anchor, width: prop.width, aspectRatio: "1 / 1", zIndex, pointerEvents: "none", animation: `pinoriaPropReveal .62s ${prop.delay}s cubic-bezier(.18,.82,.2,1) both` }}>
      <div style={{ position: "absolute", inset: "9%", borderRadius: "50%", background: "radial-gradient(circle,rgba(241,220,143,.26),rgba(213,194,117,.08) 48%,transparent 72%)", filter: "blur(9px)", animation: `pinoriaPropGlow ${prop.duration * .82}s ${prop.delay}s ease-in-out infinite` }} />
      <img
        src={prop.src}
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
          transformOrigin: "50% 55%",
          filter: "drop-shadow(0 10px 14px rgba(0,0,0,.22)) drop-shadow(0 0 12px rgba(230,207,126,.10))",
          animation: `pinoriaPropFloat ${prop.duration}s ${prop.delay}s ease-in-out infinite`,
          ['--pinoria-prop-rotate' as string]: `${prop.rotate}deg`,
        }}
      />
      <span style={{ position: "absolute", left: "50%", top: "50%", width: 4, height: 4, borderRadius: "50%", background: "#f5dc87", boxShadow: "18px -22px 0 #f5dc8799,-19px 16px 0 #d9edc588,27px 19px 0 #ffffff70", animation: `pinoriaPropSpark ${prop.duration * .9}s ${prop.delay}s ease-in-out infinite` }} />
    </div>
  );
}

export function ArrivalScene({ subject }: { subject: ArrivalSubject }) {
  const backProps = prototypeFloatingProps.filter((prop) => prop.depth === "back");
  const frontProps = prototypeFloatingProps.filter((prop) => prop.depth !== "back");

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(circle at 61% 42%,#87956b 0,#3b4c35 35%,#1b241a 72%)", color: "#fff" }}>
      <style>{`
        @keyframes pinoriaArrivalCopy { 0%,18% { opacity:0; transform:translateY(16px) } 48%,100% { opacity:1; transform:translateY(0) } }
        @keyframes pinoriaArrivalCharacter { 0%,8% { opacity:0; transform:translateX(56px) scale(.94) } 43% { opacity:1; transform:translateX(0) scale(1.015) } 58%,100% { opacity:1; transform:translateX(0) scale(1) } }
        @keyframes pinoriaArrivalCompanion { 0%,36% { opacity:0; transform:translate(20px,14px) scale(.7) } 62% { opacity:1; transform:translate(-3px,-3px) scale(1.04) } 74%,100% { opacity:1; transform:translate(0,0) scale(1) } }
        @keyframes pinoriaArrivalGlow { 0%,100% { opacity:.45; transform:scale(.97) } 50% { opacity:.72; transform:scale(1.035) } }
        @keyframes pinoriaArrivalFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-7px) } }
        @keyframes pinoriaPropReveal { 0% { opacity:0; transform:translateY(14px) scale(.72) } 72% { opacity:1; transform:translateY(-2px) scale(1.04) } 100% { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes pinoriaPropFloat { 0%,100% { transform:translate3d(0,0,0) rotate(calc(var(--pinoria-prop-rotate) * -.45)) scale(.985) } 50% { transform:translate3d(4px,-12px,0) rotate(var(--pinoria-prop-rotate)) scale(1.022) } }
        @keyframes pinoriaPropGlow { 0%,100% { opacity:.34; transform:scale(.86) } 50% { opacity:.68; transform:scale(1.08) } }
        @keyframes pinoriaPropSpark { 0%,100% { opacity:.15; transform:translate(-50%,-50%) scale(.75) rotate(0deg) } 50% { opacity:.7; transform:translate(-50%,-50%) scale(1.12) rotate(35deg) } }
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
        @keyframes pinoriaVioletGlowCycle {
          0% { opacity:0; filter:brightness(.94) saturate(.96); }
          6% { opacity:.34; }
          12% { opacity:.76; filter:brightness(1.08) saturate(1.06); }
          19% { opacity:.66; }
          26%,100% { opacity:0; filter:brightness(.98) saturate(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-floating-prop] img,[data-pinoria-floating-prop] div,[data-pinoria-floating-prop] span { animation:none!important; }
          [data-pinoria-full-character-aura] img { animation:none!important; opacity:.82!important; }
          [data-pinoria-full-character-glow] img { animation:none!important; opacity:.18!important; }
        }
      `}</style>

      <div style={{ position: "absolute", left: "32%", right: "6%", top: "7%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle,#f0dda243 0,transparent 70%)", filter: "blur(22px)", animation: "pinoriaArrivalGlow 4s ease-in-out infinite" }} />

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
          <div style={{ position: "absolute", left: "25%", right: "13%", bottom: "5%", height: 34, borderRadius: "50%", background: "#050b0680", filter: "blur(15px)" }} />

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

          {backProps.map((prop) => <div key={prop.id} data-pinoria-floating-prop><FloatingProp prop={prop} /></div>)}

          <PrototypeCharacter subjectId={subject.id} wingMotion="arrival" size="min(500px,42vw)" style={{ position: "relative", zIndex: 2, marginRight: 22, filter: "drop-shadow(0 28px 28px rgba(0,0,0,.28))" }} />

          <div
            data-pinoria-full-character-companion
            style={{
              position: "absolute",
              zIndex: 8,
              right: "13%",
              bottom: "-6%",
              width: "min(212px,16.8vw)",
              display: "grid",
              justifyItems: "center",
              gap: 2,
              animation: "pinoriaArrivalCompanion 6.2s cubic-bezier(.18,.82,.2,1) both",
            }}
          >
            <PrototypeCompanion size="100%" style={{ animation: "pinoriaArrivalFloat 3.2s ease-in-out infinite", filter: "drop-shadow(0 14px 18px rgba(0,0,0,.20))" }} />
            <span style={{ marginTop: -31, maxWidth: 176, padding: "5px 9px", borderRadius: 999, background: "#142016d9", border: "1px solid #ffffff18", color: "#efe6d8", fontSize: 9, whiteSpace: "nowrap" }}>{prototypeCompanionManifest.displayName}</span>
          </div>

          {frontProps.map((prop) => <div key={prop.id} data-pinoria-floating-prop><FloatingProp prop={prop} /></div>)}

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
