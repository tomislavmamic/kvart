import Link from "next/link";
import { skupine, ucitajPromjene } from "@/lib/plan-promjene";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Što nacrt GUP-a mijenja u kvartu",
  description:
    "Usporedba namjene prostora iz GUP-a Splita na snazi i nacrta izmjena iz " +
    "2024. za Dračevac i Bilice — koliko se hektara mijenja, u što, i kojom " +
    "stavkom to nacrt sam obrazlaže.",
});

/** Hrvatski decimalni zarez — stranica je na hrvatskom, ne na engleskom. */
function ha(n: number): string {
  return n.toLocaleString("hr-HR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Hrvatska trojna množina: 1 ploha, 2–4 plohe, 5+ ploha (11–14 su iznimka). */
function plohe(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} ploha`;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return `${n} plohe`;
  return `${n} ploha`;
}

export default async function PlanPage() {
  const podaci = await ucitajPromjene();
  const nacrt = podaci?.razlike.find((r) => r.do_godine === 2024);

  if (!nacrt) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">Što nacrt GUP-a mijenja u kvartu</h1>
        <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm">
          Podaci o promjenama još nisu izrađeni. Pokreni{" "}
          <code className="font-mono">scripts/trace-plans.py</code>.
        </p>
      </div>
    );
  }

  const ukupno =
    Math.round(
      (nacrt.promjene ?? []).reduce((s, v) => s + v.ha, 0) * 10
    ) / 10;
  const stavke = nacrt.stavke ?? [];
  const pripisano =
    Math.round(stavke.reduce((s, v) => s + v.ha, 0) * 10) / 10;
  const nepripisano = Math.round((ukupno - pripisano) * 10) / 10;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Što nacrt GUP-a mijenja u kvartu</h1>

      <p className="mt-3 text-zinc-600">
        Grad Split izradio je nacrt izmjena i dopuna Generalnog urbanističkog
        plana i uputio ga u javnu raspravu 2024. Usporedili smo namjenu
        prostora iz tog nacrta s planom koji je danas na snazi, za područje
        Dračevca i Bilica — i, gdje nacrt to sam kaže, uz svaku promjenu
        stavili stavku kojom je obrazlaže.
      </p>

      <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="text-3xl font-bold text-amber-900">{ha(ukupno)} ha</p>
        <p className="mt-1 text-sm text-amber-900">
          mijenja namjenu u nacrtu iz 2024., na {nacrt.ploha} odvojenih
          površina. To je oko 2 % kvarta — nacrt ga ne prekraja, nego dira na
          nekoliko mjesta.
        </p>
      </div>

      {stavke.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b border-zinc-200 pb-2 text-xl font-bold">
            Kako to nacrt sam obrazlaže
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Nacrt uz izmijenjene plohe otiskuje broj stavke iz svog popisa
            izmjena, a tekst stavke je službeni opis odluke. Ovo su stavke koje
            padaju u naš kvart, doslovno onako kako su napisane — hektari su
            naši, iz ploha kojima taj broj stoji uz bok.
          </p>
          <ul className="mt-4 space-y-4">
            {stavke.map((s) => (
              <li
                key={s.broj}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-sm font-bold text-emerald-700">
                    stavka {s.broj}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-700">
                    {ha(s.ha)} ha · {plohe(s.ploha)}
                  </span>
                </div>
                <blockquote className="mt-2 border-l-2 border-emerald-200 pl-3 text-sm italic text-zinc-700">
                  {s.tekst}
                </blockquote>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                  {Object.entries(s.promjene)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <li key={k} className="tabular-nums">
                        {k} — {ha(v)} ha
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          {nepripisano > 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              Preostalih {ha(nepripisano)} ha nacrt ne veže ni uz jednu stavku
              koja se tiče kvarta, pa ih ovdje ne pripisujemo nagađanjem.
              Vidljive su na karti i u razradi ispod.
            </p>
          )}
        </section>
      )}

      <h2 className="mt-12 text-xl font-bold">Što to znači u kvartu</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Iste te promjene, sve do zadnje, složene po tome što stanaru znače.
      </p>

      {skupine(nacrt).map((s) => (
        <section key={s.id} className="mt-8">
          <h2 className="flex items-baseline justify-between gap-4 border-b border-zinc-200 pb-2">
            <span className="text-xl font-bold">{s.naslov}</span>
            <span className="shrink-0 text-lg font-semibold tabular-nums text-zinc-700">
              {ha(s.ha)} ha
            </span>
          </h2>
          <p className="mt-2 text-sm text-zinc-600">{s.objasnjenje}</p>
          <ul className="mt-3 space-y-1">
            {s.stavke.map((x) => (
              <li
                key={`${x.iz_kod}→${x.u_kod}`}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <span>
                  {x.iz} <span className="text-zinc-400">→</span> {x.u}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {ha(x.ha)} ha
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-8">
        <Link href="/karta" className="font-semibold text-emerald-700 underline">
          Pogledaj na karti →
        </Link>{" "}
        <span className="text-sm text-zinc-500">(pogled „Nacrt GUP-a”)</span>
      </p>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <h2 className="font-bold text-zinc-800">Odakle brojke i što im je granica</h2>
        <p className="mt-2">
          Ovakva usporedba nije naša dosjetka nego jedini put koji nacrt
          ostavlja. U napomeni na svom grafičkom prilogu piše da su na njemu
          prikazane samo najbitnije izmjene, a onda i:
        </p>
        <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 italic">
          „Potpuni uvid u izmjene i dopune grafičkog dijela Plana je moguć
          jedino na temelju usporedbe svakog pojedinačnog kartografskog prikaza
          Prijedloga izmjena i dopuna Plana s odgovarajućim kartografskim
          prikazom važećeg Plana.”
        </blockquote>
        <p className="mt-2">
          Upravo to smo napravili. Plan je objavljen samo kao PDF, bez podataka
          koji se daju upitati, pa smo listove georeferencirali, plohe namjene
          izvukli iz same karte, a slovne oznake (M1, K3, Z5…) pročitali s
          lista, jer plan nekim namjenama daje istu boju. Postupak je u{" "}
          <code className="font-mono">scripts/trace-plans.py</code>.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Granice ploha točne su na oko ±5 m. Dovoljno da se vidi što se
            gdje mijenja, premalo da se raspravlja o pojedinoj čestici.
          </li>
          <li>
            Brojevi stavki gore otisnuti su na samom listu, uz plohe na koje se
            odnose. Vezali smo ih uz promjenu samo kad stavka govori baš o toj
            namjeni i kad je oznaka unutar 80 m; ostale promjene ostaju bez
            pripisa umjesto da im se pridjene najbliži tekst.
          </li>
          <li>
            Ondje gdje čitanje oznake nije uspjelo namjena je ostala spojena
            (npr. „I/K”); takve plohe nisu uvrštene u skupine gore.
          </li>
          <li>
            Nacrt iz 2024. povučen je nakon javne rasprave i nije donesen.
            Prikazuje što je bilo predloženo, ne što je na snazi.
          </li>
        </ul>
      </section>
    </div>
  );
}
