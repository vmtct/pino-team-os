import "../pinoria-ambient-mini.css";
import "../pinoria-shop-motion.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pinoria TV Prototype",
  description: "Founder UI review surface for Pinoria TV",
};

export default function PinoriaTvLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
