import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { AmbientHouseRuntime } from "../../ambient-house-runtime";
import { WorldStateAmbientOverlay } from "../../world-state-ambient-overlay";
import { DEFAULT_WORLD_STATE_TRANSITION } from "../../world-state-transition-data";
import { WorldStateTransitionScene } from "../../world-state-transition-scene";

export const dynamic = "force-dynamic";

const subject = {
  id: "bo",
  name: "Bơ",
  path: "ArtChitect · Màu nước II",
  room: "Phòng Họa",
};

export default function WorldStateTransitionReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main className={fontStyles.vnFont} lang="vi" style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#101711" }}>
        <AmbientHouseRuntime subject={subject} />
        <WorldStateAmbientOverlay state={DEFAULT_WORLD_STATE_TRANSITION.to} />
        <WorldStateTransitionScene transition={DEFAULT_WORLD_STATE_TRANSITION} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
