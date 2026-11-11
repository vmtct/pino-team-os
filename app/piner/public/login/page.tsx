// PAP-1838 / PNR-IDENTITY — real Piner login UI backed only by guarded BFF.
import type { Metadata } from "next";
import { safePinerReturnTo } from "@/lib/piner-login-policy";
import PinerLoginForm from "./PinerLoginForm";

export const metadata: Metadata = {
  title: "Đăng nhập Piner APP · PINO",
  robots: { index: false, follow: false },
};
type Props = { searchParams: Promise<{ returnTo?: string | string[] }> };

export default async function PublicLogin({ searchParams }: Props) {
  const raw = (await searchParams).returnTo;
  const returnTo = safePinerReturnTo(typeof raw === "string" ? raw : undefined);
  return <PinerLoginForm returnTo={returnTo} />;
}
