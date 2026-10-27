import { HO_STAGING_HOSTNAME } from "@/lib/host-boundary";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { isBoStagingHost } from "@/lib/bo-skeleton-routing";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boSkeletonEnabled, BO_AUTHORITY_STYLES, HO_AUTHORITY_STYLES } from "@/lib/bo-skeleton";
import { isBoStagingRouteAdmitted } from "./bo/architecture/bo-staging-route-policy";

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
  if (isBoStagingHost(incoming.get("host") || "") && (path === "/bo" || path === "/bo/" || isBoStagingRouteAdmitted(path ?? ""))) {
    try {
      const { env } = await getCloudflareContext({ async: true }) as unknown as { env: { APP_ENV?: string; BO_UI_ONLY?: string } };
      bo = boSkeletonEnabled(env, incoming.get("host") || "");
    } catch { /* No implicit staging flag or styling fallback on other deployments. */ }
  }
  // Distinct stylesheet pipelines: global TOS rules cannot leak into the BO authority.
  const ho = incoming.get("host") === HO_STAGING_HOSTNAME;
  const hoAuthPage = ho && incoming.get("x-pino-ho-auth-page") === "1";
  // Login must render from its public CSS module, not fetch a guarded HO asset.
  const css = (bo || (ho && !hoAuthPage)) ? (ho ? HO_AUTHORITY_STYLES : BO_AUTHORITY_STYLES).map(file => "/bo-skeleton/" + file) : hoAuthPage ? [] : ["/team-legacy-global.css"];
  return <html lang="vi" data-bo-ui-authority={bo ? "v25" : undefined} data-surface={ho && !hoAuthPage ? "ho" : undefined}><head>{css.map(href => <link key={href} rel="stylesheet" href={href} />)}</head><body>{children}</body></html>;
}
