import { BoShell, type BoNavGroup } from "../components/tos-shell";

const groups: BoNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/founder", label: "Tổng quan" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/founder/sessions", label: "Buổi học" },
      { href: "/founder/registrations", label: "Đăng ký" },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/founder/running-classes", label: "Lớp đang chạy" },
      { href: "/founder/syllabus", label: "Giáo án" },
    ],
  },
];

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return (
    <BoShell title="PINO Team" subtitle="Back Office" groups={groups}>
      {children}
    </BoShell>
  );
}
