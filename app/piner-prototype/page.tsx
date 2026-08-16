import type { Metadata } from "next";
import PinerPrototypeV3 from "./PinerPrototypeV3";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V3",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV3 />;
}
