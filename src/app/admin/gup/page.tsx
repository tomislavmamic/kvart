import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { isModerator } from "@/lib/auth";
import { db } from "@/lib/db";
import { gupIspravci } from "@/lib/db/schema";
import { oznaciIspravak } from "@/lib/actions/admin";
import { STATUSI_ISPRAVKA, VRSTE_ISPRAVKA, type StatusIspravka, type VrstaIspravka } from "@/lib/gup-grad/ispravci";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ispravci karte GUP-a — moderacija" };

const NAZIV_STATUSA: Record<StatusIspravka, string> = { novo: "Novi", prihvaceno: "Prihvaćeni", odbijeno: "Odbijeni" };

export default async function AdminGupPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!(await isModerator())) redirect("/admin/login");
  const trazeno = (await searchParams).status;
  const status: StatusIspravka = STATUSI_ISPRAVKA.includes(trazeno as StatusIspravka) ? (trazeno as StatusIspravka) : "novo";

  let redovi: (typeof gupIspravci.$inferSelect)[] = [];
  let broj: Partial<Record<string, number>> = {};
  let greska = false;
  try {
    [redovi, broj] = await Promise.all([
      db.select().from(gupIspravci).where(eq(gupIspravci.status, status)).orderBy(desc(gupIspravci.createdAt)).limit(500),
      db
        .select({ status: gupIspravci.status, n: sql<number>`count(*)::int` })
        .from(gupIspravci)
        .groupBy(gupIspravci.status)
        .then((r) => Object.fromEntries(r.map((x) => [x.status, x.n]))),
    ]);
  } catch (e) {
    console.error("gup_ispravci: čitanje nije uspjelo", e);
    greska = true;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← Natrag na moderaciju
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Ispravci karte provjere GUP-a</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Prijedlozi posjetitelja s <Link href="/gup?prikaz=karta" className="underline">karte čestica na /gup</Link>.
          Prihvaćene izvozi <code className="font-mono text-xs">npm run gup-grad:ispravci</code> u
          ručni pregled; tek tada ulaze u izračun.
        </p>
      </div>

      <nav className="flex gap-2 text-sm" aria-label="Stanje prijedloga">
        {STATUSI_ISPRAVKA.map((s) => (
          <Link
            key={s}
            href={`/admin/gup?status=${s}`}
            className={`rounded-full border px-3 py-1 ${s === status ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300"}`}
          >
            {NAZIV_STATUSA[s]} ({broj[s] ?? 0})
          </Link>
        ))}
      </nav>

      {greska && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Tablica <code>gup_ispravci</code> nije dostupna — je li pokrenut <code>npm run db:push</code>?
        </p>
      )}

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {!greska && redovi.length === 0 && <li className="p-4 text-sm text-zinc-500">Nema prijedloga.</li>}
        {redovi.map((r) => (
          <li key={r.id} className="space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <strong>
                  k.o. {r.ko}, k.č. {r.kc}
                </strong>{" "}
                <span className="text-zinc-500">
                  · plan {r.godina}
                  {r.namjena ? ` · ${r.namjena}` : ""}
                </span>
              </p>
              <span className="text-xs text-zinc-400">{formatDate(r.createdAt)}</span>
            </div>
            <p>
              <span className="text-zinc-500">karta: {r.stanje ?? "—"} → prijedlog: </span>
              <strong>{VRSTE_ISPRAVKA[r.vrsta as VrstaIspravka] ?? r.vrsta}</strong>
            </p>
            {r.napomena && <p className="whitespace-pre-wrap text-zinc-700">„{r.napomena}”</p>}
            <div className="flex flex-wrap items-center gap-2">
              {r.lat !== null && r.lng !== null && (
                <Link
                  href={`/gup?prikaz=karta&c=${r.lat.toFixed(5)},${r.lng.toFixed(5)}&z=19`}
                  className="text-emerald-700 underline"
                  target="_blank"
                >
                  Na karti ↗
                </Link>
              )}
              {STATUSI_ISPRAVKA.filter((s) => s !== status).map((s) => (
                <form key={s} action={oznaciIspravak}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="rounded-full border border-zinc-300 px-3 py-0.5 text-xs hover:bg-zinc-100">
                    {s === "prihvaceno" ? "Prihvati" : s === "odbijeno" ? "Odbij" : "Vrati u nove"}
                  </button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
