import type { Metadata } from "next";
import PinerPrototypeV6 from "./PinerPrototypeV6";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V6",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV6 />;
}
