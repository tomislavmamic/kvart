import { PRESJEK } from "@/generated/karepovac-presjek";

/**
 * Presjek padine: od plohe odlagališta, niz Dračevac, do Bilica.
 *
 * Karta odozgo pokazuje kamo zrak ide. Ovo pokazuje ono što karta odozgo ne
 * može: da odlagalište stoji iznad kuća, i koliko je plitka kutija zraka u
 * kojoj se sve to miješa u satima kad se namiriše.
 *
 * Okomito mjerilo je razvučeno, i to piše ispod slike. Bez razvlačenja bi se
 * na 1,6 km duljine visinska razlika od sedamdesetak metara stopila u crtu i
 * padina bi izgledala ravno — što bi bilo točno nacrtano i posve krivo
 * pročitano.
 *
 * Poklopac miješanja nije iz literature nego iz mjerenja: desetina sati s
 * najvišim izmjerenim sumporovodikom na postaji uz plohu. Vrpca oko njega su
 * kvartili tih sati, i namjerno je široka — toliko se to zapravo zna.
 */

/**
 * Crtež je viši nego što bi trebao biti za svoj sadržaj, i to namjerno.
 *
 * Poklopac u običnom satu stoji na 390 m, a gornji kvartil najgorih sati na
 * 445 — pa okomita os mora dosezati dotle. Uz nižu sliku teren bi ispao kao
 * tanka pruga uz dno, a teren je ovdje ono o čemu se radi.
 */
const S = { sirina: 660, visina: 380, lijevo: 46, desno: 14, gore: 16, dolje: 40 };

const VISINA_M = Math.ceil((PRESJEK.sidroM + PRESJEK.poklopac.gornjiM) / 50) * 50;

const PLOTNA = {
  sirina: S.sirina - S.lijevo - S.desno,
  visina: S.visina - S.gore - S.dolje,
};

/** Vodoravno: metri uzduž pravca u koordinate crteža. */
function px(m: number): number {
  return S.lijevo + (m / PRESJEK.duljinaM) * PLOTNA.sirina;
}

/** Okomito: metri nadmorske visine u koordinate crteža. */
function py(m: number): number {
  return S.gore + PLOTNA.visina - (m / VISINA_M) * PLOTNA.visina;
}

/** Koliko je okomito mjerilo razvučeno u odnosu na vodoravno. */
const RAZVUCENO =
  Math.round(
    ((PLOTNA.visina / VISINA_M) / (PLOTNA.sirina / PRESJEK.duljinaM)) * 10,
  ) / 10;

function crta(uzmi: (t: (typeof PRESJEK.tocke)[number]) => number): string {
  return PRESJEK.tocke
    .map((t, i) => `${i ? "L" : "M"}${px(t.m).toFixed(1)} ${py(uzmi(t)).toFixed(1)}`)
    .join(" ");
}

/** Puni lik terena: srednja crta pa natrag po dnu crteža. */
const TEREN = `${crta((t) => t.z)} L${px(PRESJEK.duljinaM).toFixed(1)} ${py(0).toFixed(1)} L${px(0).toFixed(1)} ${py(0).toFixed(1)} Z`;

/** Vrpca između najniže i najviše točke u pojasu oko pravca. */
const POJAS = `${crta((t) => t.vrh)} ${PRESJEK.tocke
  .map((t, i) => `${i ? "L" : "L"}${px(t.m).toFixed(1)} ${py(t.dno).toFixed(1)}`)
  .reverse()
  .join(" ")} Z`;

const NA_PLOHI = PRESJEK.tocke.filter((t) => t.ploha);

