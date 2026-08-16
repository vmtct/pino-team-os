import type { Metadata } from "next";
import PinerPrototypeV11 from "./PinerPrototypeV11";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V11",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV11 />;
}
