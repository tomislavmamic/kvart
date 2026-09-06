import Link from "next/link";

import { Ruza } from "@/components/karepovac/ruza";
import { ODOUR_STRENGTH_SHORT, ODOUR_STRENGTHS } from "@/lib/constants";
import type { OdourStrength } from "@/lib/constants";
import { procitajSat } from "@/lib/dojava-vrijeme";
import {
  ruzaDojava,
  satiDojava,
  SEKTOR_IMENA,
  spojiVjetar,
  vjetarIzArhive,
  ZADNJI_SAT_LUKE,
  type RuzaDojava,
} from "@/lib/dojave";
import { createPageMetadata } from "@/lib/metadata";
import {
  getArchivedWind,
  getLatestArchivedWindAt,
  getOdourReports,
} from "@/lib/queries";

import { ObrazacDojave } from "./obrazac";
import { brojkeProvjere, postotak } from "./provjera";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Dojava mirisa",
  description:
    "Javite kada i gdje se osjetio miris — i kada nije. Svaka dojava dobiva sat, svaki sat svoj izmjereni vjetar; po dojavama se provjerava model na simulatoru.",
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
 * Tri odluke koje ispod obrasca vrijede:
 *
 * - **Vjetar je onaj koji doista postoji.** Dojave se spajaju s arhivom
 *   izmjerenih očitanja u bazi (`wind_readings`, ista prvenstva postaja kao
 *   satni vjetar), a generirani niz zračne luke je pričuva za sate prije
 *   arhive. Sat bez vjetra ostaje bez vjetra i to se kaže brojem — jer AZO
 *   objavljuje sat kasnije, a arhiva se puni samo kad stranicu netko posjeti.
 * - **Obrazac ne ovisi o bazi.** Čitanje dojava i arhive može pasti (hladni
 *   start, spavanje baze); tada se obrazac svejedno prikaže, a umjesto brojki
 *   stoji rečenica da ih trenutačno nema. Pad u samom prikazu hvata
 *   `error.tsx`, koji opet crta obrazac.
 * - **Brojke provjere modela su iz `docs/STATUS.json`**, pri gradnji, nikad iz
 *   koda — dojavitelj mora znati čemu dojava služi, a brojka koja bi stajala u
 *   kodu prestala bi biti istinita prvom sljedećom provjerom.
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

/** Koliko opažanja s vjetrom treba da se ruža uopće nacrta. */
const ZA_RUZU = 20;

type Upit = Record<string, string | string[] | undefined>;

