"use client";

import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PrototypeCharacter } from "./prototype-assets";

export const AMBIENT_TO_DEPARTURE_MS = 4800;

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

const ASSET_VERSION = "ambient-checkout-transition-v2";
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

  return (
    <div
      data-ambient-to-departure
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#101711",
        color: "#fff",
        ["--checkout-x" as string]: `${checkoutCenterX}%`,
        ["--checkout-y" as string]: `${checkoutCenterY}%`,
      }}
    >
      <style>{`
        @keyframes pinoriaCheckoutDim {
          0%,10% { opacity:0; }
          26%,100% { opacity:1; }
        }
        @keyframes pinoriaCheckoutBeam {
          0%,10% { opacity:0; }
          24%,52% { opacity:1; }
          72%,100% { opacity:0; }
        }
        @keyframes pinoriaCheckoutActorLift {
          0%,30% {
            left:var(--actor-left);
            top:var(--actor-top);
            width:var(--actor-width);
            transform:scale(1);
            filter:brightness(1.02) drop-shadow(0 8px 12px rgba(0,0,0,.22));
          }
          43% {
            left:var(--actor-left);
            top:var(--actor-top);
            width:var(--actor-width);
            transform:scale(1.22);
            filter:brightness(1.34) drop-shadow(0 0 30px rgba(249,224,145,.42)) drop-shadow(0 14px 18px rgba(0,0,0,.24));
          }
          58% {
            left:var(--actor-left);
            top:var(--actor-top);
            width:var(--actor-width);
            transform:scale(1.12);
            filter:brightness(1.22) drop-shadow(0 0 22px rgba(249,224,145,.28)) drop-shadow(0 14px 18px rgba(0,0,0,.24));
          }
          100% {
            left:${DEPARTURE_HERO_TARGET.leftPct}%;
            top:${DEPARTURE_HERO_TARGET.topPct}%;
            width:${DEPARTURE_HERO_TARGET.widthPct}%;
            transform:scale(1);
            filter:brightness(1.04) drop-shadow(0 30px 32px rgba(0,0,0,.30));
          }
        }
        @keyframes pinoriaCheckoutLabel {
          0%,14% { opacity:0; transform:translate(-50%,10px); }
          28%,54% { opacity:1; transform:translate(-50%,0); }
          72%,100% { opacity:0; transform:translate(-50%,-8px); }
        }
        [data-checkout-dim] { animation:pinoriaCheckoutDim ${AMBIENT_TO_DEPARTURE_MS}ms ease-out both; }
        [data-checkout-beam] { animation:pinoriaCheckoutBeam ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        [data-checkout-hero] { animation:pinoriaCheckoutActorLift ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.18,.76,.14,1) both; }
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
            opacity: .54,
            filter: "brightness(.48) saturate(.68)",
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
          background: `radial-gradient(ellipse 13% 22% at ${checkoutCenterX}% ${checkoutCenterY}%, rgba(4,8,5,.04) 0%, rgba(4,8,5,.16) 31%, rgba(4,8,5,.60) 54%, rgba(4,8,5,.78) 100%)`,
          pointerEvents: "none",
        }}
      />

      <div
        data-checkout-beam
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 25,
          left: `${checkoutCenterX}%`,
          top: `${checkoutCenterY}%`,
          width: "min(360px,28vw)",
          height: "min(450px,58vh)",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center,rgba(255,249,220,.50) 0,rgba(245,226,161,.24) 28%,rgba(236,216,152,.08) 52%,transparent 72%)",
          boxShadow: "0 0 76px rgba(248,225,151,.20)",
          pointerEvents: "none",
        }}
      />

      <div
        data-checkout-hero
        data-checkout-source={`${checkout.leftPct.toFixed(2)},${checkout.topPct.toFixed(2)},${checkout.widthPct.toFixed(2)},${checkout.heightPct.toFixed(2)}`}
        style={{
          position: "absolute",
          zIndex: 30,
          left: `${checkout.leftPct}%`,
          top: `${checkout.topPct}%`,
          width: `${checkout.widthPct}%`,
          height: `${checkout.heightPct}%`,
          minWidth: 62,
          ["--actor-left" as string]: `${checkout.leftPct}%`,
          ["--actor-top" as string]: `${checkout.topPct}%`,
          ["--actor-width" as string]: `${checkout.widthPct}%`,
          transformOrigin: "50% 50%",
          pointerEvents: "none",
          willChange: "left,top,width,transform,filter",
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
          top: "8%",
          textAlign: "center",
          width: "min(760px,76vw)",
          textShadow: "0 5px 24px #000a",
          pointerEvents: "none",
        }}
      >
        <span style={{ display: "block", color: "#eed281", fontSize: 10, fontWeight: 900, letterSpacing: ".18em", marginBottom: 8 }}>NHÀ PINO TẠM DỪNG MỘT NHỊP ✦</span>
        <h1 style={{ margin: 0, color: "#fffaf0", fontSize: "clamp(34px,4vw,58px)", lineHeight: .98, letterSpacing: "-.045em" }}>{subject.name} chuẩn bị ra về</h1>
      </div>
    </div>
  );
}
