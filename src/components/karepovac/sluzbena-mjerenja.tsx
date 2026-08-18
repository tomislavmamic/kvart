import { MJERENJA } from "@/generated/karepovac-mjerenja";

const [K1, K2] = MJERENJA.postaje;

/** Sjeverozapad; smjer u kojem s postaje leži tijelo odlagališta. */
const SMJER_PLOHE = 14;

const RUZA_IMENA = [
  "S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
  "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ",
] as const;

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

const STRANE = [
  { oznaka: "S", sektor: 0 },
  { oznaka: "I", sektor: 4 },
  { oznaka: "J", sektor: 8 },
  { oznaka: "Z", sektor: 12 },
] as const;

/** Točka na krugu za zadani sektor ruže; sjever je gore, kut raste na istok. */
function uKrugu(sredina: number, polumjer: number, sektor: number) {
  const kut = ((sektor * 360) / 16 - 90) * (Math.PI / 180);
  return [
    sredina + polumjer * Math.cos(kut),
    sredina + polumjer * Math.sin(kut),
  ] as const;
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
  const S = 340;
  const sredina = S / 2;
  const unutra = 32;
  const izvana = 118;
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
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="w-full max-w-[320px]"
          role="img"
          aria-label={`Ruža sumporovodika: najviši prosjek pri vjetru iz smjera ${RUZA_IMENA[najjaci]}.`}
        >
          <circle cx={sredina} cy={sredina} r={izvana} fill="#fafafa" />
          {[0.5, 1].map((u) => (
            <circle
              key={u}
              cx={sredina}
              cy={sredina}
              r={unutra + (izvana - unutra) * u}
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="1"
            />
          ))}
          {srednje.map((v, i) => {
            const udio = (v - dno * 0.9) / (vrh - dno * 0.9);
            const duljina = unutra + (izvana - unutra) * udio;
            const kut = (i * 360) / 16;
            const sirina = 9;
            return (
              <g key={i} transform={`rotate(${kut} ${sredina} ${sredina})`}>
                <path
                  d={`M${sredina - sirina} ${sredina - unutra} L${sredina + sirina} ${sredina - unutra} L${sredina + sirina} ${sredina - duljina} Q${sredina} ${sredina - duljina - 4} ${sredina - sirina} ${sredina - duljina} Z`}
                  fill={BOJE.h2s}
                  fillOpacity={0.25 + 0.75 * udio}
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>{`${RUZA_IMENA[i]}: ${brojka(v)} µg/m³ u ${K1.ruza.sati[i]} sati`}</title>
                </path>
              </g>
            );
          })}
          {STRANE.map(({ oznaka, sektor }) => {
            const [tx, ty] = uKrugu(sredina, izvana + 13, sektor);
            return (
              <text
                key={oznaka}
                x={tx}
                y={ty + 4}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="#71717b"
              >
                {oznaka}
              </text>
            );
          })}
          <line
            x1={uKrugu(sredina, izvana + 2, SMJER_PLOHE)[0]}
            y1={uKrugu(sredina, izvana + 2, SMJER_PLOHE)[1]}
            x2={uKrugu(sredina, izvana + 22, SMJER_PLOHE)[0]}
            y2={uKrugu(sredina, izvana + 22, SMJER_PLOHE)[1]}
            stroke="#18181b"
            strokeWidth="2"
          />
          <text
            x={uKrugu(sredina, izvana + 34, SMJER_PLOHE)[0]}
            y={uKrugu(sredina, izvana + 34, SMJER_PLOHE)[1] + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#18181b"
          >
            ploha
          </text>
        </svg>
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
