import type { Metadata } from "next";
import PinerPrototypeV19 from "./PinerPrototypeV19";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V19",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV19 />;
}
