"use client";

import type { CSSProperties } from "react";

const EGG_WATER_URL = "https://assets.pinohouse.art/pinoria/Companion/Egg-water.png";

export function EggWaterCompanion({ size = "100%", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <div data-pinoria-egg-water style={{ position: "relative", width: size, aspectRatio: "1 / 1", overflow: "hidden", pointerEvents: "none", ...style }}>
      <img data-pinoria-egg-water-image src={EGG_WATER_URL} alt="" draggable={false} decoding="async" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 50%", transformOrigin: "50% 65%", animation: "pinoriaEggWaterShake 3.1s ease-in-out infinite", filter: "drop-shadow(0 20px 20px rgba(0,0,0,.42)) drop-shadow(0 7px 8px rgba(0,0,0,.28))", willChange: "transform" }} />
      <style>{`@keyframes pinoriaEggWaterShake { 0%,18%,36%,64%,82%,100% { transform:rotate(0deg); } 20% { transform:rotate(-5deg); } 23% { transform:rotate(4.5deg); } 26% { transform:rotate(-3.6deg); } 29% { transform:rotate(3deg); } 32% { transform:rotate(-1.8deg); } 66% { transform:rotate(4deg); } 69% { transform:rotate(-5deg); } 72% { transform:rotate(3.7deg); } 75% { transform:rotate(-2.7deg); } 78% { transform:rotate(1.5deg); } }`}</style>
    </div>
  );
}
