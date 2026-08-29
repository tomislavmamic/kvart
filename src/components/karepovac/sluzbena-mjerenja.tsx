import { Ruza } from "@/components/karepovac/ruza";
import {
  POSTAJE,
  POSTAJE_VJETRA,
  VRH_PLOHE,
} from "@/generated/karepovac-karta";
import { MJERENJA } from "@/generated/karepovac-mjerenja";
import { SEKTOR_IMENA as RUZA_IMENA } from "@/lib/dojave";

const [K1, K2] = MJERENJA.postaje;

/** Sjeverozapad; smjer u kojem s postaje leži tijelo odlagališta. */
const SMJER_PLOHE = 14;

const BOJE = { h2s: "#007956", merkaptani: "#6d28d9" } as const;

const MJESECI = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
] as const;

/** Imena tvari kako ih piše Zavod, u obliku koji se da pročitati naglas. */
const IMENA_TVARI: Record<string, string> = {
  H2S: "Sumporovodik (H₂S)",
  NH3: "Amonijak (NH₃)",
  NO2: "Dušikov dioksid (NO₂)",
  SO2: "Sumporov dioksid (SO₂)",
  "metil+etilmerkaptan": "Metil- i etilmerkaptan",
};

function imeTvari(naziv: string) {
  return IMENA_TVARI[naziv] ?? naziv;
}

function mjesecGodina(t: string) {
  return `${MJESECI[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}.`;
}

function brojka(x: number, decimala = 2) {
  return x.toLocaleString("hr-HR", {
    minimumFractionDigits: decimala,
    maximumFractionDigits: decimala,
  });
}

