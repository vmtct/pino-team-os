import type { Metadata } from "next";
import PinerPrototypeFreezePolish from "./PinerPrototypeFreezePolish";
import premiumPolish from "./piner-prototype-v23-premium-polish.module.css";
import finalPolish from "./piner-prototype-final-ui-polish.module.css";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V23",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return (
    <div className={`${premiumPolish.root} ${finalPolish.root}`}>
      <PinerPrototypeFreezePolish />
    </div>
  );
}
