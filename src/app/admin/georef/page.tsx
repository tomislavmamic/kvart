import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { GeorefClient, type Preview } from "./georef-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Smještanje listova planova" };

/**
 * Ručno georeferenciranje listova plana.
 *
 * Automatsko uklapanje radi kad list ima sloj granice obuhvata (DPU
 * Dračevac) ili rijetku grafiku nad praznom podlogom (UPU Bilice sjever).
 * Na gustim gradskim listovima poput GUP-a sve automatske metode — ISPU
 * obuhvat, fazna korelacija, glasanje po zgradama, toponimi — daju jednako
 * dobar rezultat za bilo koji položaj, pa je brže da list smjestiš rukom.
 */
export default async function GeorefPage() {
  // Alat za pripremu podataka, ne za moderiranje: čita samo PNG predloške s
  // diska, ne dira ni bazu ni korisničke podatke, a rezultat su konstante
  // koje se rukom prepišu u skriptu. Zato ne traži lozinku nego postoji
  // isključivo u razvoju — u produkcijskoj gradnji rute jednostavno nema.
  if (process.env.NODE_ENV !== "development") redirect("/");

  let previews: Preview[] = [];
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "geo", "planovi", "preview", "manifest.json"),
      "utf-8"
    );
    previews = JSON.parse(raw) as Preview[];
  } catch {
    previews = [];
  }

  return (
    <main className="mx-auto max-w-[110rem] p-4">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Smještanje listova planova</h1>
        <Link href="/admin" className="text-sm underline">
          ← Moderacija
        </Link>
      </header>

      {previews.length === 0 ? (
        <p className="rounded border border-black/10 bg-black/5 p-4 text-sm">
          Nema pripremljenih listova. Pokreni{" "}
          <code className="font-mono">python3 scripts/render-plan-previews.py</code>{" "}
          da se izrade PNG predlošci u <code>public/geo/planovi/preview/</code>.
        </p>
      ) : (
        <GeorefClient previews={previews} />
      )}
    </main>
  );
}
