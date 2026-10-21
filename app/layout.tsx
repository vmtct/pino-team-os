import "./globals.css";
import type { Metadata } from "next";

const pinoSigilIcon = "https://assets.pinohouse.art/core/Pino%20Sigil.png";

export const metadata: Metadata = {
  title: "PINO Team OS",
  description: "Personal workspace for PINO Team",
  icons: {
    icon: [{ url: pinoSigilIcon, type: "image/png" }],
    shortcut: [{ url: pinoSigilIcon, type: "image/png" }],
    apple: [{ url: pinoSigilIcon, type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
