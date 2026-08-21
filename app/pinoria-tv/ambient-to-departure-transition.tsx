"use client";

import { DEPARTURE_HERO_TARGET } from "./departure-layout";
import { PinoriaStage } from "./pinoria-stage";
import { PrototypeCharacter } from "./prototype-assets";

export const AMBIENT_TO_DEPARTURE_MS = 5600;

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

const ASSET_VERSION = "ambient-checkout-transition-v4";
const ASSETS = {
  back: `/api/pinoria-prototype/ambient-house-asset?layer=back&v=${ASSET_VERSION}`,
  mid: `/api/pinoria-prototype/ambient-house-asset?layer=mid&v=${ASSET_VERSION}`,
  front: `/api/pinoria-prototype/ambient-house-asset?layer=front&v=${ASSET_VERSION}`,
};

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
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
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
  const checkoutCenterY = checkout.topPct + checkout.widthPct / 2;

  return (
    <div
      data-ambient-to-departure
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0d140f", color: "#fff" }}
    >
      <style>{`
        [data-ambient-to-departure] [data-checkout-frozen-mini] [data-ambient-mini-character]::before,
        [data-ambient-to-departure] [data-checkout-moving-mini] [data-ambient-mini-character]::before {
          display:none!important;
        }

        @keyframes pinoriaCheckoutDim {
          0%,8% { opacity:0; }
          25%,100% { opacity:1; }
        }
        @keyframes pinoriaCheckoutSpotlight {
          0%,8% { opacity:0; transform:translate(-50%,-50%) scale(.72); }
          24%,48% { opacity:1; transform:translate(-50%,-50%) scale(1); }
          64%,100% { opacity:0; transform:translate(-50%,-50%) scale(1.12); }
        }
        @keyframes pinoriaCheckoutMover {
          0%,38% {
            left:${checkout.leftPct}%;
            top:${checkout.topPct}%;
            width:${checkout.widthPct}%;
            transform:scale(1);
          }
          49% {
            left:${checkout.leftPct}%;
            top:${checkout.topPct}%;
            width:${checkout.widthPct}%;
            transform:scale(1.24);
          }
          59% {
            left:${checkout.leftPct}%;
            top:${checkout.topPct}%;
            width:${checkout.widthPct}%;
            transform:scale(1.08);
          }
          100% {
            left:${DEPARTURE_HERO_TARGET.leftPct}%;
            top:${DEPARTURE_HERO_TARGET.topPct}%;
            width:${DEPARTURE_HERO_TARGET.widthPct}%;
            transform:scale(1);
          }
        }
        @keyframes pinoriaCheckoutMiniResolve {
          0%,56% { opacity:1; }
          76%,100% { opacity:0; }
        }
        @keyframes pinoriaCheckoutFullResolve {
          0%,56% { opacity:0; }
          76%,100% { opacity:1; }
        }
        @keyframes pinoriaCheckoutLabel {
          0%,12% { opacity:0; transform:translate(-50%,10px); }
          27%,52% { opacity:1; transform:translate(-50%,0); }
          68%,100% { opacity:0; transform:translate(-50%,-8px); }
        }
        [data-checkout-dim] { animation:pinoriaCheckoutDim ${AMBIENT_TO_DEPARTURE_MS}ms ease-out both; }
        [data-checkout-spotlight] { animation:pinoriaCheckoutSpotlight ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
        [data-checkout-mover] { animation:pinoriaCheckoutMover ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.16,.76,.12,1) both; }
        [data-checkout-moving-mini] { animation:pinoriaCheckoutMiniResolve ${AMBIENT_TO_DEPARTURE_MS}ms ease both; }
        [data-checkout-moving-full] { animation:pinoriaCheckoutFullResolve ${AMBIENT_TO_DEPARTURE_MS}ms ease both; }
        [data-checkout-label] { animation:pinoriaCheckoutLabel ${AMBIENT_TO_DEPARTURE_MS}ms cubic-bezier(.2,.8,.2,1) both; }
      `}</style>

      <PinoriaStage dataStage="checkout-transition" style={{ background: "#101711" }}>
        <img src={ASSETS.back} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />
        <img src={ASSETS.mid} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 10, pointerEvents: "none" }} />

        {actors.filter((actor) => actor.id !== subject.id).map((actor) => (
          <div key={actor.id} style={{ position: "absolute", inset: 0, zIndex: 14, opacity: .68, filter: "brightness(.62) saturate(.75)" }}>
            <MiniReplica actor={actor} subjectId={actor.id} />
          </div>
        ))}

        <img src={ASSETS.front} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 20, pointerEvents: "none" }} />

        <div data-checkout-dim style={{ position: "absolute", inset: 0, zIndex: 24, background: "rgba(4,8,5,.70)", pointerEvents: "none" }} />

        <div
          data-checkout-spotlight
          aria-hidden="true"
          style={{
            position: "absolute",
            zIndex: 25,
            left: `${checkoutCenterX}%`,
            top: `${checkoutCenterY}%`,
            width: "20%",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(255,250,222,.66) 0,rgba(247,229,166,.31) 30%,rgba(238,218,155,.10) 54%,transparent 73%)",
            boxShadow: "0 0 82px rgba(248,225,151,.24)",
            pointerEvents: "none",
          }}
        />

        <div
          data-checkout-mover
          data-checkout-source={`${checkout.leftPct.toFixed(2)},${checkout.topPct.toFixed(2)},${checkout.widthPct.toFixed(2)}`}
          style={{
            position: "absolute",
            zIndex: 30,
            left: `${checkout.leftPct}%`,
            top: `${checkout.topPct}%`,
            width: `${checkout.widthPct}%`,
            aspectRatio: "1 / 1",
            transformOrigin: "50% 50%",
            pointerEvents: "none",
            willChange: "left,top,width,transform",
          }}
        >
          <div data-checkout-moving-mini style={{ position: "absolute", inset: 0 }}>
            <div data-ambient-mini-character data-ambient-mini-body="on" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <PrototypeCharacter subjectId={subject.id} size="100%" wingMotion="off" />
            </div>
          </div>
          <div data-checkout-moving-full style={{ position: "absolute", inset: 0 }}>
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
            textAlign: "center",
            width: "70%",
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
