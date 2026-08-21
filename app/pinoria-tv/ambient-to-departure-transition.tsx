"use client";

import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PrototypeCharacter } from "./prototype-assets";

export const AMBIENT_TO_DEPARTURE_MS = 5200;

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

const ASSET_VERSION = "ambient-checkout-transition-v3";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

export function AmbientToDepartureTransition({
  subject,
  actors,
}: {
  subject: DepartureTransitionSubject;
  actors: FrozenAmbientActor[];
}) {
  const checkout = actors.find((actor) => actor.id === subject.id)
    ?? actors[0]
    ?? {
      id: subject.id,
      leftPct: 40,
      topPct: 76,
      widthPct: 8.55,
      heightPct: 15.2,
    };

  const checkoutCenterX = checkout.leftPct + checkout.widthPct / 2;
  const checkoutCenterY = checkout.topPct + checkout.heightPct / 2;
  const sourceDx = checkout.leftPct - DEPARTURE_HERO_TARGET.leftPct;
  const sourceDy = checkout.topPct - DEPARTURE_HERO_TARGET.topPct;
  const sourceScale = Math.max(.08, checkout.widthPct / DEPARTURE_HERO_TARGET.widthPct);
  const pulseScale = sourceScale * 1.24;
  const settleScale = sourceScale * 1.08;

  return (
    <div
      data-ambient-to-departure
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#101711",
        color: "#fff",
        ["--source-dx" as string]: `${sourceDx}vw`,
        ["--source-dy" as string]: `${sourceDy}vh`,
        ["--source-scale" as string]: sourceScale,
        ["--pulse-scale" as string]: pulseScale,
        ["--settle-scale" as string]: settleScale,
      }}
    >
      <style>{`
        @keyframes pinoriaCheckoutDim {
          0%,8% { opacity:0; }
          24%,100% { opacity:1; }
        }
        @keyframes pinoriaCheckoutSpotlight {
          0%,9% { opacity:0; transform:translate(-50%,-50%) scale(.76); }
          24%,55% { opacity:1; transform:translate(-50%,-50%) scale(1); }
          73%,100% { opacity:0; transform:translate(-50%,-50%) scale(1.24); }
        }
        @keyframes pinoriaCheckoutActorFlip {
          0%,28% {
            transform:translate3d(var(--source-dx),var(--source-dy),0) scale(var(--source-scale));
            filter:brightness(1.03) drop-shadow(0 8px 12px rgba(0,0,0,.22));
          }
          42% {
            transform:translate3d(var(--source-dx),var(--source-dy),0) scale(var(--pulse-scale));
            filter:brightness(1.36) drop-shadow(0 0 32px rgba(249,224,145,.46)) drop-shadow(0 14px 18px rgba(0,0,0,.25));
          }
          56% {
            transform:translate3d(var(--source-dx),var(--source-dy),0) scale(var(--settle-scale));
            filter:brightness(1.20) drop-shadow(0 0 22px rgba(249,224,145,.30)) drop-shadow(0 14px 18px rgba(0,0,0,.24));
          }
          100% {
            transform:translate3d(0,0,0) scale(1);
            filter:brightness(1.04) drop-shadow(0 30px 32px rgba(0,0,0,.30));
          }
        }
        @keyframes pinoriaCheckoutLabel {
          0%,12% { opacity:0; transform:translate(-50%,10px); }
          27%,55% { opacity:1; transform:translate(-50%,0); }
          72%,100% { opacity:0; transform:translate(-50%,-8px); }
        }
        [data-checkout-dim] { animation:pinoriaCheckoutDim ${AMBIENT_TO_DEPARTURE_MS}ms ease-out both; }
        [data-checkout-spotlight] { animation:pinoriaCheckoutSpotlight ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        [data-checkout-hero] { animation:pinoriaCheckoutActorFlip ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.16,.76,.12,1) both; }
        [data-checkout-label] { animation:pinoriaCheckoutLabel ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion:reduce) {
          [data-checkout-hero] { animation-timing-function:linear!important; }
        }
      `}</style>

      <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} />
      <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 10, pointerEvents: "none" }} />

      {actors.filter((actor) => actor.id !== subject.id).map((actor) => (
        <div
          key={actor.id}
          style={{
            position: "absolute",
            zIndex: 16,
            left: `${actor.leftPct}%`,
            top: `${actor.topPct}%`,
            width: `${actor.widthPct}%`,
            height: `${actor.heightPct}%`,
            opacity: .52,
            filter: "brightness(.46) saturate(.66)",
            pointerEvents: "none",
          }}
        >
          <PrototypeCharacter subjectId={actor.id} size="100%" wingMotion="off" />
        </div>
      ))}

      <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 20, pointerEvents: "none" }} />

      <div
        data-checkout-dim
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 24,
          background: "rgba(4,8,5,.70)",
          pointerEvents: "none",
        }}
      />

      <div
        data-checkout-spotlight
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 25,
          left: `${checkoutCenterX}%`,
          top: `${checkoutCenterY}%`,
          width: "min(340px,25vw)",
          aspectRatio: "1 / 1",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,250,222,.62) 0,rgba(247,229,166,.30) 30%,rgba(238,218,155,.10) 54%,transparent 73%)",
          boxShadow: "0 0 82px rgba(248,225,151,.22)",
          pointerEvents: "none",
        }}
      />

      <div
        data-checkout-hero
        data-checkout-source={`${checkout.leftPct.toFixed(2)},${checkout.topPct.toFixed(2)},${checkout.widthPct.toFixed(2)},${checkout.heightPct.toFixed(2)}`}
        style={{
          position: "absolute",
          zIndex: 30,
          left: `${DEPARTURE_HERO_TARGET.leftPct}%`,
          top: `${DEPARTURE_HERO_TARGET.topPct}%`,
          width: `${DEPARTURE_HERO_TARGET.widthPct}%`,
          aspectRatio: "1 / 1",
          transformOrigin: "0 0",
          pointerEvents: "none",
          willChange: "transform,filter",
        }}
      >
        <PrototypeCharacter subjectId={subject.id} size="100%" wingMotion="idle" />
      </div>

      <div
        data-checkout-label
        style={{
          position: "absolute",
          zIndex: 34,
          left: "50%",
          top: "7.5%",
          textAlign: "center",
          width: "min(760px,76vw)",
          textShadow: "0 5px 24px #000a",
          pointerEvents: "none",
        }}
      >
        <span style={{ display: "block", color: "#eed281", fontSize: 10, fontWeight: 900, letterSpacing: ".18em", marginBottom: 7 }}>NHÀ PINO TẠM DỪNG MỘT NHỊP ✦</span>
        <h1 style={{ margin: 0, color: "#fffaf0", fontSize: "clamp(34px,4vw,58px)", lineHeight: .98, letterSpacing: "-.045em" }}>{subject.name} chuẩn bị ra về</h1>
      </div>
    </div>
  );
}
