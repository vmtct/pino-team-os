"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  prototypeCharacterProfileAssetUrls,
  prototypeCharacterProfileForSubject,
} from "./prototype-character-profiles";

export type PrototypeCharacterSlot = "back" | "body" | "hair" | "face" | "headwear" | "eyewear";
export type PrototypeCharacterMotion = "off" | "idle" | "walk" | "arrival" | "celebrate" | "shop-preview";
/** Compatibility shim for older surfaces. New code should use `motion`. */
export type PrototypeWingMotion = "off" | "idle" | "arrival";
export type PrototypeCharacterLayerOverrides = Partial<Record<PrototypeCharacterSlot, string | null>>;

type CharacterLayer = {
  slot: PrototypeCharacterSlot;
  displayName: string;
  src: string;
  order: number;
  fallbackSrc?: string;
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

export const prototypeCharacterEffects = {
  canvas: { width: 2048, height: 2048 },
  aura: {
    id: "aura-lv3",
    src: "https://assets.pinohouse.art/draft/AuraLv3.png",
  },
  glows: [
    { id: "violet-1", src: "https://assets.pinohouse.art/draft/glowViolet1.png", mirrored: false },
    { id: "violet-2", src: "https://assets.pinohouse.art/draft/glowViolet2.png", mirrored: false },
    { id: "violet-1-mirror", src: "https://assets.pinohouse.art/draft/glowViolet1.png", mirrored: true },
    { id: "violet-2-mirror", src: "https://assets.pinohouse.art/draft/glowViolet2.png", mirrored: true },
  ],
  marks: [
    { id: "mark-02", src: "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(2).png" },
    { id: "mark-03", src: "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(3).png" },
    { id: "mark-04", src: "https://assets.pinohouse.art/draft/Mark/Char%20Base%20(4).png" },
  ],
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
  prototypeCharacterEffects.aura.src,
  ...prototypeCharacterEffects.glows.map((glow) => glow.src),
  ...prototypeCharacterEffects.marks.map((mark) => mark.src),
  ...prototypeFloatingProps.map((prop) => prop.src),
];

function StandardLayer({ layer }: { layer: CharacterLayer }) {
  const [src, setSrc] = useState(layer.src);

  useEffect(() => {
    setSrc(layer.src);
  }, [layer.src]);

  return (
    <img
      data-pinoria-character-slot={layer.slot}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading="eager"
      onError={() => {
        if (layer.fallbackSrc && src !== layer.fallbackSrc) setSrc(layer.fallbackSrc);
      }}
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
  src: requestedSrc,
  fallbackSrc,
  animation,
}: {
  side: "left" | "right";
  src: string;
  fallbackSrc?: string;
  animation?: string;
}) {
  const isLeft = side === "left";
  const [src, setSrc] = useState(requestedSrc);

  useEffect(() => {
    setSrc(requestedSrc);
  }, [requestedSrc]);

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
        onError={() => {
          if (fallbackSrc && src !== fallbackSrc) setSrc(fallbackSrc);
        }}
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

function bodyAnimationFor(motion: PrototypeCharacterMotion) {
  if (motion === "idle") return "pinoriaCharacterIdle 7.2s cubic-bezier(.45,.05,.55,.95) infinite";
  if (motion === "walk") return "pinoriaCharacterWalk .62s ease-in-out infinite";
  if (motion === "arrival") return "pinoriaCharacterArrivalSettle 6.2s cubic-bezier(.22,.72,.2,1) both";
  if (motion === "celebrate") return "pinoriaCharacterCelebrate 2.1s cubic-bezier(.2,.82,.2,1) both";
  if (motion === "shop-preview") return "pinoriaCharacterShopPreview 6.4s cubic-bezier(.45,.05,.55,.95) infinite";
  return undefined;
}

function wingAnimationFor(motion: PrototypeCharacterMotion) {
  if (motion === "arrival") return "pinoriaWingArrivalHinge 6.2s cubic-bezier(.22,.72,.2,1) both";
  if (motion === "celebrate") return "pinoriaWingCelebrateHinge 2.1s cubic-bezier(.2,.82,.2,1) both";
  if (motion === "idle" || motion === "shop-preview") return "pinoriaWingIdleHinge 4.2s ease-in-out infinite";
  return undefined;
}

export function PrototypeCharacter({
  size = "100%",
  style,
  hiddenSlots = [],
  motion,
  wingMotion,
  subjectId,
  layerOverrides,
}: {
  size?: number | string;
  style?: CSSProperties;
  hiddenSlots?: PrototypeCharacterSlot[];
  motion?: PrototypeCharacterMotion;
  /** Compatibility shim. Prefer `motion`. */
  wingMotion?: PrototypeWingMotion;
  subjectId?: string;
  layerOverrides?: PrototypeCharacterLayerOverrides;
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
  const resolvedMotion: PrototypeCharacterMotion = motion ?? wingMotion ?? "idle";
  const layers = [...prototypeCharacterManifest.layers]
    .sort((a, b) => a.order - b.order)
    .map((baseLayer): CharacterLayer | null => {
      const profileOverride = profile?.layers[baseLayer.slot];
      const profileSrc = profileOverride === null ? null : profileOverride || baseLayer.src;
      const surfaceOverride = layerOverrides?.[baseLayer.slot];
      if (surfaceOverride === null) return null;

      const src = typeof surfaceOverride === "string" ? surfaceOverride : profileSrc;
      if (!src) return null;

      const fallbackSrc = typeof surfaceOverride === "string"
        ? profileSrc ?? baseLayer.src
        : profileOverride && profileOverride !== baseLayer.src
          ? baseLayer.src
          : undefined;

      return { ...baseLayer, src, fallbackSrc };
    })
    .filter((layer): layer is CharacterLayer => !!layer);
  const bodyAnimation = bodyAnimationFor(resolvedMotion);
  const wingAnimation = wingAnimationFor(resolvedMotion);

  return (
    <div
      ref={rootRef}
      aria-label="Nhân vật Pinoria mẫu"
      data-pinoria-character-subject={resolvedSubjectId ?? "default"}
      data-pinoria-character-profile={profile?.id ?? "golden-slice-character-v1"}
      data-pinoria-character-motion={resolvedMotion}
      style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", flex: "0 0 auto", ...style }}
    >
      <style>{`
        @keyframes pinoriaCharacterIdle {
          0%,100% { transform:translate3d(0,0,0) rotate(-.05deg) scale(1); }
          48% { transform:translate3d(0,-2.4px,0) rotate(.06deg) scale(1.001,1.004); }
          72% { transform:translate3d(0,-.8px,0) rotate(-.02deg) scale(1.0005,1.0015); }
        }
        @keyframes pinoriaCharacterShopPreview {
          0%,100% { transform:translate3d(0,0,0) rotate(-.08deg) scale(1); }
          24% { transform:translate3d(0,-1.5px,0) rotate(.04deg) scale(1.001,1.003); }
          50% { transform:translate3d(0,-4px,0) rotate(.12deg) scale(1.003,1.007); }
          76% { transform:translate3d(0,-1.25px,0) rotate(-.03deg) scale(1.001,1.002); }
        }
        @keyframes pinoriaCharacterWalk {
          0%,100% { transform:translate3d(0,0,0) rotate(-.35deg) scale(1); }
          50% { transform:translate3d(0,-3px,0) rotate(.35deg) scale(1.004,.996); }
        }
        @keyframes pinoriaCharacterArrivalSettle {
          0%,16% { transform:translate3d(0,0,0) scale(.995); }
          28% { transform:translate3d(0,-3px,0) scale(1.008); }
          47% { transform:translate3d(0,-.5px,0) scale(.999); }
          68% { transform:translate3d(0,-1.5px,0) scale(1.003); }
          100% { transform:translate3d(0,0,0) scale(1); }
        }
        @keyframes pinoriaCharacterCelebrate {
          0% { transform:translate3d(0,0,0) scale(1); }
          18% { transform:translate3d(0,-12px,0) rotate(-1deg) scale(1.025); }
          38% { transform:translate3d(0,1px,0) rotate(.7deg) scale(.995,1.01); }
          58% { transform:translate3d(0,-6px,0) rotate(-.35deg) scale(1.012); }
          78% { transform:translate3d(0,0,0) rotate(.15deg) scale(1.002); }
          100% { transform:translate3d(0,0,0) scale(1); }
        }
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
        @keyframes pinoriaWingCelebrateHinge {
          0%,100% { transform:scaleX(1); filter:brightness(1.02); }
          18% { transform:scaleX(.66); filter:brightness(1.12) drop-shadow(0 0 20px rgba(183,229,255,.24)); }
          38% { transform:scaleX(1); filter:brightness(1.07) drop-shadow(0 0 14px rgba(183,229,255,.18)); }
          58% { transform:scaleX(.76); filter:brightness(1.1) drop-shadow(0 0 17px rgba(183,229,255,.21)); }
          78% { transform:scaleX(.94); filter:brightness(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-character-motion] > [data-pinoria-character-motion-shell],
          [data-pinoria-character-motion] [data-pinoria-wing-half] {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div
        data-pinoria-character-motion-shell
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "50% 78%",
          animation: bodyAnimation,
          willChange: bodyAnimation ? "transform" : undefined,
          pointerEvents: "none",
        }}
      >
        {layers.filter((layer) => !hidden.has(layer.slot)).map((layer) => {
          if (layer.slot !== "back") {
            return <StandardLayer key={layer.slot} layer={layer} />;
          }

          return (
            <div key={layer.slot} data-pinoria-wing-layer="true" data-pinoria-character-slot="back" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <WingHalf side="left" src={layer.src} fallbackSrc={layer.fallbackSrc} animation={wingAnimation} />
              <WingHalf side="right" src={layer.src} fallbackSrc={layer.fallbackSrc} animation={wingAnimation} />
            </div>
          );
        })}
      </div>
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
