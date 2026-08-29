"use client";

import type { CSSProperties } from "react";

const SIGIL_MORI_URL = "https://assets.pinohouse.art/pinoria/Companion/Sigil-mori.png";
const SIGIL_GLOW = "48,96,144";

export function MoriSigilCompanion({ size = "100%", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <div data-pinoria-mori-sigil style={{ position: "relative", width: size, aspectRatio: "1 / 1", pointerEvents: "none", ...style }}>
      <div data-pinoria-mori-sigil-breath style={{ position: "absolute", inset: 0, transformOrigin: "50% 50%", animation: "pinoriaMoriSigilBreath 3.8s cubic-bezier(.45,.05,.55,.95) infinite", willChange: "transform" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "8%", borderRadius: "50%", background: `radial-gradient(circle,rgba(${SIGIL_GLOW},.34) 0%,rgba(${SIGIL_GLOW},.14) 38%,transparent 72%)`, filter: "blur(12px)" }} />
        <img data-pinoria-mori-sigil-image src={SIGIL_MORI_URL} alt="" draggable={false} decoding="async" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", filter: `drop-shadow(0 0 10px rgba(${SIGIL_GLOW},.95)) drop-shadow(0 0 24px rgba(48,120,168,.62)) drop-shadow(0 10px 14px rgba(0,0,0,.34))` }} />
      </div>
      <style>{`@keyframes pinoriaMoriSigilBreath { 0%,100% { transform:scale3d(1,1,1); } 50% { transform:scale3d(1.025,1.055,1); } }`}</style>
    </div>
  );
}
