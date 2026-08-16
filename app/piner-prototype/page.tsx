import type { Metadata } from "next";
import PinerPrototypeV16 from "./PinerPrototypeV16";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V16",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV16 />;
}
