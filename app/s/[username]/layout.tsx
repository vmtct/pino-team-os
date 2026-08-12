import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { currentStaff } from "@/lib/repositories/current-staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, noarchive: true } };

export default async function StaffLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ username: string }> }>) {
  const { username } = await params;
  const staff = await currentStaff();
  if (!staff) notFound();
  return <div className="app-shell"><Sidebar username={username} /><main className="main">{children}</main></div>;
}
