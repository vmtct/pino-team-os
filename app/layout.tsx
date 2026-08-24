import "./globals.css";
import "./pinoria-ambient-mini.css";
import "./pinoria-shop-motion.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PINO Team OS",
  description: "Personal workspace for PINO Team",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body suppressHydrationWarning>{children}</body></html>;
}
