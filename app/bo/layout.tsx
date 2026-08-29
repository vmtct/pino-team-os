import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";

const groups: BoNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/bo", label: "Home" }],
  },
  {
    label: "Operations",
    items: [
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
    label: "Pinoria",
    items: [{ href: "/bo/pinoria-wish", label: "Wish / Hạt Năng Lượng" }],
  },
  {
    label: "Content",
    items: [{ href: "/bo/syllabus", label: "Syllabus / Programs" }],
  },
];

export default function BoLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoShell title="PINO Team" subtitle="Back Office" groups={groups}>
      {children}
    </BoShell>
  );
}
