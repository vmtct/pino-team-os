"use client";

import savedEmergence from "./ambient-house-emergence.saved.json";
import { ChoiceScene } from "./choice-scene";
import { PinoriaStage } from "./pinoria-stage";
import { PrototypeCharacter } from "./prototype-assets";

export const CHOICE_SELECTION_MS = 8000;
export const CHOICE_SETTLE_MS = 5200;
export const CHOICE_TO_AMBIENT_MS = CHOICE_SELECTION_MS + CHOICE_SETTLE_MS;

export type AmbientHandoffTarget = { leftPct: number; topPct: number; widthPct: number };

type ChoiceTransitionSubject = {
  id: string;
  name: string;
  path: string;
  room: string;
  companion: string;
  pls: number;
  fruit: number;
};

type EmergenceSnapshot = {
  pin: { laneId: string; x: number; y: number };
};

const EMERGENCE = (savedEmergence as EmergenceSnapshot).pin;
const MINI_WIDTH = 164;
const MINI_CENTER_X = 82;
const MINI_CENTER_Y = 57.5;
const emergeLeftPct = ((EMERGENCE.x - MINI_CENTER_X) / 1920) * 100;
const emergeTopPct = ((EMERGENCE.y - MINI_CENTER_Y) / 1080) * 100;
const emergeWidthPct = (MINI_WIDTH / 1920) * 100;
const DEFAULT_AMBIENT_TARGET: AmbientHandoffTarget = { leftPct: emergeLeftPct, topPct: emergeTopPct, widthPct: emergeWidthPct };

export function ChoiceToAmbientScene({ subject, ambientTarget = null }: { subject: ChoiceTransitionSubject; ambientTarget?: AmbientHandoffTarget | null }) {
  const target = ambientTarget ?? DEFAULT_AMBIENT_TARGET;
  return (
    <div
      data-pinoria-choice-to-ambient
      data-emergence-lane={EMERGENCE.laneId}
      data-emergence-source={ambientTarget ? "ambient-agent" : "saved-pin"}
      data-emergence-target={`${target.leftPct.toFixed(2)},${target.topPct.toFixed(2)},${target.widthPct.toFixed(2)}`}
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "transparent", color: "#fff" }}
    >
      <style>{`
        @keyframes pinoriaChoiceLayerExit {
          0% { opacity:1; transform:scale(1); filter:blur(0); }
          100% { opacity:0; transform:scale(1.012); filter:blur(7px); }
        }
        @keyframes pinoriaChoiceHeroCharacter {
          0%,8% { opacity:0; left:39%; top:21%; width:22%; transform:scale(.94); }
          20% { opacity:1; left:39%; top:21%; width:22%; transform:scale(1.06); }
          48% { opacity:1; left:39%; top:21%; width:22%; transform:scale(1); }
          100% { opacity:1; left:${target.leftPct}%; top:${target.topPct}%; width:${target.widthPct}%; transform:scale(1); }
        }
        @keyframes pinoriaChoiceGreeting {
          0%,10% { opacity:0; transform:translate(-50%,14px); }
          22%,52% { opacity:1; transform:translate(-50%,0); }
          68%,100% { opacity:0; transform:translate(-50%,-8px); }
        }
        @keyframes pinoriaChoiceGlow {
          0%,8% { opacity:0; transform:translate(-50%,-50%) scale(.76); }
          24%,52% { opacity:.86; transform:translate(-50%,-50%) scale(1); }
          72%,100% { opacity:0; transform:translate(-50%,-50%) scale(.76); }
        }
        [data-transition-choice] { animation:pinoriaChoiceLayerExit 520ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 280}ms both; }
        [data-transition-character] { animation:pinoriaChoiceHeroCharacter ${CHOICE_SETTLE_MS}ms cubic-bezier(.18,.76,.16,1) ${CHOICE_SELECTION_MS - 120}ms both; }
        [data-transition-greeting] { animation:pinoriaChoiceGreeting ${CHOICE_SETTLE_MS}ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 80}ms both; }
        [data-transition-glow] { animation:pinoriaChoiceGlow ${CHOICE_SETTLE_MS}ms cubic-bezier(.2,.78,.2,1) ${CHOICE_SELECTION_MS - 120}ms both; }
      `}</style>

      <div data-transition-choice style={{ position: "absolute", inset: 0, zIndex: 20 }}>
        <ChoiceScene subject={subject} />
      </div>

      <PinoriaStage dataStage="choice-to-ambient" style={{ zIndex: 30, pointerEvents: "none" }}>
        <div data-transition-glow aria-hidden="true" style={{ position: "absolute", zIndex: 1, left: "50%", top: "47%", width: "33%", aspectRatio: "1 / 1", borderRadius: "50%", background: "radial-gradient(circle,rgba(248,224,150,.34) 0,rgba(218,207,144,.12) 42%,transparent 72%)", boxShadow: "0 0 90px rgba(235,213,139,.14)" }} />

        <div data-transition-character aria-label={`Nhân vật ${subject.name} trở về Nhà PINO`} style={{ position: "absolute", zIndex: 4, left: `${target.leftPct}%`, top: `${target.topPct}%`, width: `${target.widthPct}%`, aspectRatio: "1 / 1", transformOrigin: "50% 50%", willChange: "left,top,width,transform,opacity" }}>
          <PrototypeCharacter subjectId={subject.id} wingMotion="idle" size="100%" style={{ filter: "drop-shadow(0 14px 18px rgba(0,0,0,.22))" }} />
        </div>

        <div data-transition-greeting style={{ position: "absolute", zIndex: 6, left: "50%", top: "7%", width: "72%", textAlign: "center", textShadow: "0 4px 24px rgba(9,16,9,.42)" }}>
          <span style={{ display: "block", marginBottom: 9, color: "#efd78d", fontSize: 12, fontWeight: 900, letterSpacing: ".18em" }}>ĐÃ CHỌN XONG ✦</span>
          <h1 style={{ margin: 0, fontSize: "clamp(40px,3.6vw,68px)", lineHeight: .98, letterSpacing: "-.045em", color: "#fffaf0" }}>
            Chúc {subject.name} một buổi thật vui ở Nhà PINO nhé!
          </h1>
        </div>
      </PinoriaStage>
    </div>
  );
}
