import type { Metadata } from "next";
import PinerPrototypeV13 from "./PinerPrototypeV13";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V13",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV13 />;
}
