"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  prototypeCharacterProfileAssetUrls,
  prototypeCharacterProfileForSubject,
} from "./prototype-character-profiles";
import { companionVisualRegistry, resolveCompanionVisual } from "./companion-visual-registry";

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

const prototypeCompanionDefaultVisual = companionVisualRegistry["ploo-form-2"];

export const prototypeCompanionManifest = {
  id: prototypeCompanionDefaultVisual.id,
  displayName: "Hộ Linh",
  canvas: prototypeCompanionDefaultVisual.canvas,
  src: prototypeCompanionDefaultVisual.src,
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
  ...Array.from(new Set(Object.values(companionVisualRegistry).map((visual) => visual.src))),
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

function effectMotionEnabled(motion: PrototypeCharacterMotion) {
  return motion === "arrival" || motion === "shop-preview" || motion === "celebrate";
}

function orbitPeriodFor(motion: PrototypeCharacterMotion) {
  if (motion === "celebrate") return 7200;
  if (motion === "arrival") return 10800;
  return 12600;
}

function OrbitingCharacterMarks({ motion, markIds }: { motion: PrototypeCharacterMotion; markIds?: readonly string[] }) {
  const marks = useMemo(() => markIds ? prototypeCharacterEffects.marks.filter((mark) => markIds.includes(mark.id)) : prototypeCharacterEffects.marks, [markIds]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const markRefs = useRef<Array<HTMLImageElement | null>>([]);

  useEffect(() => {
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const periodMs = orbitPeriodFor(motion);

    const renderFrame = (now: number) => {
      const stage = stageRef.current;
      if (!stage) return;

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) {
        frame = window.requestAnimationFrame(renderFrame);
        return;
      }

      const markSize = Math.min(94, width * .19);
      const centerX = width * .5;
      const centerY = height * .64;
      const radiusX = Math.min(210, width * .40);
      const radiusY = Math.min(76, height * .145);
      const baseAngle = reducedMotion ? 0 : ((now % periodMs) / periodMs) * Math.PI * 2;

      marks.forEach((_, index) => {
        const element = markRefs.current[index];
        if (!element) return;

        const angle = baseAngle + index * (Math.PI * 2 / 3);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const depth = (sin + 1) / 2;
        const frontHalf = sin >= 0;
        const x = centerX + radiusX * cos - markSize / 2;
        const y = centerY + radiusY * sin - markSize / 2;
        const scale = .88 + depth * .15;
        const opacity = .66 + depth * .34;
        const blur = (1 - depth) * .75;
        const tilt = Math.sin(angle * 1.7 + index) * 4;

        element.style.width = `${markSize}px`;
        element.style.height = `${markSize}px`;
        element.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale}) rotate(${tilt}deg)`;
        element.style.opacity = `${opacity}`;
        element.style.zIndex = frontHalf ? "16" : "6";
        element.style.filter = `brightness(${.91 + depth * .16}) saturate(${.94 + depth * .12}) blur(${blur}px) drop-shadow(0 9px 14px rgba(0,0,0,${.10 + depth * .09}))`;
        element.dataset.pinoriaCharacterOrbitDepth = frontHalf ? "front" : "behind";
      });

      if (!reducedMotion) frame = window.requestAnimationFrame(renderFrame);
    };

    frame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frame);
  }, [motion, marks]);

  return (
    <div ref={stageRef} data-pinoria-character-effect="marks" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {marks.map((mark, index) => (
        <img
          key={mark.id}
          ref={(element) => { markRefs.current[index] = element; }}
          data-pinoria-character-orbit-mark={mark.id}
          data-pinoria-character-orbit-depth="behind"
          src={mark.src}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 94,
            height: 94,
            objectFit: "contain",
            opacity: 0,
            pointerEvents: "none",
            transformOrigin: "50% 50%",
            willChange: "transform, opacity, filter",
          }}
        />
      ))}
    </div>
  );
}

function CharacterPrestigeEffects({ motion, markIds }: { motion: PrototypeCharacterMotion; markIds?: readonly string[] }) {
  const auraBreathDuration = motion === "arrival" ? "4.8s" : "5.8s";
  const radianceDuration = motion === "arrival" ? "7.6s" : "8.4s";
  const glowDuration = motion === "arrival" ? 6.4 : 7.2;
  const glowStep = glowDuration / 4;

  return (
    <>
      <div
        data-pinoria-character-effect="aura"
        style={{
          position: "absolute",
          inset: "1%",
          zIndex: 0,
          pointerEvents: "none",
          filter: "drop-shadow(0 0 34px rgba(182,111,255,.14))",
        }}
      >
        <img
          data-pinoria-canonical-aura="true"
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
            animation: `pinoriaPrestigeAuraBreath ${auraBreathDuration} ease-in-out infinite, pinoriaPrestigeAuraRadiance ${radianceDuration} ease-in-out infinite`,
            willChange: "transform, opacity, filter",
          }}
        />
      </div>

      <OrbitingCharacterMarks motion={motion} markIds={markIds} />

      <div data-pinoria-character-effect="glows" style={{ position: "absolute", inset: "4%", zIndex: 20, pointerEvents: "none" }}>
        {prototypeCharacterEffects.glows.map((glow, index) => (
          <img
            key={glow.id}
            data-pinoria-canonical-glow="true"
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
              animation: `pinoriaPrestigeGlowCycle ${glowDuration}s ${index * glowStep}s linear infinite`,
              willChange: "opacity, filter",
            }}
          />
        ))}
      </div>
    </>
  );
}

export function PrototypeCharacter({
  size = "100%",
  style,
  hiddenSlots = [],
  motion,
  wingMotion,
  subjectId,
  layerOverrides,
  prestigeMarkIds,
}: {
  size?: number | string;
  style?: CSSProperties;
  hiddenSlots?: PrototypeCharacterSlot[];
  motion?: PrototypeCharacterMotion;
  /** Compatibility shim. Prefer `motion`. */
  wingMotion?: PrototypeWingMotion;
  subjectId?: string;
  layerOverrides?: PrototypeCharacterLayerOverrides;
  prestigeMarkIds?: readonly string[];
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
  const showPrestigeEffects = effectMotionEnabled(resolvedMotion);

  return (
    <div
      ref={rootRef}
      aria-label="Nhân vật Pinoria mẫu"
      data-pinoria-character-subject={resolvedSubjectId ?? "default"}
      data-pinoria-character-profile={profile?.id ?? "golden-slice-character-v1"}
      data-pinoria-character-motion={resolvedMotion}
      style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", overflow: "hidden", flex: "0 0 auto", ...style }}
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
        @keyframes pinoriaPrestigeAuraBreath {
          0%,100% { transform:scale(.985); }
          36% { transform:scale(1.012); }
          58% { transform:scale(1.02); }
          82% { transform:scale(.994); }
        }
        @keyframes pinoriaPrestigeAuraRadiance {
          0%,14%,100% { opacity:.72; filter:brightness(.98) drop-shadow(0 0 10px rgba(182,111,255,.14)); }
          27% { opacity:.91; filter:brightness(1.075) drop-shadow(0 0 25px rgba(182,111,255,.29)); }
          43% { opacity:.77; filter:brightness(1.005) drop-shadow(0 0 13px rgba(182,111,255,.18)); }
          66% { opacity:.97; filter:brightness(1.11) drop-shadow(0 0 32px rgba(182,111,255,.35)); }
          83% { opacity:.80; filter:brightness(1.02) drop-shadow(0 0 16px rgba(182,111,255,.2)); }
        }
        @keyframes pinoriaPrestigeGlowCycle {
          0% { opacity:0; filter:brightness(.96) saturate(.98); }
          6.25% { opacity:.62; filter:brightness(1.08) saturate(1.06); }
          25% { opacity:.62; filter:brightness(1.08) saturate(1.06); }
          31.25% { opacity:0; filter:brightness(.98) saturate(1); }
          100% { opacity:0; filter:brightness(.98) saturate(1); }
        }

        /* Arrival still owns legacy effect markup. Hide those copies once the
           canonical character renderer is present. */
        [data-pinoria-arrival-background] [data-pinoria-full-character-aura],
        [data-pinoria-arrival-background] [data-pinoria-full-character-glow],
        [data-pinoria-arrival-background] [data-pinoria-orbit-mark] {
          display:none !important;
        }

        /* Shop still has pre-canonical aura/glow markup in its preview wrapper.
           Explicitly keep only canonical effect images to avoid double render. */
        [data-pinoria-shop-scene] img[src*="AuraLv3.png"]:not([data-pinoria-canonical-aura]),
        [data-pinoria-shop-scene] img[src*="glowViolet"]:not([data-pinoria-canonical-glow]) {
          display:none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          [data-pinoria-character-motion] > [data-pinoria-character-motion-shell],
          [data-pinoria-character-motion] [data-pinoria-wing-half],
          [data-pinoria-character-effect="aura"] img,
          [data-pinoria-character-effect="glows"] img {
            animation: none !important;
            transform: none !important;
          }
          [data-pinoria-character-effect="aura"] img { opacity:.84 !important; }
          [data-pinoria-character-effect="glows"] img { opacity:.12 !important; }
        }
      `}</style>

      {showPrestigeEffects ? <CharacterPrestigeEffects motion={resolvedMotion} markIds={prestigeMarkIds} /> : null}

      <div
        data-pinoria-character-motion-shell
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
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

export function PrototypeCompanion({
  size = "100%",
  style,
  displayName = prototypeCompanionManifest.displayName,
  visualId = prototypeCompanionManifest.id,
}: {
  size?: number | string;
  style?: CSSProperties;
  displayName?: string;
  visualId?: string;
}) {
  const visual = resolveCompanionVisual(visualId);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [visual.definition.mediaType, visual.definition.src]);

  const mediaStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "50% 50%",
    pointerEvents: "none",
    userSelect: "none",
    transform: `translateY(${visual.definition.translateYPercent}%) scale(${visual.definition.scale})`,
    transformOrigin: "50% 70%",
    filter: visual.definition.filter,
  };
  const renderVideo = visual.definition.mediaType === "video" && !videoFailed;
  const imageSrc = videoFailed && visual.definition.fallbackSrc
    ? visual.definition.fallbackSrc
    : visual.definition.src;

  return (
    <div
      aria-label={displayName}
      data-pinoria-companion={displayName}
      data-pinoria-companion-visual={visual.requestedVisualId}
      data-pinoria-companion-visual-resolved={visual.resolvedVisualId}
      data-pinoria-companion-visual-fallback={visual.usedFallback ? "true" : "false"}
      data-pinoria-companion-asset={visual.definition.src}
      data-pinoria-companion-media={renderVideo ? "video" : "image"}
      style={{ position: "relative", width: size, maxWidth: "100%", aspectRatio: "1 / 1", overflow: "hidden", flex: "0 0 auto", ...style }}
    >
      {renderVideo ? (
        <video
          src={visual.definition.src}
          aria-hidden="true"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={visual.definition.fallbackSrc}
          disablePictureInPicture
          onError={() => setVideoFailed(true)}
          style={mediaStyle}
        />
      ) : (
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
          style={mediaStyle}
        />
      )}
    </div>
  );
}
