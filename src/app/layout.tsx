import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME } from "@/lib/constants";
import { SiteChrome } from "@/components/site-chrome";
import { NEIGHBORHOOD_EXTENT } from "@/lib/map-views";
import { DEFAULT_SHARE_DESCRIPTION, SITE_URL } from "@/lib/metadata";
import { SECONDARY_NAV_ITEMS } from "@/lib/site-navigation";

// [zapad, jug, istok, sjever] → čitljiv raspon (decimalni zarez, hrvatski).
const [bboxW, bboxS, bboxE, bboxN] = NEIGHBORHOOD_EXTENT;
const deg = (v: number) => v.toFixed(3).replace(".", ",");
const KVART_COORDS = `${deg(bboxS)}°–${deg(bboxN)}° S · ${deg(bboxW)}°–${deg(bboxE)}° I`;

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: SITE_NAME,
    template: "%s — Naš kvart",
  },
  description: DEFAULT_SHARE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "hr_HR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_SHARE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_SHARE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr">
      <body className="min-h-screen overflow-x-clip bg-zinc-50 text-zinc-900 antialiased">
        <SiteChrome
          podnozje={
            <footer className="mt-12 border-t border-zinc-200 bg-white">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 pb-3 pt-6 text-sm text-zinc-500">
                <p>Građanska inicijativa stanovnika Dračevca i Bilica, Split.</p>
                <nav
                  aria-label="Dodatne stranice"
                  className="flex flex-wrap items-center gap-x-4 gap-y-2"
                >
                  {SECONDARY_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="fokus meta flex items-center hover:text-zinc-700"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href="/admin"
                    className="fokus meta flex items-center hover:text-zinc-700"
                  >
                    Moderatori
                  </Link>
                </nav>
              </div>
              <div className="mx-auto max-w-5xl px-4 pb-6 text-xs text-zinc-400">
                Kvart se prostire između{" "}
                <span className="whitespace-nowrap tabular-nums">
                  {KVART_COORDS}
                </span>{" "}
                (WGS 84).
              </div>
            </footer>
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