export function PresjekPadine() {
  const poklopac = PRESJEK.sidroM + PRESJEK.poklopac.najgoriM;
  const donji = PRESJEK.sidroM + PRESJEK.poklopac.donjiM;
  const gornji = PRESJEK.sidroM + PRESJEK.poklopac.gornjiM;
  const obican = PRESJEK.sidroM + PRESJEK.poklopac.sviM;

  return (
    <figure className="overflow-hidden rounded-xl border border-kamen-rub bg-[#fcfbf9] p-4 sm:p-6">
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-bold text-kamen-tinta">
          Padina u presjeku: odlagalište je iznad kuća
        </span>
        <span className="rounded-lg bg-sky-50 px-3 py-2 text-right text-xs text-sky-900">
          <span className="block font-bold">Izmjeren reljef</span>
          <span className="mt-0.5 block">poklopac iz mjerenja</span>
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${S.sirina} ${S.visina}`}
        role="img"
        aria-label={
          `Presjek padine dug ${PRESJEK.duljinaM} metara, od plohe odlagališta `
          + `na oko 100 metara nadmorske visine, preko Dračevca, do Bilica na `
          + `oko 30 metara. Vodoravna crta na ${poklopac} metara pokazuje dokle `
          + `se zrak miješa u satima s najvišim izmjerenim sumporovodikom.`
        }
        className="mt-4 block h-auto w-full"
      >
        {[0, 50, 100, 150, 200, 250, 300, 350, 400, 450].
          filter((m) => m <= VISINA_M).map((m) => (
          <g key={m}>
            <line
              x1={S.lijevo} y1={py(m)} x2={S.sirina - S.desno} y2={py(m)}
              stroke="#e7e2d9" strokeWidth={1}
            />
            <text
              x={S.lijevo - 8} y={py(m) + 3.5} textAnchor="end"
              className="fill-kamen-drugi" fontSize={9.5}
            >
              {m}
            </text>
          </g>
        ))}

        {/* Kutija zraka: od tla do poklopca u najgorim satima. */}
        {/* Kvartili najgorih sati. Blijedi su namjerno: široki su koliko se
            to zna, ali nisu nalaz — nalaz je crta ispod njih. */}
        <rect
          x={S.lijevo} y={py(gornji)}
          width={PLOTNA.sirina} height={py(donji) - py(gornji)}
          fill="#7aa6e4" opacity={0.07}
        />
        <text
          x={S.sirina - S.desno - 6} y={py(gornji) + 13} textAnchor="end"
          className="fill-kamen-drugi" fontSize={9.5}
        >
          {`raspon: ${donji}–${gornji} m`}
        </text>
        <line
          x1={S.lijevo} y1={py(poklopac)} x2={S.sirina - S.desno} y2={py(poklopac)}
          stroke="#4a6fa5" strokeWidth={1.6} strokeDasharray="7 4"
        />
        <text
          x={S.lijevo + 6} y={py(poklopac) - 6}
          className="fill-[#3c5c8a]" fontSize={10.5} fontWeight={600}
        >
          {`dokle se zrak miješa kad se namiriše — ${poklopac} m`}
        </text>
        <line
          x1={S.lijevo} y1={py(obican)} x2={S.sirina - S.desno} y2={py(obican)}
          stroke="#9fb6d4" strokeWidth={1} strokeDasharray="2 5"
        />
        <text
          x={S.sirina - S.desno - 6} y={py(obican) - 5} textAnchor="end"
          className="fill-kamen-drugi" fontSize={9.5}
        >
          {`u običnom satu — ${obican} m`}
        </text>

        <path d={POJAS} fill="#c9bda6" opacity={0.45} />
        <path d={TEREN} fill="#b9ab90" />
        <path d={crta((t) => t.z)} fill="none" stroke="#7d7059" strokeWidth={1.4} />

        {/* Ploha odlagališta leži na vrhu padine; istaknuta je uz sam teren. */}
        {NA_PLOHI.length > 0 && (
          <path
            d={NA_PLOHI.map((t, i) => `${i ? "L" : "M"}${px(t.m).toFixed(1)} ${py(t.z).toFixed(1)}`).join(" ")}
            fill="none" stroke="#8a3b2a" strokeWidth={4} strokeLinecap="round"
          />
        )}

        {PRESJEK.mjesta.map((mjesto) => (
          <g key={mjesto.ime}>
            <line
              x1={px(mjesto.m)} y1={py(0)} x2={px(mjesto.m)} y2={py(0) + 6}
              stroke="#7d7059" strokeWidth={1}
            />
            <text
              x={px(mjesto.m)} y={py(0) + 19}
              textAnchor={mjesto.m === 0 ? "start" : mjesto.m >= PRESJEK.duljinaM ? "end" : "middle"}
              className="fill-kamen-tinta" fontSize={11} fontWeight={700}
            >
              {mjesto.ime === "Karepovac" ? "KAREPOVAC" : mjesto.ime}
            </text>
            <text
              x={px(mjesto.m)} y={py(0) + 31}
              textAnchor={mjesto.m === 0 ? "start" : mjesto.m >= PRESJEK.duljinaM ? "end" : "middle"}
              className="fill-kamen-drugi" fontSize={9.5}
            >
              {`${mjesto.m} m`}
            </text>
          </g>
        ))}

        <text
          x={S.lijevo - 8} y={S.gore - 4} textAnchor="end"
          className="fill-kamen-drugi" fontSize={9.5}
        >
          m n. v.
        </text>
      </svg>

      <p className="mt-4 max-w-prose text-base leading-7 text-kamen-tekst">
        Ploha leži na {Math.round(Math.min(...NA_PLOHI.map((t) => t.z)))}–
        {Math.round(Math.max(...NA_PLOHI.map((t) => t.z)))} m, a Bilice na
        kraju presjeka na {Math.round(PRESJEK.tocke[PRESJEK.tocke.length - 1].z)} m
        — sedamdesetak metara niže, na {(PRESJEK.duljinaM / 1000).toFixed(1)} km.
        U satima s najvišim izmjerenim sumporovodikom zrak se miješa samo do{" "}
        {poklopac} m, prema {obican} m u običnom satu: ploha i kuće tada su u
        istoj plitkoj kutiji zraka, a izvor je na njezinu gornjem kraju.
      </p>
      <p className="mt-3 max-w-prose text-base leading-7 text-kamen-drugi">
        Visine su iz LiDAR snimke terena; svijetla vrpca oko crte je raspon u
        pojasu od {2 * 120} m oko pravca, jer teren nije oštrica. Poklopac je
        izveden iz {PRESJEK.poklopac.sati.toLocaleString("hr-HR")} sati
        izmjerenog sumporovodika i modelske dubine miješanog sloja; svijetlo
        plava vrpca su kvartili, i široka je koliko se to zapravo zna. Okomito
        je mjerilo razvučeno {RAZVUCENO.toLocaleString("hr-HR")}× u odnosu na
        vodoravno.
      </p>
    </figure>
  );
}
