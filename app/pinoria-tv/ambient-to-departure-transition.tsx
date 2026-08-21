"use client";

import { useEffect, useRef, useState } from "react";
import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PinoriaStage } from "./pinoria-stage";
import { PrototypeCharacter } from "./prototype-assets";

export const AMBIENT_TO_DEPARTURE_MS = 6200;

export type FrozenAmbientActor = {
  id: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
};

type DepartureTransitionSubject = {
  id: string;
  name: string;
};

const ASSET_VERSION = "ambient-checkout-transition-v5";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function smoothstep(t: number) {
  const value = clamp01(t);
  return value * value * (3 - 2 * value);
}

function MiniReplica({ actor, subjectId }: { actor: FrozenAmbientActor; subjectId: string }) {
  return (
    <div
      data-checkout-frozen-mini
      style={{
        position: "absolute",
        left: `${actor.leftPct}%`,
        top: `${actor.topPct}%`,
        width: `${actor.widthPct}%`,
        aspectRatio: "1 / 1",
        pointerEvents: "none",
      }}
    >
      <div
        data-ambient-mini-character
        data-ambient-mini-body="on"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ["--ambient-mini-name" as string]: '""',
        }}
      >
        <PrototypeCharacter subjectId={subjectId} size="100%" wingMotion="off" />
      </div>
    </div>
  );
}

export function AmbientToDepartureTransition({
  subject,
  actors,
}: {
  subject: DepartureTransitionSubject;
  actors: FrozenAmbientActor[];
}) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const next = clamp01((now - startedAt) / AMBIENT_TO_DEPARTURE_MS);
      setProgress(next);
      if (next < 1) frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const checkout = actors.find((actor) => actor.id === subject.id)
    ?? actors[0]
    ?? {
      id: subject.id,
      leftPct: 40,
      topPct: 76,
      widthPct: 8.55,
      heightPct: 15.2,
    };

  // Keep the first beat completely still so the eye sees the same mini-character,
  // then make the growth unmistakable for most of the transition.
  const moveT = smoothstep((progress - 0.16) / 0.78);
  const leftPct = lerp(checkout.leftPct, DEPARTURE_HERO_TARGET.leftPct, moveT);
  const topPct = lerp(checkout.topPct, DEPARTURE_HERO_TARGET.topPct, moveT);
  const widthPct = lerp(checkout.widthPct, DEPARTURE_HERO_TARGET.widthPct, moveT);

  const dimOpacity = 0.72 * smoothstep((progress - 0.04) / 0.18);
  const miniOpacity = 1 - smoothstep((progress - 0.62) / 0.18);
  const fullOpacity = smoothstep((progress - 0.62) / 0.18);
  const labelIn = smoothstep((progress - 0.08) / 0.13);
  const labelOut = 1 - smoothstep((progress - 0.58) / 0.16);
  const labelOpacity = labelIn * labelOut;
  const lift = 1 + 0.08 * Math.sin(Math.PI * clamp01((progress - 0.12) / 0.32));

  return (
    <div
      data-ambient-to-departure
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0d140f", color: "#fff" }}
    >
      <PinoriaStage dataStage="checkout-transition" style={{ background: "#101711" }}>
        <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />
        <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 10, pointerEvents: "none" }} />

        {actors.filter((actor) => actor.id !== subject.id).map((actor) => (
          <div key={actor.id} style={{ position: "absolute", inset: 0, zIndex: 14, opacity: .62, filter: "brightness(.58) saturate(.72)" }}>
            <MiniReplica actor={actor} subjectId={actor.id} />
          </div>
        ))}

        <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 20, pointerEvents: "none" }} />

        {/* Intentional: checkout uses only a global dim. No circular spotlight. */}
        <div
          data-checkout-dim
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 24,
            background: "#040805",
            opacity: dimOpacity,
            pointerEvents: "none",
          }}
        />

        <div
          data-checkout-mover
          data-checkout-source={`${checkout.leftPct.toFixed(2)},${checkout.topPct.toFixed(2)},${checkout.widthPct.toFixed(2)}`}
          style={{
            position: "absolute",
            zIndex: 30,
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${widthPct}%`,
            aspectRatio: "1 / 1",
            transform: `scale(${lift})`,
            transformOrigin: "50% 50%",
            pointerEvents: "none",
            willChange: "left,top,width,transform",
          }}
        >
          <div data-checkout-moving-mini style={{ position: "absolute", inset: 0, opacity: miniOpacity }}>
            <div
              data-ambient-mini-character
              data-ambient-mini-body="on"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                ["--ambient-mini-name" as string]: '""',
              }}
            >
              <PrototypeCharacter subjectId={subject.id} size="100%" wingMotion="off" />
            </div>
          </div>
          <div data-checkout-moving-full style={{ position: "absolute", inset: 0, opacity: fullOpacity }}>
            <PrototypeCharacter
              subjectId={subject.id}
              size="100%"
              wingMotion="idle"
              style={{ filter: "drop-shadow(0 24px 28px rgba(0,0,0,.28))" }}
            />
          </div>
        </div>

        <div
          data-checkout-label
          style={{
            position: "absolute",
            zIndex: 34,
            left: "50%",
            top: "6.5%",
            width: "70%",
            transform: "translateX(-50%)",
            opacity: labelOpacity,
            textAlign: "center",
            textShadow: "0 5px 24px #000a",
            pointerEvents: "none",
          }}
        >
          <span style={{ display: "block", color: "#eed281", fontSize: 12, fontWeight: 900, letterSpacing: ".18em", marginBottom: 8 }}>
            NHÀ PINO TẠM DỪNG MỘT NHỊP ✦
          </span>
          <h1 style={{ margin: 0, color: "#fffaf0", fontSize: "clamp(38px,3.4vw,66px)", lineHeight: .98, letterSpacing: "-.045em" }}>
            {subject.name} chuẩn bị ra về
          </h1>
        </div>
      </PinoriaStage>
    </div>
  );
}
