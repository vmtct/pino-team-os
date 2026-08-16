import type { Metadata } from "next";
import PinerPrototypeV5 from "./PinerPrototypeV5";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V5",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV5 />;
}
