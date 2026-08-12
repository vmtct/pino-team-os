import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { currentStaff } from "@/lib/repositories/current-staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await currentStaff();
  if (!staff) notFound();
  return <div className="app-shell"><Sidebar username={staff.username || "staff"} /><main className="main">{children}</main></div>;
}
