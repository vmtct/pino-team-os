import type { Metadata } from "next";
import PinerPrototypeV8 from "./PinerPrototypeV8";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V8",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV8 />;
}
