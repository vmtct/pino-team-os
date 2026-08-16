import type { Metadata } from "next";
import PinerPrototypeV21 from "./PinerPrototypeV21";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V21",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV21 />;
}
