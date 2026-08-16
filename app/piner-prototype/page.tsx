import type { Metadata } from "next";
import PinerPrototypeV18 from "./PinerPrototypeV18";

export const metadata: Metadata = {
  title: "Piner Member Space — Local Prototype V18",
  description: "Local mock prototype for PINO Piner Member Space",
};

export default function PinerPrototypePage() {
  return <PinerPrototypeV18 />;
}
