import type { Metadata } from "next";
import PinerPrototypeV7 from "./PinerPrototypeV7";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V7",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV7 />;
}
