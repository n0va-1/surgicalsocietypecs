import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Surgical Society Pécs · Skills Academy",
  description: "A bilingual learning and progress platform for surgical skills students and demonstrators.",
  icons: {
    icon: "/ssp-logo.png",
    shortcut: "/ssp-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
