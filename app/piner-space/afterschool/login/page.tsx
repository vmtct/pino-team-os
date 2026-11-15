import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AfterschoolPinForm from "./AfterschoolPinForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập PIN · PINO Afterschool",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const context = await getCloudflareContext({ async: true }).catch(() => null);
  const env = context?.env as { APP_ENV?: string; PINER_AFTERSCHOOL_PIN_BFF_ENABLED?: string } | undefined;
  if (env?.APP_ENV !== "staging" || env.PINER_AFTERSCHOOL_PIN_BFF_ENABLED !== "true") notFound();
  return <AfterschoolPinForm />;
}
