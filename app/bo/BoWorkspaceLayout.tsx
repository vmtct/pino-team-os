"use client";

import { usePathname } from "next/navigation";
import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";

const pinoHouseGroups: BoNavGroup[] = [
  { label: "Overview", items: [{ href: "/bo", label: "Home" }] },
  {
    label: "Operations",
    items: [
      { href: "/bo/delivery-activation", label: "Delivery Activation" },
      { href: "/bo/running-classes", label: "Running Classes" },
      { href: "/bo/sessions", label: "Sessions" },
      { href: "/bo/registrations", label: "Registrations" },
    ],
  },
  { label: "Workforce", items: [{ href: "/bo/staff", label: "Staff onboarding" }] },
  { label: "Content", items: [{ href: "/bo/syllabus", label: "Syllabus / Programs" }] },
];

const toppiGroups: BoNavGroup[] = [
  { label: "Overview", items: [{ href: "/bo/toppi", label: "Home" }] },
  {
    label: "Learners",
    items: [
      { href: "/bo/toppi/students", label: "Students" },
      { href: "/bo/toppi/enrollments", label: "Enrollments" },
      { href: "/bo/toppi/renewals", label: "Renewals" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/bo/toppi/schedule", label: "Schedule" },
      { href: "/bo/toppi/sessions", label: "Sessions" },
      { href: "/bo/toppi/registrations", label: "Registrations" },
    ],
  },
  {
    label: "Learning",
    items: [{ href: "/bo/toppi/weekly-units", label: "Weekly Units" }],
  },
  {
    label: "Content",
    items: [{ href: "/bo/toppi/programs", label: "Programs" }],
  },
];

const workspaceItems = [
  { id: "pino-house", label: "PINO House", href: "/bo", meta: "Live" },
  { id: "toppi", label: "Toppi", href: "/bo/toppi", meta: "Prototype" },
];

function activeHref(pathname: string, groups: BoNavGroup[]) {
  const candidates = groups.flatMap((group) => group.items.map((item) => item.href));
  return candidates
    .filter((href) => pathname === href || (href !== "/bo" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

export default function BoWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isToppi = pathname === "/bo/toppi" || pathname.startsWith("/bo/toppi/");
  const groups = isToppi ? toppiGroups : pinoHouseGroups;

  return (
    <BoShell
      title="PINO Team"
      subtitle="Back Office"
      groups={groups}
      activeHref={activeHref(pathname, groups)}
      workspaceSwitcher={{
        activeId: isToppi ? "toppi" : "pino-house",
        items: workspaceItems,
      }}
    >
      {children}
    </BoShell>
  );
}
