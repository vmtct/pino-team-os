import type { Metadata } from "next";
import PinerPrototypeV4 from "./PinerPrototypeV4";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V4",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV4 />;
}
