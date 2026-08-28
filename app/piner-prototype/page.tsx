import type { Metadata } from "next";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import PinerPrototypeFreezePolish from "./PinerPrototypeFreezePolish";
import PinerPracticeImmersive from "./PinerPracticeImmersive";
import premiumPolish from "./piner-prototype-v23-premium-polish.module.css";
import finalPolish from "./piner-prototype-final-ui-polish.module.css";
import musicViewerPolish from "./piner-prototype-music-viewer-freeze.module.css";
import practiceFocus from "./piner-prototype-practice-focus.module.css";
import practiceRatio from "./piner-prototype-practice-ratio.module.css";
import hardPolish from "./piner-prototype-hard-polish.module.css";

const pinerSans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-piner-sans",
  display: "swap",
});

const pinerSerif = Lora({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-piner-serif",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Piner Space — Staging Prototype",
  description: "Staging prototype for PINO Piner Space",
};

export default function PinerPrototypePage() {
  return (
    <div className={`${pinerSans.variable} ${pinerSerif.variable} ${premiumPolish.root} ${finalPolish.root} ${musicViewerPolish.root} ${practiceFocus.root} ${practiceRatio.root} ${hardPolish.root}`}>
      <PinerPrototypeFreezePolish />
      <PinerPracticeImmersive />
    </div>
  );
}
