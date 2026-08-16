import type { Metadata } from "next";
import PinerPrototypeV9 from "./PinerPrototypeV9";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V9",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV9 />;
}
