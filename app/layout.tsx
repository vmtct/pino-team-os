import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "PINO Team OS",
  description: "Internal workspace for PINO Team",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><div className="app-shell"><Sidebar /><main className="main">{children}</main></div></body>
    </html>
  );
}
