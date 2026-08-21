import { BoShell, type BoNavGroup } from "@/app/components/tos-shell";

const groups: BoNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/bo", label: "Home" }],
  },
];

export default function BoLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoShell title="PINO Team" subtitle="Back Office" groups={groups} activeHref="/bo">
      {children}
    </BoShell>
  );
}
