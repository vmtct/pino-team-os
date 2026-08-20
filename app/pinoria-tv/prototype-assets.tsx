"use client";

import type { CSSProperties } from "react";

export type PrototypeCharacterSlot = "back" | "body" | "hair" | "face" | "headwear" | "eyewear";
export type PrototypeWingMotion = "off" | "idle" | "arrival";

type CharacterLayer = {
  slot: PrototypeCharacterSlot;
  displayName: string;
  src: string;
  order: number;
};

export const prototypeCharacterManifest = {
  id: "golden-slice-character-v1",
  canvas: { width: 2048, height: 2048 },
  layers: [
    { slot: "back", displayName: "Cánh Hologram", src: "https://assets.pinohouse.art/draft/Chat_Wing%20Hollogram.png", order: 10 },
    { slot: "body", displayName: "Trang phục Hội Họa", src: "https://assets.pinohouse.art/draft/Char_body_painting_girl.png", order: 20 },
    { slot: "hair", displayName: "Tóc Ngắn", src: "https://assets.pinohouse.art/draft/Char_hair_girl_short.png", order: 30 },
    { slot: "face", displayName: "Gương mặt Mỉm Cười", src: "https://assets.pinohouse.art/draft/Char_face_smiley.png", order: 40 },
    { slot: "headwear", displayName: "Nón Sinh Nhật", src: "https://assets.pinohouse.art/draft/Char_Birthday%20Hat.png", order: 50 },
    { slot: "eyewear", displayName: "Kính Sao", src: "https://assets.pinohouse.art/draft/Char_Glasses%20Star.png", order: 60 },
  ] satisfies CharacterLayer[],
} as const;

export const prototypeCompanionManifest = {
  id: "mori-v1",
  displayName: "Mori",
  canvas: { width: 1487, height: 1487 },
  src: "https://assets.pinohouse.art/draft/Mori.png",
} as const;

export const prototypeFloatingProps = [
  {
    id: "floating-prop-1",
    displayName: "Đạo cụ 1",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories1.png",
    anchor: { left: "1%", top: "12%" },
    width: "min(132px,10.5vw)",
    depth: "back",
    delay: 0.15,
    duration: 4.8,
    rotate: -3,
  },
  {
    id: "floating-prop-2",
    displayName: "Đạo cụ 2",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories2.png",
    anchor: { right: "1%", top: "13%" },
    width: "min(126px,10vw)",
    depth: "mid",
    delay: 0.42,
    duration: 5.4,
    rotate: 4,
  },
  {
    id: "floating-prop-3",
    displayName: "Đạo cụ 3",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories3.png",
    anchor: { left: "3%", top: "58%" },
    width: "min(118px,9.4vw)",
    depth: "front",
    delay: 0.7,
    duration: 4.3,
    rotate: 3,
  },
  {
    id: "floating-prop-4",
    displayName: "Đạo cụ 4",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories4.png",
    anchor: { right: "7%", top: "56%" },
    width: "min(110px,8.8vw)",
    depth: "front",
    delay: 0.95,
    duration: 5.1,
    rotate: -4,
  },
] as const;

export const prototypeChoiceAssets = {
  A1: { displayName: "Nón Sinh Nhật", src: prototypeCharacterManifest.layers[4].src, status: "Đang mang" },
  A2: { displayName: "Kính Sao", src: prototypeCharacterManifest.layers[5].src, status: "Đã có" },
  B1: { displayName: "Cánh Hologram", src: prototypeCharacterManifest.layers[0].src, price: "180 PLS" },
  B2: { displayName: "Trang phục Hội Họa", src: prototypeCharacterManifest.layers[1].src, price: "360 PLS" },
  B3: { displayName: "Tóc Ngắn", src: prototypeCharacterManifest.layers[2].src, price: "520 PLS" },
} as const;

export const prototypeAssetUrls = [
  ...prototypeCharacterManifest.layers.map((layer) => layer.src),
  prototypeCompanionManifest.src,
  ...prototypeFloatingProps.map((prop) => prop.src),
];

export function PrototypeCharacter({
  size = "100%",
  style,
  hiddenSlots = [],
  wingMotion = "idle",
}: {
  size?: number | string;
  style?: CSSProperties;
  hiddenSlots?: PrototypeCharacterSlot[];
  wingMotion?: PrototypeWingMotion;
}) {
  const hidden = new Set(hiddenSlots);
  const layers = [...prototypeCharacterManifest.layers].sort((a, b) => a.order - b.order);

  return (
    <div aria-label="Nhân vật Pinoria mẫu" style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", flex: "0 0 auto", ...style }}>
      <style>{`
        @keyframes pinoriaWingIdleFold {
          0%,100% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.02) drop-shadow(0 0 10px rgba(183,229,255,.12));
          }
          50% {
            transform: scaleX(.935);
            opacity: .965;
            filter: brightness(.97) drop-shadow(0 0 5px rgba(183,229,255,.07));
          }
        }
        @keyframes pinoriaWingArrivalFold {
          0% {
            transform: scaleX(.90);
            opacity: .92;
            filter: brightness(.94) drop-shadow(0 0 4px rgba(183,229,255,.06));
          }
          18% {
            transform: scaleX(1.018);
            opacity: 1;
            filter: brightness(1.06) drop-shadow(0 0 14px rgba(183,229,255,.18));
          }
          38% {
            transform: scaleX(.962);
            opacity: .975;
            filter: brightness(.98) drop-shadow(0 0 7px rgba(183,229,255,.10));
          }
          58% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.025) drop-shadow(0 0 11px rgba(183,229,255,.14));
          }
          78% {
            transform: scaleX(.945);
            opacity: .968;
            filter: brightness(.97) drop-shadow(0 0 6px rgba(183,229,255,.08));
          }
          100% {
            transform: scaleX(.99);
            opacity: 1;
            filter: brightness(1.01) drop-shadow(0 0 9px rgba(183,229,255,.11));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-wing-layer="true"] { animation: none !important; transform: none !important; }
        }
      `}</style>
      {layers.filter((layer) => !hidden.has(layer.slot)).map((layer) => {
        const isWing = layer.slot === "back";
        const wingAnimation = wingMotion === "arrival"
          ? "pinoriaWingArrivalFold 6.2s cubic-bezier(.22,.72,.2,1) both"
          : wingMotion === "idle"
            ? "pinoriaWingIdleFold 3.8s ease-in-out infinite"
            : undefined;

        return (
          <img
            key={layer.slot}
            src={layer.src}
            alt=""
            draggable={false}
            decoding="async"
            loading="eager"
            data-pinoria-wing-layer={isWing ? "true" : undefined}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
              ...(isWing ? {
                transformOrigin: "50% 50%",
                animation: wingAnimation,
                willChange: "transform, opacity, filter",
              } : null),
            }}
          />
        );
      })}
    </div>
  );
}

export function PrototypeCompanion({ size = "100%", style }: { size?: number | string; style?: CSSProperties }) {
  return (
    <div aria-label={prototypeCompanionManifest.displayName} style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", flex: "0 0 auto", ...style }}>
      <img src={prototypeCompanionManifest.src} alt="" draggable={false} decoding="async" loading="eager" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", userSelect: "none" }} />
    </div>
  );
}
