"use client";

import type { CSSProperties } from "react";

const EGG_WATER_URL = "https://assets.pinohouse.art/pinoria/Companion/Egg-water.png";

export function EggWaterCompanion({ size = "100%", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <div data-pinoria-egg-water style={{ position: "relative", width: size, aspectRatio: "1 / 1", overflow: "hidden", pointerEvents: "none", ...style }}>
      <img data-pinoria-egg-water-image src={EGG_WATER_URL} alt="" draggable={false} decoding="async" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", transformOrigin: "50% 63.75%", animation: "pinoriaEggWaterSway 1.65s cubic-bezier(.45,.05,.55,.95) infinite", filter: "drop-shadow(0 20px 20px rgba(0,0,0,.42)) drop-shadow(0 7px 8px rgba(0,0,0,.28))", willChange: "transform" }} />
      <style>{`@keyframes pinoriaEggWaterSway { 0%,100% { transform:rotate(-5deg); } 50% { transform:rotate(5deg); } }`}</style>
    </div>
  );
}
