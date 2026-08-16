import type { Metadata } from "next";
import PinerPrototypeV15 from "./PinerPrototypeV15";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V15",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV15 />;
}
