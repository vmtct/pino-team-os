import { HO_STAGING_HOSTNAME } from "@/lib/host-boundary";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { isBoStagingHost } from "@/lib/bo-skeleton-routing";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boSkeletonEnabled, BO_AUTHORITY_STYLES } from "@/lib/bo-skeleton";

const pinoSigilIcon = "https://assets.pinohouse.art/core/Pino%20Sigil.png";

export const metadata: Metadata = {
  title: "PINO Team OS",
  description: "Personal workspace for PINO Team",
  icons: {
    icon: [{ url: pinoSigilIcon, type: "image/png" }],
    shortcut: [{ url: pinoSigilIcon, type: "image/png" }],
    apple: [{ url: pinoSigilIcon, type: "image/png" }],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const incoming = await headers();
  const path = incoming.get("x-pino-bo-runtime-path");
  let bo = false;
  if (isBoStagingHost(incoming.get("host") || "") && (path === "/bo" || path === "/bo/")) {
    try {
      const { env } = await getCloudflareContext({ async: true }) as unknown as { env: { APP_ENV?: string; BO_UI_ONLY?: string } };
      bo = boSkeletonEnabled(env, incoming.get("host") || "");
    } catch { /* No implicit staging flag or styling fallback on other deployments. */ }
  }
  // Distinct stylesheet pipelines: global TOS rules cannot leak into the BO authority.
  const ho = [HO_STAGING_HOSTNAME,"ho.proto.pinohouse.art"].includes(incoming.get("host") || "");
  const css = (bo || ho) ? BO_AUTHORITY_STYLES.map(file => "/bo-skeleton/" + file) : ["/team-legacy-global.css"];
  return <html lang="vi" data-surface={ho ? "ho" : undefined}><head>{css.map(href => <link key={href} rel="stylesheet" href={href} />)}</head><body>{children}</body></html>;
}
