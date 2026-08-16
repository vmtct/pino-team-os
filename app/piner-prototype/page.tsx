import type { Metadata } from "next";
import PinerPrototype from "./PinerPrototype";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototype />;
}
