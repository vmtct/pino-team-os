import type { Metadata } from "next";
import PinerPrototypeV10 from "./PinerPrototypeV10";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V10",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV10 />;
}
