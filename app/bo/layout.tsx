import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";
import { authorizeBoShell, type BoShellGateEnv } from "@/lib/bo-shell-gate";

export const dynamic = "force-dynamic";

const groups: BoNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/bo", label: "Home" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/bo/learners", label: "Learners" },
      { href: "/bo/delivery-activation", label: "Delivery Activation" },
      { href: "/bo/running-classes", label: "Running Classes" },
      { href: "/bo/sessions", label: "Sessions" },
      { href: "/bo/registrations", label: "Registrations" },
    ],
  },
  {
    label: "Workforce",
    items: [{ href: "/bo/staff", label: "Staff onboarding" }],
  },
  {
    label: "Content",
    items: [{ href: "/bo/syllabus", label: "Syllabus / Programs" }],
  },
];

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  try {
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv };
    await authorizeBoShell(requestHeaders, env);
  } catch (error) {
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }

  return (
    <BoShell title="PINO Team" subtitle="Back Office" groups={groups}>
      {children}
    </BoShell>
  );
}
