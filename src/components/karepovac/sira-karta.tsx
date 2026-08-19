import { SIRA_KARTA } from "@/generated/karepovac-siri";

const { sirina, visina, slojevi, obrisi, podloga, korakM } = SIRA_KARTA;

function brojka(x: number, decimala = 0) {
  return x.toLocaleString("hr-HR", {
    minimumFractionDigits: decimala,
    maximumFractionDigits: decimala,
  });
}

/**
 * Godišnji račun raspršenja nad cijelim obuhvatom koji model računa.
 *
 * Obuhvat je 4,8 × 3,6 km i namjerno prelazi granice kvarta: perjanica koja
 * izađe iz kvarta ne prestaje postojati, a ono što odlazi mimo kuća jednako je
 * dio odgovora kao i ono što dolazi na njih.
 *
 * Podloga je sjenčani reljef, ne ceste — reljef je ono što perjanicu skreće,
 * pa je na karti raspršenja on najkorisnija podloga.
 */
export function SiraKarta() {
  return (
    <figure className="rounded-xl border border-kamen-tlo bg-white p-4 sm:p-6">
      <figcaption className="text-xl font-bold text-kamen-tinta">
        Cijelo područje koje model računa
      </figcaption>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        Obuhvat je {brojka((sirina * korakM) / 1000, 1)} ×{" "}
        {brojka((visina * korakM) / 1000, 1)} km i ne prestaje na granici
        kvarta. Podloga je sjenčani reljef iz LiDAR-a, jer upravo reljef
        perjanicu skreće. Zeleno je kvart, crno tijelo odlagališta.
      </p>

      <fieldset className="mt-5 flex flex-wrap gap-2">
        <legend className="sr-only">Što se prikazuje</legend>
        {slojevi.map((sloj, i) => (
          <div key={sloj.kljuc} className="contents">
            <input
              type="radio"
              name="siri-sloj"
              id={`siri-${sloj.kljuc}`}
              defaultChecked={i === 0}
              className="peer sr-only"
            />
            <label
              htmlFor={`siri-${sloj.kljuc}`}
              className="order-1 inline-flex min-h-11 cursor-pointer items-center rounded-full border border-kamen-rub px-4 py-2 text-sm font-semibold text-kamen-tekst hover:bg-kamen-plitko peer-checked:border-kamen-tinta peer-checked:bg-kamen-tinta peer-checked:text-white peer-checked:hover:bg-kamen-tinta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-maslina"
            >
              {sloj.naziv}
            </label>
            <div className="order-2 hidden w-full peer-checked:block">
              <div className="mt-4 overflow-hidden rounded-lg border border-kamen-tlo bg-kamen-plitko">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={podloga}
                    alt=""
                    width={sirina}
                    height={visina}
                    className="block h-auto w-full"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sloj.slika}
                    alt=""
                    width={sirina}
                    height={visina}
                    className="absolute inset-0 block h-full w-full"
                  />
                  <svg
                    viewBox={`0 0 ${sirina} ${visina}`}
                    role="img"
                    aria-label={`${sloj.naziv} nad kvartom i odlagalištem, cijeli obuhvat računa.`}
                    className="absolute inset-0 block h-full w-full"
                  >
                    {Object.entries(obrisi).map(([kljuc, sloj]) =>
                      sloj.putanje.map((d, k) => (
                        <path
                          key={`${kljuc}-${k}`}
                          d={d}
                          fill="none"
                          stroke={sloj.boja}
                          strokeWidth={sloj.debljina}
                          strokeLinejoin="round"
                        />
                      )),
                    )}
                  </svg>
                </div>
              </div>
              <Ljestvica sloj={sloj} />
            </div>
          </div>
        ))}
      </fieldset>
    </figure>
  );
}

function Ljestvica({ sloj }: { sloj: (typeof slojevi)[number] }) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-kamen-drugi">0</span>
        <span
          aria-hidden="true"
          className="h-2.5 flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(90deg,#fdedc7,#fad689,#e99c42,#b7542a,#5e1b16)",
          }}
        />
        <span className="text-sm tabular-nums text-kamen-drugi">
          {brojka(sloj.vrh, sloj.vrh < 10 ? 2 : 0)} {sloj.jedinica}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-base leading-7 text-kamen-tekst">
        {sloj.opis}
      </p>
      <p className="mt-2 max-w-2xl text-base leading-7 text-kamen-drugi">
        Izvan same plohe najviše {brojka(sloj.najviseIzvanPlohe, sloj.vrh < 10 ? 3 : 0)}{" "}
        {sloj.jedinica}, medijan{" "}
        {brojka(sloj.medijanIzvanPlohe, sloj.vrh < 10 ? 3 : 0)} {sloj.jedinica}.
        Ljestvica je korjenasta, jer je raspon nekoliko redova veličine.
      </p>
    </div>
  );
}
