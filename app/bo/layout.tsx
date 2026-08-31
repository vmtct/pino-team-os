import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";
import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "@/lib/bo-shell-gate";

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
      { href: "/bo/open-studio", label: "Open Studio" },
      { href: "/bo/delivery-activation", label: "Delivery Activation" },
      { href: "/bo/running-classes", label: "Running Classes" },
      { href: "/bo/sessions", label: "Sessions" },
      { href: "/bo/registrations", label: "Registrations" },
    ],
  },
  {
    label: "Learning",
    items: [{ href: "/bo/practice", label: "Piano Practice" }],
  },
  {
    label: "Workforce",
    items: [{ href: "/bo/staff", label: "Staff onboarding" }, { href: "/bo/workforce", label: "Lịch ca tuần" }],
  },
  {
    label: "Pinoria",
    items: [
      { href: "/bo/pinoria-activities", label: "Pinoria Activities" },
      { href: "/bo/pinoria-companions", label: "Companion / Eggs" },
      { href: "/bo/pinoria-wish", label: "Wish / Hạt Năng Lượng" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/bo/system/users", label: "Users" },
      { href: "/bo/system/roles", label: "Roles" },
      { href: "/bo/system/audit", label: "Audit" },
    ],
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
    if (error instanceof BoShellGateError && error.code === "ACCESS_STAFF_PIN_ROTATION_REQUIRED") redirect("/staff-pin/change");
    console.error("BO shell authorization denied", error instanceof Error ? error.message : "unknown");
    forbidden();
  }

  return (
    <BoShell title="PINO Team" subtitle="Back Office" groups={groups}>
      {children}
    </BoShell>
  );
}
