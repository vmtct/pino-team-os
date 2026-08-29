"use client";

import type { CSSProperties } from "react";

const MORI_SLEEP_URL = "https://assets.pinohouse.art/pinoria/Companion/mori-sleep.png";

export function MoriSleepCompanion({ size = "100%", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <div data-pinoria-mori-sleep style={{ position: "relative", width: size, aspectRatio: "1 / 1", overflow: "hidden", pointerEvents: "none", ...style }}>
      <img data-pinoria-mori-sleep-image src={MORI_SLEEP_URL} alt="" draggable={false} decoding="async" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", transformOrigin: "50% 74%", animation: "pinoriaMoriSleepBreath 3.8s cubic-bezier(.45,.05,.55,.95) infinite", filter: "drop-shadow(0 20px 20px rgba(0,0,0,.42)) drop-shadow(0 7px 8px rgba(0,0,0,.28))", willChange: "transform" }} />
      <style>{`@keyframes pinoriaMoriSleepBreath { 0%,100% { transform:scale3d(1,1,1); } 50% { transform:scale3d(1.025,1.055,1); } }`}</style>
    </div>
  );
}
