"use client";

import { AmbientHouseRuntime } from "./ambient-house-runtime";
import { ChoiceScene } from "./choice-scene";
import { PrototypeCharacter } from "./prototype-assets";

export const CHOICE_SELECTION_MS = 8000;
export const CHOICE_SETTLE_MS = 5200;
export const CHOICE_TO_AMBIENT_MS = CHOICE_SELECTION_MS + CHOICE_SETTLE_MS;

type ChoiceTransitionSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

export function ChoiceToAmbientScene({ subject }: { subject: ChoiceTransitionSubject }) {
  return (
    <div
      data-pinoria-choice-to-ambient
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#101711", color: "#fff" }}
    >
      <style>{`
        [data-pinoria-choice-to-ambient] [data-transition-house] [data-ambient-runtime-character] {
          display: none !important;
        }

        @keyframes pinoriaChoiceLayerExit {
          0% { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(1.015); filter: blur(7px); }
        }
        @keyframes pinoriaChoiceHouseReveal {
          0% { opacity: .55; filter: brightness(.76) saturate(.82); }
          34% { opacity: .82; filter: brightness(.9) saturate(.9); }
          100% { opacity: 1; filter: brightness(1) saturate(1); }
        }
        @keyframes pinoriaChoiceHeroGlow {
          0%,8% { opacity: 0; transform: translate(-50%,-50%) scale(.72); }
          22% { opacity: .9; transform: translate(-50%,-50%) scale(1.08); }
          48% { opacity: .62; transform: translate(-50%,-50%) scale(1); }
          72%,100% { opacity: 0; transform: translate(-50%,-50%) scale(.72); }
        }
        @keyframes pinoriaChoiceHeroCharacter {
          0% {
            opacity: 0;
            transform: translate(56vw,-40vh) scale(2.72);
            filter: brightness(1.02) drop-shadow(0 24px 28px rgba(0,0,0,.25));
          }
          10% {
            opacity: 1;
            transform: translate(56vw,-40vh) scale(3.15);
            filter: brightness(1.16) drop-shadow(0 30px 34px rgba(0,0,0,.28)) drop-shadow(0 0 24px rgba(241,215,137,.22));
          }
          28% {
            opacity: 1;
            transform: translate(56vw,-40vh) scale(3.02);
            filter: brightness(1.08) drop-shadow(0 28px 30px rgba(0,0,0,.27)) drop-shadow(0 0 18px rgba(241,215,137,.16));
          }
          48% {
            opacity: 1;
            transform: translate(56vw,-40vh) scale(3.02);
            filter: brightness(1.04) drop-shadow(0 25px 28px rgba(0,0,0,.25));
          }
          100% {
            opacity: 1;
            transform: translate(0,0) scale(1);
            filter: brightness(1) drop-shadow(0 10px 13px rgba(0,0,0,.20));
          }
        }
        @keyframes pinoriaChoiceGreeting {
          0%,10% { opacity: 0; transform: translateY(15px) scale(.985); }
          22%,52% { opacity: 1; transform: translateY(0) scale(1); }
          68%,100% { opacity: 0; transform: translateY(-8px) scale(.985); }
        }
        @keyframes pinoriaChoiceSpark {
          0%,100% { opacity: 0; transform: translate3d(0,10px,0) scale(.7); }
          24% { opacity: .9; transform: translate3d(0,-5px,0) scale(1); }
          62% { opacity: .45; transform: translate3d(0,-18px,0) scale(.86); }
        }

        [data-transition-house] {
          animation: pinoriaChoiceHouseReveal ${CHOICE_SETTLE_MS}ms ease-out ${CHOICE_SELECTION_MS - 180}ms both;
        }
        [data-transition-choice] {
          animation: pinoriaChoiceLayerExit 520ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 280}ms both;
        }
        [data-transition-glow] {
          animation: pinoriaChoiceHeroGlow ${CHOICE_SETTLE_MS}ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 160}ms both;
        }
        [data-transition-character] {
          animation: pinoriaChoiceHeroCharacter ${CHOICE_SETTLE_MS}ms cubic-bezier(.2,.76,.18,1) ${CHOICE_SELECTION_MS - 120}ms both;
        }
        [data-transition-greeting] {
          animation: pinoriaChoiceGreeting ${CHOICE_SETTLE_MS}ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 80}ms both;
        }
        [data-transition-spark="1"] { animation: pinoriaChoiceSpark 2.1s ease-in-out ${CHOICE_SELECTION_MS + 120}ms both; }
        [data-transition-spark="2"] { animation: pinoriaChoiceSpark 2.4s ease-in-out ${CHOICE_SELECTION_MS + 320}ms both; }
        [data-transition-spark="3"] { animation: pinoriaChoiceSpark 2s ease-in-out ${CHOICE_SELECTION_MS + 520}ms both; }

        @media (prefers-reduced-motion: reduce) {
          [data-transition-choice] { animation-duration: 1ms !important; }
          [data-transition-house] { animation-duration: 1ms !important; }
          [data-transition-character] { animation-duration: ${CHOICE_SETTLE_MS}ms !important; }
          [data-transition-greeting] { animation-duration: ${CHOICE_SETTLE_MS}ms !important; }
        }
      `}</style>

      <div data-transition-house style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <AmbientHouseRuntime subject={subject} />
      </div>

      <div data-transition-choice style={{ position: "absolute", inset: 0, zIndex: 20 }}>
        <ChoiceScene subject={subject} />
      </div>

      <div
        data-transition-glow
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 32,
          left: "65%",
          top: "49%",
          width: "min(520px,42vw)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(248,224,150,.34) 0,rgba(218,207,144,.12) 42%,transparent 72%)",
          boxShadow: "0 0 90px rgba(235,213,139,.14)",
          pointerEvents: "none",
        }}
      />

      <div
        data-transition-character
        aria-label={`Nhân vật ${subject.name} trở về Nhà PINO`}
        style={{
          position: "absolute",
          zIndex: 40,
          left: "4.583vw",
          top: "80.88vh",
          width: "8.542vw",
          minWidth: 90,
          aspectRatio: "1 / 1",
          transformOrigin: "50% 50%",
          pointerEvents: "none",
          willChange: "transform, filter, opacity",
        }}
      >
        <PrototypeCharacter
          subjectId={subject.id}
          wingMotion="idle"
          size="100%"
          style={{ filter: "drop-shadow(0 12px 16px rgba(0,0,0,.18))" }}
        />
      </div>

      <div
        data-transition-greeting
        style={{
          position: "absolute",
          zIndex: 45,
          left: "50%",
          top: "11%",
          width: "min(860px,78vw)",
          transform: "translateX(-50%)",
          textAlign: "center",
          pointerEvents: "none",
          textShadow: "0 4px 24px rgba(9,16,9,.42)",
        }}
      >
        <span style={{ display: "block", marginBottom: 9, color: "#efd78d", fontSize: 11, fontWeight: 900, letterSpacing: ".18em" }}>
          ĐÃ CHỌN XONG ✦
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(34px,4.2vw,60px)", lineHeight: .98, letterSpacing: "-.045em", color: "#fffaf0" }}>
          Chúc {subject.name} một buổi thật vui ở Nhà PINO nhé!
        </h1>
      </div>

      <span data-transition-spark="1" aria-hidden="true" style={{ position: "absolute", zIndex: 44, left: "58%", top: "34%", width: 8, height: 8, borderRadius: "50%", background: "#f2d983", boxShadow: "0 0 18px #f2d983aa", pointerEvents: "none" }} />
      <span data-transition-spark="2" aria-hidden="true" style={{ position: "absolute", zIndex: 44, left: "72%", top: "42%", width: 6, height: 6, borderRadius: "50%", background: "#dfe9ca", boxShadow: "0 0 16px #dfe9caaa", pointerEvents: "none" }} />
      <span data-transition-spark="3" aria-hidden="true" style={{ position: "absolute", zIndex: 44, left: "66%", top: "58%", width: 5, height: 5, borderRadius: "50%", background: "#fff", boxShadow: "0 0 14px #ffffffaa", pointerEvents: "none" }} />
    </div>
  );
}
