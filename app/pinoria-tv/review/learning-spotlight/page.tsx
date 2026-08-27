import fontStyles from "../../../pinoria-vietnamese-font.module.css";
import { PinoriaVietnameseLocale } from "../../../pinoria-vietnamese-locale";
import { DEFAULT_LEARNING_SPOTLIGHT, LearningSpotlightScene } from "../../learning-spotlight-scene";

const subject = {
  id: "bo",
  name: "Bơ",
  path: "ArtChitect · Màu nước II",
  room: "Phòng Họa",
};

export default function LearningSpotlightReviewPage() {
  return (
    <PinoriaVietnameseLocale>
      <main
        className={fontStyles.vnFont}
        lang="vi"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          background: "radial-gradient(circle at 56% 44%,#283028 0,#171b19 36%,#090a09 78%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: .5,
            background: "linear-gradient(110deg,rgba(50,73,57,.36),transparent 42%,rgba(90,70,39,.24))",
          }}
        />
        <LearningSpotlightScene subject={subject} spotlight={DEFAULT_LEARNING_SPOTLIGHT} />
      </main>
    </PinoriaVietnameseLocale>
  );
}
