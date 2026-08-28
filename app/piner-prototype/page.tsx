import type { Metadata } from "next";
import PinerPrototypeFreezePolish from "./PinerPrototypeFreezePolish";
import PinerPracticeImmersive from "./PinerPracticeImmersive";
import premiumPolish from "./piner-prototype-v23-premium-polish.module.css";
import finalPolish from "./piner-prototype-final-ui-polish.module.css";
import musicViewerPolish from "./piner-prototype-music-viewer-freeze.module.css";
import practiceFocus from "./piner-prototype-practice-focus.module.css";
import practiceRatio from "./piner-prototype-practice-ratio.module.css";
import hardPolish from "./piner-prototype-hard-polish.module.css";

export const metadata: Metadata = {
  title: "Piner Space — Staging Prototype",
  description: "Staging prototype for PINO Piner Space",
};

export default function PinerPrototypePage() {
  return (
    <div className={`${premiumPolish.root} ${finalPolish.root} ${musicViewerPolish.root} ${practiceFocus.root} ${practiceRatio.root} ${hardPolish.root}`}>
      <PinerPrototypeFreezePolish />
      <PinerPracticeImmersive />
    </div>
  );
}
