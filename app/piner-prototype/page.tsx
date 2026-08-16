import type { Metadata } from "next";
import PinerPrototypeV22 from "./PinerPrototypeV22";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V22",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV22 />;
}
