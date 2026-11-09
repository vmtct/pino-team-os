// PAP-1749 · PNR-APP-HUB · mobile-only PINO launcher (TOS PAP-934 geometry).
import type { Metadata } from "next";
import { PinerHome } from "./SharedShell";
export const metadata: Metadata = {
  title: "Piner Space · Ứng dụng",
  description: "Không gian ứng dụng PINO House · 5 hành trình sáng tạo."
};
export default function PinerHomePage() { return <PinerHome/>; }
