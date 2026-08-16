import type { Metadata } from "next";
import PinerPrototypeV12 from "./PinerPrototypeV12";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V12",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV12 />;
}