function prvi(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Točka iz adrese (`?lat=…&lng=…`), kad je stigla iz simulatora; inače ništa. */
function mjestoIzAdrese(p: Upit) {
  const broj = (v: string | string[] | undefined) => {
    const n = Number(prvi(v));
    return Number.isFinite(n) ? n : null;
  };
  const lat = broj(p.lat);
  const lng = broj(p.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

type Zapis = {
  dojave: Awaited<ReturnType<typeof getOdourReports>>;
  ruza: RuzaDojava;
  /** Zadnji sat za koji negdje imamo izmjeren vjetar. */
  vjetarDo: Date;
};

/**
 * Sve što stoji ispod obrasca, ili `null` kad baza ne odgovara.
 *
 * Greška se ne baca: obrazac iznad ovoga ne treba bazu da bi se poslao.
 */
async function ucitajZapis(): Promise<Zapis | null> {
  try {
    const dojave = await getOdourReports();
    const [arhiva, zadnjiUArhivi] = await Promise.all([
      getArchivedWind(satiDojava(dojave)),
      getLatestArchivedWindAt(),
    ]);
    const ruza = ruzaDojava(dojave, spojiVjetar(vjetarIzArhive(arhiva)));
    const vjetarDo =
      zadnjiUArhivi && zadnjiUArhivi > ZADNJI_SAT_LUKE ? zadnjiUArhivi : ZADNJI_SAT_LUKE;
    return { dojave, ruza, vjetarDo };
  } catch (greska) {
    console.error("dojava: zapis ispod obrasca nije učitan", greska);
    return null;
  }
}

/** „4. 9. u 21 h”, u hrvatskom vremenu. */
function satMjesno(d: Date): string {
  const dio = new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const uzmi = (tip: string) => dio.find((p) => p.type === tip)?.value ?? "";
  return `${uzmi("day")}. ${uzmi("month")}. u ${uzmi("hour")} h`;
}

/** „2. 9. 2026.” — bez vodećih nula, koje `hr-HR` inače doda. */
function datumMjesno(iso: string): string {
  const dio = new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const uzmi = (tip: string) => String(Number(dio.find((p) => p.type === tip)?.value ?? ""));
  return `${uzmi("day")}. ${uzmi("month")}. ${uzmi("year")}.`;
}

function dojavaMnozina(n: number): string {
  return n === 1 ? "dojavu" : n < 5 ? "dojave" : "dojava";
}

export default async function DojavaPage({
  searchParams,
}: {
  searchParams?: Promise<Upit>;
}) {
  const upit = (await searchParams) ?? {};
  const pocetnoMjesto = mjestoIzAdrese(upit);
  const pocetniSat = procitajSat(prvi(upit.sat));
  const pocetnoSmrdi = prvi(upit.smrdi) !== "ne";
  const zapis = await ucitajZapis();
  const provjera = brojkeProvjere();

  const ruza = zapis?.ruza ?? null;
  const dovoljno = ruza !== null && ruza.uporabljeno >= ZA_RUZU;
  const vrh = ruza && dovoljno ? ruza.tezine.indexOf(Math.max(...ruza.tezine)) : null;

  const poJacini = Object.keys(ODOUR_STRENGTHS).map((kljuc) => ({
    kljuc: kljuc as OdourStrength,
    broj: zapis?.dojave.filter((d) => d.strength === kljuc).length ?? 0,
  }));
  const bezMirisa = zapis?.dojave.filter((d) => d.smelled === false).length ?? 0;

  // Udio se crta tek kad u ruži ima i tišine: bez nje bi svaki sektor imao
  // udio 1 i grafikon bi tvrdio da uvijek smrdi, što nitko nije javio.
  const imaTisine = ruza?.brojBez.some((n) => n > 0) ?? false;
  const udjeli = ruza?.udio.map((u) => u ?? 0) ?? [];

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-tight text-kamen-tinta">
        Kakav je zrak?
      </h1>
      <p className="mt-1 text-base leading-6 text-kamen-drugi">
        Javite i kad ne smrdi — bez tih sati se ne zna koliko često smrdi.
      </p>

      <div className="mt-4">
        <ObrazacDojave
          pocetnoMjesto={pocetnoMjesto}
          pocetniSat={pocetniSat}
          pocetnoSmrdi={pocetnoSmrdi}
        />
      </div>

      {ruza && dovoljno && vrh !== null && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-kamen-tinta">Ruža dojava</h2>
          <div className="mt-5">
            <Ruza
              vrijednosti={ruza.tezine}
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

      {ruza && dovoljno && imaTisine && (
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
              boja="var(--color-kamen-tekst)"
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
        {zapis === null ? (
          <p className="mt-4 text-base leading-7 text-kamen-drugi">
            Brojke trenutačno nisu dostupne — baza ne odgovara. Dojava se
            svejedno sprema.
          </p>
        ) : (
          <>
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
              {!dovoljno && ruza && (
                <div className="bg-white p-4">
                  <dt className="text-base text-kamen-drugi">
                    još do prve ruže
                  </dt>
                  <dd className="mt-1 text-2xl font-extrabold tabular-nums text-kamen-tinta">
                    {Math.max(0, ZA_RUZU - ruza.uporabljeno)}
                  </dd>
                </div>
              )}
            </dl>
            {ruza && ruza.bezVjetra > 0 && (
              <p className="mt-4 text-base leading-7 text-kamen-drugi">
                Za {ruza.bezVjetra} {dojavaMnozina(ruza.bezVjetra)} još čekamo
                izmjereni vjetar: sat koji još traje dobiva ga kad završi,
                postaje ga objave s otprilike sat vremena zakašnjenja, a u našu
                arhivu uđe kad netko pošalje dojavu ili otvori simulator.
                Vjetar zasad imamo do {satMjesno(zapis.vjetarDo)}.
              </p>
            )}
            {ruza && ruza.tisina > 0 && (
              <p className="mt-4 text-base leading-7 text-kamen-drugi">
                U {ruza.tisina} {ruza.tisina === 1 ? "javljenom satu" : "javljenih sati"}{" "}
                bilo je tiho — vjetra ispod pola metra u sekundi — pa nema
                smjera, a bez smjera ni kraka. {ruza.tisina === 1 ? "Taj sat" : "Ti sati"}{" "}
                {ruza.tisina === 1 ? "stoji" : "stoje"} zabilježen{ruza.tisina === 1 ? "" : "i"}, ali
                izvan ruže.
              </p>
            )}
            {!dovoljno && ruza && (
              <p className="mt-4 text-base leading-7 text-kamen-drugi">
                Za ružu treba barem dvadeset dojava sa satom za koji imamo
                izmjeren vjetar; dosad ih je {ruza.uporabljeno}. Ruža od pet
                izgledala bi kao nalaz, a bila bi slučaj — zato je dotad ne
                crtamo.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-kamen-tinta">Čemu dojava služi</h2>
        <p className="mt-2 text-base leading-7 text-kamen-tekst">
          Dojave su jedino mjerenje sa strane kvarta. Svaka dobiva svoj sat i
          izmjereni vjetar toga sata, a po njima se provjerava model na{" "}
          <Link
            href="/karepovac/sim"
            className="fokus rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
          >
            simulatoru
          </Link>
          : je li tvrdio miris ondje gdje ste ga vi osjetili — i je li ga
          tvrdio ondje gdje ga nije bilo.
        </p>
        {provjera ? (
          <p className="mt-3 text-base leading-7 text-kamen-tekst">
            Zadnja provjera ({datumMjesno(provjera.azurirano)}) stoji na{" "}
            {provjera.n} satnih opažanja iz dojava: model je pogodio{" "}
            {postotak(provjera.pod)} sati u kojima je netko javio miris, a{" "}
            {postotak(provjera.far)} sati u kojima je tvrdio miris nitko nije
            potvrdio. To je premalo dojava da se išta zaključi — zato svaka
            sljedeća vrijedi, i ona „nije smrdjelo”.
          </p>
        ) : (
          <p className="mt-3 text-base leading-7 text-kamen-tekst">
            Brojke zadnje provjere još nisu zapisane.
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
