import type { Metadata } from "next";
import PinerPrototypeV17 from "./PinerPrototypeV17";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V17",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV17 />;
}
