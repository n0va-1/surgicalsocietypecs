import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Surgical Society Pécs · Skills Academy",
  description: "A bilingual learning and progress platform for surgical skills students and demonstrators.",
  icons: {
    icon: "/ssp-logo.png",
    shortcut: "/ssp-logo.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A per-request CSP nonce cannot be embedded in statically generated HTML.
  // Keep the root dynamic so Next.js adds the nonce from proxy.ts to every script.
  await connection();
  return <html lang="en"><body>{children}</body></html>;
}
