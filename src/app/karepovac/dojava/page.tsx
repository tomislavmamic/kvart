import Link from "next/link";

import { Ruza } from "@/components/karepovac/ruza";
import { ODOUR_STRENGTH_SHORT, ODOUR_STRENGTHS } from "@/lib/constants";
import type { OdourStrength } from "@/lib/constants";
import { ruzaDojava, SEKTOR_IMENA } from "@/lib/dojave";
import { createPageMetadata } from "@/lib/metadata";
import { getOdourReports } from "@/lib/queries";

import { ObrazacDojave } from "./obrazac";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Dojava mirisa",
  description:
    "Javite kada i gdje se osjetio miris. Svaka dojava dobiva sat, svaki sat svoj izmjereni vjetar — i iz toga izlazi ruža koja ne ovisi ni o kakvom modelu.",
});

/**
 * Stranica za dojavu: obrazac i ništa što ga odvlači.
 *
 * Ovdje se ne objašnjava projekt i ne nudi se hodanje po njemu. Dojava se
 * javlja u trenutku u kojem netko stoji vani i osjeti miris — najčešće s
 * mobitela, iz poveznice ili s QR-a na letku — i tada je svaka druga
 * ponuđena poveznica prilika da se odustane. Zato stranica nema ni traku
 * projekta ni uvodne odlomke: obrazac stane na zaslon, a ono što je dosad
 * javljeno stoji ispod njega, za onoga tko dopusti klizanje.
 *
 * Objašnjenja žive na `/karepovac/zrak`, gdje im je i mjesto: ondje čitatelj
 * bira hoće li čitati, a ovdje je došao nešto javiti.
 */

/**
 * Smjer iz kojega puše vjetar koji nosi zrak s Karepovca na kvart.
 *
 * Odlagalište leži 1,1 km istočno-jugoistočno od sredine kvarta, na 112°, pa
 * ga donosi vjetar iz istog smjera. To je predviđanje koje ruža dojava
 * provjerava — i može ga opovrgnuti.
 */
const SEKTOR_KAREPOVCA = 5;

/** Točka iz adrese (`?lat=…&lng=…`), kad je stigla iz simulatora; inače ništa. */
function mjestoIzAdrese(p: Record<string, string | string[] | undefined>) {
  const broj = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) ? n : null;
  };
  const lat = broj(p.lat);
  const lng = broj(p.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export default async function DojavaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const pocetnoMjesto = mjestoIzAdrese((await searchParams) ?? {});
  const dojave = await getOdourReports();
  const ruza = ruzaDojava(dojave);
  const dovoljno = ruza.uporabljeno >= 20;
  const vrh = dovoljno ? ruza.tezine.indexOf(Math.max(...ruza.tezine)) : null;

  const poJacini = Object.keys(ODOUR_STRENGTHS).map((kljuc) => ({
    kljuc: kljuc as OdourStrength,
    broj: dojave.filter((d) => d.strength === kljuc).length,
  }));
  const bezMirisa = dojave.filter((d) => d.smelled === false).length;

  // Udio se crta tek kad u ruži ima i tišine: bez nje bi svaki sektor imao
  // udio 1 i grafikon bi tvrdio da uvijek smrdi, što nitko nije javio.
  const imaTisine = ruza.brojBez.some((n) => n > 0);
  const udjeli = ruza.udio.map((u) => u ?? 0);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-tight text-kamen-tinta">
        Kakav je zrak bio?
      </h1>

      <div className="mt-4">
        <ObrazacDojave pocetnoMjesto={pocetnoMjesto} />
      </div>

      {dovoljno && vrh !== null && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-kamen-tinta">Ruža dojava</h2>
          <div className="mt-5">
            <Ruza
              vrijednosti={ruza.tezine}
              boja="#6d28d9"
              opisZaCitac={`Ruža dojava: najviše ih je pri vjetru iz smjera ${SEKTOR_IMENA[vrh]}.`}
              opisi={ruza.tezine.map(
                (_, i) => `${SEKTOR_IMENA[i]}: ${ruza.broj[i]} dojava da je smrdjelo`,
              )}
              biljeg={{ sektor: SEKTOR_KAREPOVCA, naziv: "Karepovac" }}
            />
          </div>
          <p className="mt-4 text-base leading-7 text-kamen-tekst">
            Najviše dojava pri vjetru iz smjera {SEKTOR_IMENA[vrh]}.{" "}
            {vrh === SEKTOR_KAREPOVCA
              ? "To je smjer u kojem leži Karepovac."
              : `Karepovac leži u smjeru ${SEKTOR_IMENA[SEKTOR_KAREPOVCA]} — to nije neuspjeh nego nalaz.`}
          </p>
        </section>
      )}

      {dovoljno && imaTisine && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-kamen-tinta">
            Koliko često je smrdjelo
          </h2>
          <p className="mt-2 text-base leading-7 text-kamen-tekst">
            Od svih javljenih sati, u kolikom ih je dijelu smrdjelo — po smjeru
            iz kojega je tada puhalo.
          </p>
          <div className="mt-5">
            <Ruza
              vrijednosti={udjeli}
              boja="#0f766e"
              opisZaCitac="Ruža udjela: u kolikom je dijelu javljenih sati smrdjelo, po smjeru vjetra."
              opisi={ruza.udio.map((u, i) =>
                u === null
                  ? `${SEKTOR_IMENA[i]}: nitko nije javio`
                  : `${SEKTOR_IMENA[i]}: smrdjelo u ${Math.round(u * 100)} % od ${ruza.broj[i] + ruza.brojBez[i]} javljenih sati`,
              )}
              biljeg={{ sektor: SEKTOR_KAREPOVCA, naziv: "Karepovac" }}
            />
          </div>
          <p className="mt-4 text-base leading-7 text-kamen-tekst">
            Prazan krak znači da za taj smjer nitko nije javio — ne da nije
            smrdjelo.
          </p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-bold text-kamen-tinta">Dosad javljeno</h2>
        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo">
          {poJacini.map(({ kljuc, broj }) => (
            <div key={kljuc} className="bg-white p-4">
              <dt className="text-base text-kamen-drugi">
                {ODOUR_STRENGTH_SHORT[kljuc]}
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-kamen-tinta">
                {broj}
              </dd>
            </div>
          ))}
          <div className="bg-white p-4">
            <dt className="text-base text-kamen-drugi">nije smrdjelo</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-kamen-tinta">
              {bezMirisa}
            </dd>
          </div>
          {!dovoljno && (
            <div className="bg-white p-4">
              <dt className="text-base text-kamen-drugi">
                još do prve ruže
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-kamen-tinta">
                {Math.max(0, 20 - ruza.uporabljeno)}
              </dd>
            </div>
          )}
        </dl>
        {!dovoljno && (
          <p className="mt-4 text-base leading-7 text-kamen-drugi">
            Za ružu treba barem dvadeset dojava sa satom za koji imamo izmjeren
            vjetar. Ruža od pet izgledala bi kao nalaz, a bila bi slučaj — zato
            je dotad ne crtamo.
          </p>
        )}
      </section>

      <p className="mt-12 text-base leading-7 text-kamen-drugi">
        <Link
          href="/karepovac/zrak"
          className="fokus rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
        >
          Što radimo s dojavama →
        </Link>
      </p>
    </div>
  );
}
