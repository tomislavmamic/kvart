import Link from "next/link";
import { getStats, getRecentUpdates } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { WHATSAPP_URL } from "@/components/whatsapp-button";
import { loadHomepageData } from "@/lib/homepage-data";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const data = await loadHomepageData(getStats, () => getRecentUpdates(5));

  // Random start point for the hero pan so it doesn't always begin at the
  // west (Bilice) edge. Negative delay starts the animation mid-cycle; the
  // full there-and-back cycle is 180s (90s each way). Fresh per request.
  //
  // react-hooks/purity flags Math.random() in render, and for a client
  // component it would be right — server and client would disagree at
  // hydration. This is a server component on a force-dynamic page: the value
  // is drawn once per request, baked into the HTML, and never re-rendered on
  // the client, so there is nothing to mismatch. Moving it to an effect would
  // only add a visible jump from the west edge to the random offset.
  // eslint-disable-next-line react-hooks/purity
  const heroPanDelay = `-${(Math.random() * 180).toFixed(1)}s`;

  return (
    <div className="space-y-12">
      {/* Maketa A — puni format: satelitska traka Bilice—Dračevac preko cijele
          širine i visine, dijagonalno zatamnjenje slijeva, tekst dolje-lijevo.
          Traka se probija iz sredinskog kontejnera na punu širinu ekrana.
          (DOF 2023, geoportal.dgu.hr, Otvorena dozvola — atribucija je uvjet.) */}
      <section className="hero-viewport relative left-1/2 -ml-[50vw] -mt-8 w-screen overflow-hidden bg-emerald-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/kvart-strip.jpg"
          alt="Zračna snimka Dračevca i Bilica"
          className="hero-pan absolute inset-y-0 left-0 h-full w-auto max-w-none"
          style={{ animationDelay: heroPanDelay }}
        />
        {/* Mobil: zatamnjenje pri dnu. Desktop: dijagonalno slijeva. */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/45 to-transparent sm:hidden" />
        <div className="absolute inset-0 hidden sm:block sm:bg-[linear-gradient(75deg,rgba(2,44,34,0.9)_0%,rgba(2,44,34,0.55)_36%,rgba(2,44,34,0.06)_63%,transparent_80%)]" />

        <div className="relative mx-auto flex min-h-[82vh] max-w-5xl flex-col justify-end px-4 pb-14 pt-28 sm:min-h-[86vh] sm:px-6">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Dračevac · Bilice · Split
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              Ovo je naš kvart.
              <br />
              Učinimo ga boljim.
            </h1>
            <p className="mt-4 text-lg text-emerald-50/90">
              Prijavi problem, prati što je poslano Gradu i što je riješeno.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/prijavi"
                className="rounded-full bg-white px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Prijavi problem
              </Link>
              {WHATSAPP_URL && (
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  WhatsApp grupa
                </a>
              )}
            </div>
          </div>
        </div>

        <a
          href="https://geoportal.dgu.hr"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-4 text-[11px] text-white/70 hover:text-white"
        >
          DOF 2023 · Državna geodetska uprava
        </a>
      </section>

      {!data.available && (
        <section
          role="status"
          className="rounded-xl border border-kamen-rub bg-status-u-tijeku-ground px-4 py-3 text-sm text-status-u-tijeku"
        >
          Evidencija prijedloga trenutačno nije dostupna. Karta i ostali javni
          sadržaji i dalje rade.
        </section>
      )}

      <section className="grid grid-cols-3 gap-4">
        <Stat value={data.stats?.rijeseno ?? null} label="riješeno" />
        <Stat value={data.stats?.uTijeku ?? null} label="u tijeku ili kod Grada" />
        <Stat value={data.stats?.ukupno ?? null} label="ukupno prijedloga" />
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Najnovije aktivnosti</h2>
          <Link
            href="/prijedlozi"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Svi prijedlozi →
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {!data.available && (
            <li className="p-5 text-sm text-zinc-500">
              Aktivnosti će se prikazati kad evidencija ponovno bude dostupna.
            </li>
          )}
          {data.available && data.updates.length === 0 && (
            <li className="p-5 text-sm text-zinc-500">
              Još nema objavljenih prijedloga. Budite prvi —{" "}
              <Link href="/prijavi" className="text-emerald-700 underline">
                prijavite problem
              </Link>
              .
            </li>
          )}
          {data.updates?.map((u) => (
            <li key={u.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <Link
                  href={`/prijedlozi/${u.proposalSlug}`}
                  className="font-medium hover:underline"
                >
                  {u.proposalTitle}
                </Link>
                {u.note && (
                  <p className="mt-0.5 text-sm text-zinc-600">{u.note}</p>
                )}
                <p className="mt-0.5 text-xs text-zinc-400">
                  {formatDate(u.createdAt)}
                </p>
              </div>
              <StatusBadge status={u.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xl font-bold">Kako ovo funkcionira?</h2>
        <ol className="mt-4 grid gap-4 text-sm text-zinc-700 sm:grid-cols-3">
          <li className="rounded-lg bg-zinc-50 p-4">
            <span className="font-bold text-emerald-700">1. Prijavite</span>
            <p className="mt-1">
              Ispunite kratki obrazac — bez registracije. Moderatori pregledavaju
              i objavljuju prijave.
            </p>
          </li>
          <li className="rounded-lg bg-zinc-50 p-4">
            <span className="font-bold text-emerald-700">2. Raspravite</span>
            <p className="mt-1">
              Razgovor i dogovor idu u WhatsApp grupi kvarta — ondje se najbrže
              vidi koga još muči isto.
            </p>
          </li>
          <li className="rounded-lg bg-zinc-50 p-4">
            <span className="font-bold text-emerald-700">3. Pratite</span>
            <p className="mt-1">
              Javno bilježimo kad je prijedlog poslan Gradu i svaki odgovor —
              do rješenja.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
      <div className="text-3xl font-bold text-emerald-700">{value ?? "—"}</div>
      <div className="mt-1 text-xs text-zinc-500 sm:text-sm">{label}</div>
    </div>
  );
}
