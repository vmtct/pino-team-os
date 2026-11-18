import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AfterschoolPinForm from "./AfterschoolPinForm";
import { PinerAuthShell } from "./PinerAuthShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập PIN · PINO Afterschool",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.PINER_AFTERSCHOOL_LOGIN_ENABLED !== "1") notFound();
  return <PinerAuthShell><AfterschoolPinForm /></PinerAuthShell>;
}
