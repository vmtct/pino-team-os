import type { Metadata } from "next";
import PinerPrototypeV2 from "./PinerPrototypeV2";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V2",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV2 />;
}