/** Dvije postaje koje već stoje na Karepovcu i što svaka mjeri. */
export function SluzbenePostaje() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-2">
      {MJERENJA.postaje.map((postaja) => (
        <div key={postaja.oznaka} className="bg-white p-6">
          <h3 className="text-xl font-bold text-kamen-tinta">{postaja.naziv}</h3>
          <p className="mt-1 text-base leading-7 text-kamen-drugi">
            {postaja.opis} · objavljuje od {mjesecGodina(postaja.od)}
          </p>
          <dl className="mt-5 space-y-3">
            {postaja.tvari.map((tvar) => (
              <div key={tvar.naziv} className="flex items-baseline justify-between gap-4">
                <dt className="text-base text-kamen-tekst">
                  {imeTvari(tvar.naziv)}
                </dt>
                <dd className="shrink-0 text-base tabular-nums text-kamen-drugi">
                  <span className="font-semibold text-kamen-tinta">
                    {brojka(tvar.medijan)}
                  </span>{" "}
                  medijan · {brojka(tvar.najvise, 1)} najviše
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-base leading-7 text-kamen-drugi">
            Sve u µg/m³, osim ugljikova monoksida u mg/m³. Satne vrijednosti,
            objavljene bez naknadne provjere. Medijan 0,05 znači da je tvari
            više od polovice vremena bilo ispod granice određivanja.
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Gdje postaje zapravo stoje — i zašto je to glavna ograda oko modela.
 *
 * Dugo smo znali samo zaokruženu koordinatu iz očevidnika (43,516 / 16,517,
 * dakle na ~100 m). Točka je sada nađena na terenu i provjerena u LiDAR
 * reljefu, i pokazuje ono što se iz zaokružene brojke nije vidjelo: postaja
 * nije „uz plohu” u smislu „između plohe i kvarta”. Stoji u udolini prema
 * Kamenu, na suprotnoj strani odlagališta, i sedamdesetak metara niže od
 * njegova vrha.
 *
 * To ne obezvrjeđuje mjerenje — ono je i dalje jedino satno mjerenje koje o
 * ovom odlagalištu postoji. Mijenja se što se iz njega smije zaključiti: ono
 * bilježi sate kad zrak s plohe ide prema jugoistoku, a Dračevac i Bilice su
 * na suprotnu stranu. Zato slaba veza između modela i mjerenja nije dokaz da
 * modela nema, nego posljedica toga da mu se prijemnik nalazi drugdje.
 */
export function MjestoPostaje() {
  const p = POSTAJE[0];
  const razlika = Math.round(VRH_PLOHE - p.visina);
  const stavke: [string, string][] = [
    ["Koordinate", `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`],
    ["Nadmorska visina", `${p.visina} m — vrh plohe je ${razlika} m više`],
    ["Od sredine plohe", `${p.odPlohe} m, azimut ${p.azimut}°`],
    [
      "Kut prema kvartu",
      `${p.kutDracevac}° do smjera Dračevca, ${p.kutBilice}° do Bilica`,
    ],
  ];

  return (
    <figure className="rounded-xl border border-kamen-tlo bg-white p-6">
      <figcaption className="text-xl font-bold text-kamen-tinta">
        Obje postaje stoje na istoj točki — i to s druge strane odlagališta
      </figcaption>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        Nije riječ o mjestu između odlagališta i kvarta. Postaja je u udolini
        jugoistočno od plohe, prema Kamenu. Gledano sa sredine odlagališta,
        smjer prema postaji i smjer prema Dračevcu razilaze se za{" "}
        {p.kutDracevac}° — dakle gotovo suprotne strane.
      </p>
      <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-kamen-rub bg-kamen-rub text-base sm:grid-cols-2">
        {stavke.map(([naziv, vrijednost]) => (
          <div key={naziv} data-kind="official" className="bg-white p-4">
            <dt className="font-semibold text-kamen-tinta">{naziv}</dt>
            <dd className="mt-0.5 text-kamen-tekst">{vrijednost}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 max-w-2xl text-base leading-7 text-kamen-drugi">
        Zato se ovo mjerenje ne smije čitati kao mjerenje kvarta. Ono bilježi
        sate u kojima zrak s plohe ide prema jugoistoku. Sati u kojima ide na
        Dračevac i Bilice na njemu se vide slabo ili nikako — a upravo je na
        tom nizu bazdarena jačina izvora u modelu raspršenja.
      </p>
    </figure>
  );
}

/**
 * Anemometri: jedini izmjeren ulaz modela.
 *
 * Vrijedi ih staviti uz mjesto mjerne postaje, jer su to dvije polovice iste
 * ograde. Plin se mjeri na jednoj točki s krive strane odlagališta, a državni
 * anemometri stoje četiri do šesnaest kilometara zapadno. Od 29. 8. 2026. tu
 * su i Neverinove postaje (uz pisano dopuštenje vlasnika, s navođenjem
 * izvora), pa najbliži anemometar stoji na 1,1 km — no na samom Karepovcu i
 * dalje se ne mjeri ni plin ni vjetar.
 *
 * Zračna luka i DHMZ-ov „Split-aerodrom” stoje na istom mjestu i zato se ovdje
 * spajaju u jedan redak — dva retka s istim koordinatama izgledala bi kao dva
 * mjerača, a mjerač je jedan.
 */
export function VjetrokaziOkoKvarta() {
  const redci = POSTAJE_VJETRA.filter((p) => p.oznaka !== "aerodrom");

  return (
    <figure className="rounded-xl border border-kamen-tlo bg-white p-6">
      <figcaption className="text-xl font-bold text-kamen-tinta">
        Vjetar se mjeri od 1,1 do 16 km od kvarta, nijednom na Karepovcu
      </figcaption>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        Smjer i brzina vjetra jedino su što u modelu doista netko izmjeri —
        polje strujanja, dubina sloja i jačina izvora su izvodi. Obje postaje uz
        plohu u AZO-ovoj bazi za vjetar vraćaju prazno, pa se uzima najbliža
        koja ga objavljuje. Najbliže četiri javljaju preko{" "}
        <a
          className="fokus rounded-sm font-medium text-maslina underline decoration-maslina-rub underline-offset-2 hover:text-maslina-tamna"
          href="https://www.neverin.hr"
          rel="noopener"
        >
          Neverin.hr
        </a>
        , uz dopuštenje vlasnika mreže.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-base">
          <thead>
            <tr className="border-b border-kamen-tlo text-left">
              <th className="py-2 pr-4 font-semibold text-kamen-tinta">Postaja</th>
              <th className="py-2 pr-4 font-semibold text-kamen-tinta">Tko je vodi</th>
              <th className="py-2 pr-4 text-right font-semibold text-kamen-tinta">
                Od kvarta
              </th>
              <th className="py-2 text-right font-semibold text-kamen-tinta">Smjer</th>
            </tr>
          </thead>
          <tbody>
            {redci.map((p) => (
              <tr key={p.oznaka} className="border-b border-kamen-rub last:border-0">
                <td className="py-2 pr-4 text-kamen-tinta">{p.naziv}</td>
                <td className="py-2 pr-4 text-kamen-drugi">{p.mreza}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-kamen-tekst">
                  {p.odKvartaKm.toLocaleString("hr-HR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  km
                </td>
                <td className="py-2 text-right tabular-nums text-kamen-tekst">
                  {p.azimutOdKvarta}°
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 max-w-2xl text-base leading-7 text-kamen-drugi">
        Zračna luka, jedina koja uvijek javi, leži iza Kozjaka i opisuje
        kaštelansko polje, a ne našu padinu — zato u redoslijedu stoji
        posljednja iako je najpouzdanija u dostupnosti. Neverinove postaje
        kroz provjeru na plinu još nisu prošle, jer im arhive nema: Vrboran
        vodi kartu zbog blizine i koraka od pet minuta, i to otvoreno piše u
        redoslijedu. Koordinate su provjerene: Split-2 i Split-3 na terenu,
        Marjan iz DHMZ-ova popisa, zračna luka iz istog METAR servisa iz
        kojega dolazi i vjetar, Neverinove iz njegova API-ja.
      </p>
    </figure>
  );
}

/** Dnevni hod dviju tvari s istog odlagališta — i suprotan je. */
export function DnevniHod() {
  return (
    <figure className="rounded-xl border border-kamen-tlo bg-white p-6">
      <figcaption className="text-xl font-bold text-kamen-tinta">
        Dvije tvari s istog odlagališta, dva suprotna dana
      </figcaption>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        Sumporovodik je najviši noću, kad se zrak ne miješa. Merkaptani — ono
        što nos zapravo prepoznaje kao smrad odlagališta — najviši su sredinom
        dana, kad se na plohi radi. Prvo ovisi o vremenu, drugo o poslu.
      </p>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <Krivulja
          naslov="Sumporovodik (H₂S)"
          podnaslov="Karepovac 1 · prosjek po satu dana"
          vrijednosti={[...K1.dnevniHod]}
          boja={BOJE.h2s}
        />
        <Krivulja
          naslov="Merkaptani"
          podnaslov="Karepovac 2 · prosjek po satu dana"
          vrijednosti={[...K2.dnevniHod]}
          boja={BOJE.merkaptani}
        />
      </div>
      <Tablica
        naslov="Brojke iza dijagrama"
        zaglavlje={["Sat", "H₂S", "Merkaptani"]}
        redci={K1.dnevniHod.map((x, i) => [
          `${i}–${i + 1} h`,
          brojka(x),
          brojka(K2.dnevniHod[i]),
        ])}
      />
    </figure>
  );
}

function Krivulja({
  naslov,
  podnaslov,
  vrijednosti,
  boja,
}: {
  naslov: string;
  podnaslov: string;
  vrijednosti: number[];
  boja: string;
}) {
  const W = 320;
  const H = 158;
  const LIJEVO = 38;
  const DOLJE = 22;
  const GORE = 10;
  const vrh = Math.ceil(Math.max(...vrijednosti) * 1.15 * 2) / 2;
  const x = (i: number) => LIJEVO + (i / 23) * (W - LIJEVO - 6);
  const y = (v: number) => GORE + (H - DOLJE - GORE) * (1 - v / vrh);
  const put = vrijednosti.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const ploha = `${put} L${x(23)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const najvisi = vrijednosti.indexOf(Math.max(...vrijednosti));
  const najnizi = vrijednosti.indexOf(Math.min(...vrijednosti));

  return (
    <div>
      <h4 className="font-bold text-kamen-tinta">{naslov}</h4>
      <p className="mt-1 text-base leading-6 text-kamen-drugi">{podnaslov}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${naslov}: najviše u ${najvisi}. satu, najniže u ${najnizi}. satu.`}
      >
        {[0, vrh / 2, vrh].map((v) => (
          <g key={v}>
            <line
              x1={LIJEVO}
              x2={W - 6}
              y1={y(v)}
              y2={y(v)}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <text x={LIJEVO - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#71717b">
              {brojka(v)}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={x(h)}
            y={H - 6}
            textAnchor="middle"
            fontSize="11"
            fill="#71717b"
          >
            {h}h
          </text>
        ))}
        <path d={ploha} fill={boja} fillOpacity="0.12" />
        <path d={put} fill="none" stroke={boja} strokeWidth="2" strokeLinejoin="round" />
        {[najvisi, najnizi].map((i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(vrijednosti[i])} r="4.5" fill="white" />
            <circle cx={x(i)} cy={y(vrijednosti[i])} r="3.5" fill={boja} />
          </g>
        ))}
        {vrijednosti.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="7" fill="transparent">
            <title>{`${i}–${i + 1} h: ${brojka(v)} µg/m³`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-2 text-base leading-6 text-kamen-drugi">
        Najviše u {najvisi}. satu ({brojka(vrijednosti[najvisi])}), najniže u{" "}
        {najnizi}. satu ({brojka(vrijednosti[najnizi])}) µg/m³.
      </p>
    </div>
  );
}

/** Ruža: odakle puše kad se H₂S osjeti, i leži li ondje ploha. */
export function RuzaMirisa() {
  const srednje: number[] = [...K1.ruza.srednje];
  const vrh = Math.max(...srednje);
  const dno = Math.min(...srednje);
  const najjaci = srednje.indexOf(vrh);
  const najslabiji = srednje.indexOf(dno);

  return (
    <figure className="rounded-xl border border-kamen-tlo bg-white p-6">
      <figcaption className="text-xl font-bold text-kamen-tinta">
        Kad se H₂S osjeti, vjetar dolazi s odlagališta
      </figcaption>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        Svaki krak je prosječni sumporovodik u satima kad je vjetar puhao iz tog
        smjera. Tijelo odlagališta leži sjeverozapadno od postaje — i ondje je
        vrh. To znači da mjerenje i vjetar govore isto, i zato uzimamo izmjereni
        vjetar sa zračne luke umjesto preračuna iz modela, koji vrh stavlja
        četrdesetak stupnjeva ustranu.
      </p>
      <div className="mt-6 grid items-center gap-8 sm:grid-cols-[minmax(0,320px)_1fr]">
        <Ruza
          vrijednosti={srednje}
          boja={BOJE.h2s}
          opisZaCitac={`Ruža sumporovodika: najviši prosjek pri vjetru iz smjera ${RUZA_IMENA[najjaci]}.`}
          opisi={srednje.map(
            (v, i) => `${RUZA_IMENA[i]}: ${brojka(v)} µg/m³ u ${K1.ruza.sati[i]} sati`,
          )}
          biljeg={{ sektor: SMJER_PLOHE, naziv: "ploha" }}
        />
        <div>
          <dl className="space-y-4">
            <div>
              <dt className="text-base text-kamen-drugi">
                Najviši prosjek, vjetar iz smjera {RUZA_IMENA[najjaci]}
              </dt>
              <dd className="text-2xl font-bold tabular-nums text-kamen-tinta">
                {brojka(vrh)} µg/m³
              </dd>
            </div>
            <div>
              <dt className="text-base text-kamen-drugi">
                Najniži prosjek, vjetar iz smjera {RUZA_IMENA[najslabiji]}
              </dt>
              <dd className="text-2xl font-bold tabular-nums text-kamen-tinta">
                {brojka(dno)} µg/m³
              </dd>
            </div>
          </dl>
          <p className="mt-4 max-w-sm text-base leading-7 text-kamen-drugi">
            Razlika je stvarna, ali skromna — puta{" "}
            {brojka(vrh / dno)}. Smjer vjetra dakle nije glavno što odlučuje
            hoće li se osjetiti; dnevni hod iznad pokazuje da je to koliko se
            zrak miješa.
          </p>
          <Tablica
            naslov="Brojke iza ruže"
            zaglavlje={["Vjetar iz", "H₂S", "Sati"]}
            redci={srednje.map((v, i) => [
              RUZA_IMENA[i],
              brojka(v),
              String(K1.ruza.sati[i]),
            ])}
          />
        </div>
      </div>
    </figure>
  );
}

function Tablica({
  naslov,
  zaglavlje,
  redci,
}: {
  naslov: string;
  zaglavlje: string[];
  redci: string[][];
}) {
  return (
    <details className="mt-5">
      <summary className="fokus cursor-pointer rounded text-base font-semibold text-maslina">
        {naslov}
      </summary>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-kamen-tlo">
        <table className="w-full text-left text-base tabular-nums">
          <thead className="bg-kamen-plitko">
            <tr>
              {zaglavlje.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold text-kamen-tinta">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {redci.map((red) => (
              <tr key={red[0]} className="border-t border-kamen-tlo">
                {red.map((c, i) => (
                  <td key={i} className="px-3 py-1.5 text-kamen-tekst">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
