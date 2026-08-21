"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  prototypeCharacterProfileAssetUrls,
  prototypeCharacterProfileForSubject,
} from "./prototype-character-profiles";

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
    anchor: { left: "2%", top: "11%" },
    width: "min(128px,10.2vw)",
    depth: "back",
    delay: 0.15,
    duration: 4.8,
    rotate: -3,
  },
  {
    id: "floating-prop-2",
    displayName: "Đạo cụ 2",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories2.png",
    anchor: { right: "2%", top: "12%" },
    width: "min(128px,10.2vw)",
    depth: "mid",
    delay: 0.42,
    duration: 5.4,
    rotate: 4,
  },
  {
    id: "floating-prop-3",
    displayName: "Đạo cụ 3",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories3.png",
    anchor: { left: "4%", top: "49%" },
    width: "min(124px,9.8vw)",
    depth: "front",
    delay: 0.7,
    duration: 4.3,
    rotate: 3,
  },
  {
    id: "floating-prop-4",
    displayName: "Đạo cụ 4",
    src: "https://assets.pinohouse.art/draft/Pinoria_accessories4.png",
    anchor: { right: "4%", top: "47%" },
    width: "min(148px,11.7vw)",
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
  ...prototypeCharacterProfileAssetUrls,
  prototypeCompanionManifest.src,
  ...prototypeFloatingProps.map((prop) => prop.src),
];

function StandardLayer({ layer }: { layer: CharacterLayer }) {
  return (
    <img
      data-pinoria-character-slot={layer.slot}
      src={layer.src}
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
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function WingHalf({
  side,
  src,
  animation,
}: {
  side: "left" | "right";
  src: string;
  animation?: string;
}) {
  const isLeft = side === "left";

  return (
    <div
      data-pinoria-wing-half={side}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: isLeft ? 0 : "50%",
        width: "50%",
        overflow: "hidden",
        transformOrigin: isLeft ? "100% 50%" : "0% 50%",
        animation,
        willChange: "transform, opacity, filter",
        pointerEvents: "none",
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        loading="eager"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: isLeft ? 0 : "-100%",
          width: "200%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </div>
  );
}

export function PrototypeCharacter({
  size = "100%",
  style,
  hiddenSlots = [],
  wingMotion = "idle",
  subjectId,
}: {
  size?: number | string;
  style?: CSSProperties;
  hiddenSlots?: PrototypeCharacterSlot[];
  wingMotion?: PrototypeWingMotion;
  subjectId?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [inferredSubjectId, setInferredSubjectId] = useState<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (subjectId) {
      setInferredSubjectId(undefined);
      return;
    }
    const host = rootRef.current?.closest<HTMLElement>("[data-ambient-runtime-character]");
    const next = host?.dataset.ambientRuntimeCharacter || undefined;
    setInferredSubjectId((current) => current === next ? current : next);
  }, [subjectId]);

  const resolvedSubjectId = subjectId ?? inferredSubjectId;
  const profile = prototypeCharacterProfileForSubject(resolvedSubjectId);
  const hidden = new Set(hiddenSlots);
  const layers = [...prototypeCharacterManifest.layers]
    .sort((a, b) => a.order - b.order)
    .map((baseLayer) => {
      const override = profile?.layers[baseLayer.slot];
      if (override === null) return null;
      return override ? { ...baseLayer, src: override } : baseLayer;
    })
    .filter(Boolean) as CharacterLayer[];
  const wingAnimation = wingMotion === "arrival"
    ? "pinoriaWingArrivalHinge 6.2s cubic-bezier(.22,.72,.2,1) both"
    : wingMotion === "idle"
      ? "pinoriaWingIdleHinge 4.2s ease-in-out infinite"
      : undefined;

  return (
    <div
      ref={rootRef}
      aria-label="Nhân vật Pinoria mẫu"
      data-pinoria-character-subject={resolvedSubjectId ?? "default"}
      data-pinoria-character-profile={profile?.id ?? "golden-slice-character-v1"}
      style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", flex: "0 0 auto", ...style }}
    >
      <style>{`
        @keyframes pinoriaWingIdleHinge {
          0%,100% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.02) drop-shadow(0 0 10px rgba(183,229,255,.12));
          }
          50% {
            transform: scaleX(.82);
            opacity: .97;
            filter: brightness(.985) drop-shadow(0 0 6px rgba(183,229,255,.08));
          }
        }
        @keyframes pinoriaWingArrivalHinge {
          0% {
            transform: scaleX(.60);
            opacity: .88;
            filter: brightness(.92) drop-shadow(0 0 4px rgba(183,229,255,.06));
          }
          20% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.09) drop-shadow(0 0 20px rgba(183,229,255,.24));
          }
          42% {
            transform: scaleX(.78);
            opacity: .96;
            filter: brightness(.98) drop-shadow(0 0 7px rgba(183,229,255,.1));
          }
          64% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.055) drop-shadow(0 0 15px rgba(183,229,255,.19));
          }
          82% {
            transform: scaleX(.86);
            opacity: .98;
            filter: brightness(.995) drop-shadow(0 0 8px rgba(183,229,255,.11));
          }
          100% {
            transform: scaleX(1);
            opacity: 1;
            filter: brightness(1.02) drop-shadow(0 0 10px rgba(183,229,255,.13));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-wing-half] { animation-duration: 12s !important; }
        }
      `}</style>

      {layers.filter((layer) => !hidden.has(layer.slot)).map((layer) => {
        if (layer.slot !== "back") {
          return <StandardLayer key={layer.slot} layer={layer} />;
        }

        return (
          <div key={layer.slot} data-pinoria-wing-layer="true" data-pinoria-character-slot="back" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <WingHalf side="left" src={layer.src} animation={wingAnimation} />
            <WingHalf side="right" src={layer.src} animation={wingAnimation} />
          </div>
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
