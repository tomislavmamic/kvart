import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: "%s — Naš kvart",
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr">
      <body className="min-h-screen overflow-x-clip bg-zinc-50 text-zinc-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-500">
            <p>Građanska inicijativa stanovnika Dračevca i Bilica, Split.</p>
            <Link href="/admin" className="hover:text-zinc-700">
              Moderatori
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
