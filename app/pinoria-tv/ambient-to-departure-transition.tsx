"use client";

import { PrototypeCharacter } from "./prototype-assets";

export const AMBIENT_TO_DEPARTURE_MS = 3600;

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

const ASSET_VERSION = "ambient-checkout-transition-v1";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

const TARGET_LEFT = 62;
const TARGET_TOP = 21;
const TARGET_WIDTH = 27.1;

export function AmbientToDepartureTransition({
  subject,
  actors,
}: {
  subject: DepartureTransitionSubject;
  actors: FrozenAmbientActor[];
}) {
  const checkout = actors.find((actor) => actor.id === subject.id) ?? {
    id: subject.id,
    leftPct: 46,
    topPct: 72,
    widthPct: 8.55,
    heightPct: 10.65,
  };
  const checkoutCenterX = checkout.leftPct + checkout.widthPct / 2;
  const checkoutCenterY = checkout.topPct + checkout.heightPct / 2;

  return (
    <div data-ambient-to-departure style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#101711", color: "#fff" }}>
      <style>{`
        @keyframes pinoriaCheckoutDim {
          0% { opacity:0; }
          24%,100% { opacity:1; }
        }
        @keyframes pinoriaCheckoutSpotlight {
          0%,8% { opacity:0; transform:translate(-50%,-50%) scale(.72); }
          24%,48% { opacity:1; transform:translate(-50%,-50%) scale(1); }
          72%,100% { opacity:0; transform:translate(-50%,-50%) scale(1.18); }
        }
        @keyframes pinoriaCheckoutActorLift {
          0%,34% {
            left:var(--actor-left);
            top:var(--actor-top);
            width:var(--actor-width);
            filter:brightness(1) drop-shadow(0 8px 12px rgba(0,0,0,.22));
          }
          48% {
            left:var(--actor-left);
            top:var(--actor-top);
            width:calc(var(--actor-width) * 1.18);
            filter:brightness(1.28) drop-shadow(0 0 24px rgba(249,224,145,.32)) drop-shadow(0 14px 18px rgba(0,0,0,.24));
          }
          100% {
            left:${TARGET_LEFT}%;
            top:${TARGET_TOP}%;
            width:${TARGET_WIDTH}%;
            filter:brightness(1.04) drop-shadow(0 28px 30px rgba(0,0,0,.30));
          }
        }
        @keyframes pinoriaCheckoutLabel {
          0%,18% { opacity:0; transform:translateY(10px); }
          34%,62% { opacity:1; transform:translateY(0); }
          82%,100% { opacity:0; transform:translateY(-6px); }
        }
        [data-checkout-dim] { animation:pinoriaCheckoutDim ${AMBIENT_TO_DEPARTURE_MS}ms ease-out both; }
        [data-checkout-spotlight] { animation:pinoriaCheckoutSpotlight ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        [data-checkout-hero] { animation:pinoriaCheckoutActorLift ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.75,.16,1) both; }
        [data-checkout-label] { animation:pinoriaCheckoutLabel ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion:reduce) {
          [data-checkout-hero] { animation-timing-function:linear!important; }
        }
      `}</style>

      <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} />
      <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 10, pointerEvents: "none" }} />

      {actors.filter((actor) => actor.id !== subject.id).map((actor) => (
        <div key={actor.id} style={{ position: "absolute", zIndex: 16, left: `${actor.leftPct}%`, top: `${actor.topPct}%`, width: `${actor.widthPct}%`, aspectRatio: "164 / 115", opacity: .58, filter: "brightness(.58) saturate(.72)", pointerEvents: "none" }}>
          <PrototypeCharacter subjectId={actor.id} size="100%" wingMotion="off" />
        </div>
      ))}

      <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 20, pointerEvents: "none" }} />

      <div data-checkout-dim style={{ position: "absolute", inset: 0, zIndex: 24, background: "rgba(5,9,6,.62)", pointerEvents: "none" }} />
      <div
        data-checkout-spotlight
        style={{
          position: "absolute",
          zIndex: 25,
          left: `${checkoutCenterX}%`,
          top: `${checkoutCenterY}%`,
          width: "min(430px,31vw)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,247,205,.66) 0,rgba(238,216,142,.26) 24%,rgba(225,207,149,.08) 48%,transparent 72%)",
          boxShadow: "0 0 70px rgba(248,225,151,.24)",
          pointerEvents: "none",
        }}
      />

      <div
        data-checkout-hero
        style={{
          position: "absolute",
          zIndex: 30,
          left: `${checkout.leftPct}%`,
          top: `${checkout.topPct}%`,
          width: `${checkout.widthPct}%`,
          minWidth: 82,
          aspectRatio: "1 / 1",
          ["--actor-left" as string]: `${checkout.leftPct}%`,
          ["--actor-top" as string]: `${checkout.topPct}%`,
          ["--actor-width" as string]: `${checkout.widthPct}%`,
          transformOrigin: "50% 50%",
          pointerEvents: "none",
          willChange: "left,top,width,filter",
        }}
      >
        <PrototypeCharacter subjectId={subject.id} size="100%" wingMotion="idle" />
      </div>

      <div data-checkout-label style={{ position: "absolute", zIndex: 34, left: "50%", top: "10%", transform: "translateX(-50%)", textAlign: "center", width: "min(760px,76vw)", textShadow: "0 5px 24px #000a", pointerEvents: "none" }}>
        <span style={{ display: "block", color: "#eed281", fontSize: 10, fontWeight: 900, letterSpacing: ".18em", marginBottom: 8 }}>NHÀ PINO TẠM DỪNG MỘT NHỊP ✦</span>
        <h1 style={{ margin: 0, color: "#fffaf0", fontSize: "clamp(34px,4vw,58px)", lineHeight: .98, letterSpacing: "-.045em" }}>{subject.name} chuẩn bị ra về</h1>
      </div>
    </div>
  );
}
