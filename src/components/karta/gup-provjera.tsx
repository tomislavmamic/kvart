"use client";

/**
 * Pogled „Provjera GUP-a” na /karta: kako je infografika /gup razvrstala
 * svaku katastarsku česticu.
 *
 * Dva sloja, oba izvedena skriptom scripts/gup-grad/cestice.py:
 *  - slika namjene po godini (naše razvrstavanje lista, u bojama legende
 *    plana) — da se usporedi sa službenim ISPU listom i ortofotom;
 *  - čestice s mjerenjima po komadima, u pločicama od 1 km, koje se
 *    dohvaćaju samo za okno i tek od zuma MIN_ZUM (cijeli grad je ~41 000
 *    čestica).
 *
 * Sud o čestici računa src/lib/gup-grad/provjera.ts istim funkcijama i
 * pravilima kao /gup, pa karta ne može reći drugo nego infografika.
 */
import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import { GODINE, KLASE, type Godina } from "@/lib/gup-grad/model";
import { INACICE, type VrstaKoristenja } from "@/lib/gup-grad/pravila";
import { sudCestice, type StanjeCestice, type SudCestice, type SvojstvaCestice } from "@/lib/gup-grad/provjera";

export const GUP_POGLED = "gup-provjera";
const MIN_ZUM = 15;

export interface GupPostavke {
  godina: Godina;
  prikaz: "stanje" | "namjena";
  inacica: string;
  slika: boolean;
  cestice: boolean;
}

export const POCETNE_GUP_POSTAVKE: GupPostavke = {
  godina: 2025,
  prikaz: "stanje",
  inacica: INACICE[0].id,
  slika: true,
  cestice: true,
};

/**
 * Kako se stanje čestice crta. Boja ispune je UVIJEK boja namjene iz
 * legende plana (pretežita klasa čestice); stanje nose prozirnost i rub:
 *  - iskorištena po planu: puna boja;
 *  - neiskorištena: poluprozirna;
 *  - iskorištena protivno planu: crveni rub (iscrtkan kad je protivan samo
 *    dio iskorištenog).
 * Tako se i izdaleka vidi i ČIJA je čestica (namjena) i što je s njom.
 */
const CRVENA = "#d03b3b";
export const STANJA: Record<
  StanjeCestice,
  { naziv: string; ispuna: number; rub: string; debljina: number; crtkano?: string }
> = {
  "u-skladu": { naziv: "iskorištena po planu", ispuna: 0.85, rub: "#18181b", debljina: 0.6 },
  slobodna: { naziv: "neiskorištena (ispod 5 %)", ispuna: 0.35, rub: "#52525c", debljina: 0.4 },
  protivno: { naziv: "iskorištena protivno planu", ispuna: 0.85, rub: CRVENA, debljina: 3 },
  "djelomicno-protivno": { naziv: "dijelom protivno planu", ispuna: 0.85, rub: CRVENA, debljina: 2, crtkano: "5 3" },
};

const VRSTE: Record<VrstaKoristenja, string> = {
  stambena: "stambena zgrada",
  gospodarska: "gospodarska/poslovna zgrada",
  javna: "javna zgrada",
  pomocna: "pomoćna zgrada",
  ostala: "ostala građevina",
  neevidentirana: "zgrada koje nema u katastru",
  promet: "cesta/nogostup/parkiralište",
  uredjeno: "groblje/športski objekt",
  zelenilo: "održavano zelenilo",
};

const SKUPINA_ZGRADE = ["", "stambena", "gospodarska", "javna", "pomoćna", "ostala"];

interface Plocica {
  id: string;
  n: number;
  granice: [[number, number], [number, number]];
}

export interface GupInfo {
  zum: number;
  stanje: "ucitava" | "greska" | null;
  /** Broj učitanih čestica u oknu po stanju (ili null ispod MIN_ZUM). */
  uOknu: Record<StanjeCestice, number> | null;
}

type CesticaFeature = Feature<Geometry, SvojstvaCestice>;

export function useGupProvjera(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  /** Karta je stvorena (refovi su puni). */
  spremno: boolean;
  aktivno: boolean;
  postavke: GupPostavke;
  pogodakSloja: { current: number };
}): GupInfo {
  const { mapRef, LRef, spremno, aktivno, postavke, pogodakSloja } = opts;
  const [info, setInfo] = useState<GupInfo>({ zum: 0, stanje: null, uOknu: null });
  const postavkeRef = useRef(postavke);
  const slojRef = useRef<LeafletNS.GeoJSON | null>(null);
  const slikaRef = useRef<LeafletNS.ImageOverlay | null>(null);
  const indeksRef = useRef<Plocica[] | null>(null);
  const slikeRef = useRef<{ granice: [[number, number], [number, number]]; slike: { godina: number; url: string }[] } | null>(null);
  const ucitaneRef = useRef<Set<string>>(new Set());
  const osvjeziRef = useRef<() => void>(() => {});
  const prozirnostRef = useRef<() => void>(() => {});

  // Sloj čestica i njegovi rukovatelji žive dok je pogled aktivan.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    const pravila = () => INACICE.find((i) => i.id === postavkeRef.current.inacica)?.pravila ?? INACICE[0].pravila;
    const sud = (p: SvojstvaCestice) => sudCestice(p, postavkeRef.current.godina, pravila());

    // Platno dolazi od karte (preferCanvas) — 5 000+ čestica u oknu kao SVG
    // bi zagušilo DOM.
    const sloj = L.geoJSON(undefined, {
      style: (f) => stil(sud((f as CesticaFeature).properties), postavkeRef.current),
      onEachFeature: (f, lyr) => {
        lyr.on("click", (e: LeafletNS.LeafletMouseEvent) => {
          pogodakSloja.current = Date.now();
          const p = (f as CesticaFeature).properties;
          const s = postavkeRef.current;
          L.popup({ maxWidth: 340, className: "gup-provjera-popup" })
            .setLatLng(e.latlng)
            .setContent(popup(p, sud(p), s))
            .openOn(map);
        });
      },
    });
    slojRef.current = sloj;

    // Slika namjene je za pogled izdaleka i za usporedbu s listom. Ispod
    // obojenih čestica u načinu „iskorištenost” miješala bi boje plana sa
    // statusnim bojama, pa se ondje skriva; uz „namjenu” ostaje blijeda.
    const prozirnostSlike = (cesticeVidljive: boolean) => {
      const prikaz = postavkeRef.current.prikaz;
      slikaRef.current?.setOpacity(!cesticeVidljive ? 0.55 : prikaz === "namjena" ? 0.25 : 0);
    };
    prozirnostRef.current = () => prozirnostSlike(map.getZoom() >= MIN_ZUM && postavkeRef.current.cestice);

    const prebroji = () => {
      if (map.getZoom() < MIN_ZUM || !postavkeRef.current.cestice) {
        setInfo((i) => ({ ...i, zum: map.getZoom(), uOknu: null }));
        return;
      }
      const okno = map.getBounds();
      const n: Record<StanjeCestice, number> = { slobodna: 0, "u-skladu": 0, "djelomicno-protivno": 0, protivno: 0 };
      sloj.eachLayer((l) => {
        const pl = l as LeafletNS.Polygon & { feature?: CesticaFeature };
        if (pl.feature && okno.intersects(pl.getBounds())) n[sud(pl.feature.properties).stanje]++;
      });
      setInfo((i) => ({ ...i, zum: map.getZoom(), uOknu: n }));
    };

    const ucitaj = async () => {
      const zum = map.getZoom();
      const vidljivo = zum >= MIN_ZUM && postavkeRef.current.cestice;
      prozirnostSlike(vidljivo);
      if (vidljivo && !map.hasLayer(sloj)) sloj.addTo(map);
      if (!vidljivo && map.hasLayer(sloj)) sloj.remove();
      if (!vidljivo) {
        prebroji();
        return;
      }
      try {
        indeksRef.current ??= ((await (await fetch("/geo/gup-grad/cestice-indeks.json")).json()) as { plocice: Plocica[] })
          .plocice;
        const okno = map.getBounds().pad(0.2);
        const trebaju = indeksRef.current.filter(
          (p) => !ucitaneRef.current.has(p.id) && okno.intersects(L.latLngBounds(p.granice)),
        );
        if (trebaju.length) setInfo((i) => ({ ...i, stanje: "ucitava" }));
        await Promise.all(
          trebaju.map(async (p) => {
            ucitaneRef.current.add(p.id);
            const r = await fetch(`/geo/gup-grad/cestice/${p.id}.json`);
            if (!r.ok) {
              ucitaneRef.current.delete(p.id);
              throw new Error(`pločica ${p.id}: ${r.status}`);
            }
            const fc = (await r.json()) as FeatureCollection<Geometry, SvojstvaCestice>;
            if (ziv) sloj.addData(fc);
          }),
        );
        if (ziv) setInfo((i) => ({ ...i, stanje: null }));
      } catch {
        if (ziv) setInfo((i) => ({ ...i, stanje: "greska" }));
      }
      if (ziv) prebroji();
    };

    osvjeziRef.current = () => {
      sloj.setStyle((f) => stil(sud((f as CesticaFeature).properties), postavkeRef.current));
      void ucitaj();
    };
    map.on("moveend", ucitaj);
    void ucitaj();
    return () => {
      ziv = false;
      map.off("moveend", ucitaj);
      map.closePopup();
      sloj.remove();
      slojRef.current = null;
      ucitaneRef.current = new Set();
      osvjeziRef.current = () => {};
      prozirnostRef.current = () => {};
    };
  }, [mapRef, LRef, spremno, aktivno, pogodakSloja]);

  // Slika našeg razvrstavanja lista za odabranu godinu.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno || !postavke.slika) return;
    let ziv = true;
    void (async () => {
      try {
        slikeRef.current ??= await (await fetch("/geo/gup-grad/namjena-slike.json")).json();
        const meta = slikeRef.current!;
        const s = meta.slike.find((x) => x.godina === postavke.godina);
        if (!ziv || !s) return;
        const sl = L.imageOverlay(s.url, meta.granice, { opacity: 0.55, interactive: false });
        sl.addTo(map);
        sl.bringToBack();
        slikaRef.current = sl;
        prozirnostRef.current();
      } catch {
        if (ziv) setInfo((i) => ({ ...i, stanje: "greska" }));
      }
    })();
    return () => {
      ziv = false;
      slikaRef.current?.remove();
      slikaRef.current = null;
    };
  }, [mapRef, LRef, spremno, aktivno, postavke.slika, postavke.godina]);

  // Promjena godine, prikaza ili načina brojanja samo prebojava.
  useEffect(() => {
    postavkeRef.current = postavke;
    osvjeziRef.current();
  }, [postavke]);

  return info;
}

function stil(s: SudCestice, p: GupPostavke): LeafletNS.PathOptions {
  if (p.prikaz === "namjena") {
    const vise = s.komadi.length > 1;
    return {
      color: "#18181b",
      weight: vise ? 1.2 : 0.5,
      dashArray: vise ? "4 3" : undefined,
      fillColor: s.pretezita?.bojaPlana ?? "#ffffff",
      fillOpacity: s.pretezita ? 0.6 : 0,
    };
  }
  const st = STANJA[s.stanje];
  return {
    color: st.rub,
    weight: st.debljina,
    dashArray: st.crtkano,
    fillColor: s.pretezita?.bojaPlana ?? "#ffffff",
    fillOpacity: s.pretezita ? st.ispuna : 0,
  };
}

function esc(v: unknown): string {
  return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

const m2 = (v: number) => `${Math.round(v).toLocaleString("hr-HR")} m²`;

function popup(p: SvojstvaCestice, s: SudCestice, post: GupPostavke): string {
  const inacica = INACICE.find((i) => i.id === post.inacica) ?? INACICE[0];
  const st = STANJA[s.stanje];
  const sivo = "color:#71717b";
  let h =
    `<b>k.č. ${esc(p.kc)}, k.o. ${esc(p.ko)}</b><br>` +
    `<span style="${sivo}">${m2(p.a)} u katastru · GUP ${post.godina}. · brojanje: ${esc(inacica.naziv)}</span>` +
    `<div style="margin:6px 0;display:flex;align-items:center;gap:6px">` +
    `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${s.pretezita?.bojaPlana ?? "#fff"};opacity:${st.ispuna < 0.5 ? 0.45 : 1};outline:${st.debljina >= 2 ? `2px ${st.crtkano ? "dashed" : "solid"} ${CRVENA}` : "1px solid #52525c"}"></span>` +
    `<b>${esc(st.naziv)}</b></div>`;
  if (!s.komadi.length) {
    return h + `<span style="${sivo}">U ovoj godini plana čestica nije u obuhvatu GUP-a (ili je ispod krhotine od 5 %).</span>`;
  }
  h +=
    `<span style="${sivo}">iskorišteno ${m2(s.iskoristeno)} od ${m2(s.m2)}` +
    (s.uSuprotnosti > 0 ? `, protivno planu ${m2(s.uSuprotnosti)}` : "") +
    `</span>`;
  for (const k of s.komadi) {
    h +=
      `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #e4e4e7">` +
      `<span style="display:inline-block;width:10px;height:10px;border:1px solid #52525c;background:${k.klasa.bojaPlana};margin-right:4px"></span>` +
      `<b>${esc(k.klasa.kod)}</b> ${esc(k.klasa.naziv)} — ${m2(k.m2)}` +
      `<br><span style="${sivo}">izmjereno: zgrada u katastru ${m2(k.mjereno.zk)}` +
      (k.g ? ` (${SKUPINA_ZGRADE[k.g]})` : "") +
      `, zgrada u 3D modelu ${m2(k.mjereno.z25)}, promet ${m2(k.mjereno.pr)}` +
      (k.mjereno.os ? `, groblje/šport ${m2(k.mjereno.os)}` : "") +
      (k.mjereno.ze ? `, zelenilo ${m2(k.mjereno.ze)}` : "") +
      `</span>`;
    const racun = k.pokriveno.filter(([, v]) => v > 0);
    if (racun.length) {
      h +=
        `<br>u računu: ` +
        racun
          .map(([v, x]) => {
            const protiv = k.protivneVrste.includes(v);
            return `<span style="${protiv ? "color:#b91c1c;font-weight:600" : ""}">${esc(VRSTE[v])} ${m2(x)}${protiv ? " ✗" : ""}</span>`;
          })
          .join(", ");
      h += `<br><span style="${sivo}">iskorišteno ${m2(k.procjena.iskoristeno)} · u skladu ${m2(k.procjena.uSkladu)} · protivno ${m2(k.procjena.uSuprotnosti)}</span>`;
    }
    h += `</div>`;
  }
  h +=
    `<div style="margin-top:8px;${sivo}">Površine komada izmjerene su na rešetki od 2 m, pa se zbroj može razlikovati od katastarske. ` +
    `<a href="/gup" style="color:#047857">Kako se broji ↗</a></div>`;
  return h;
}

export function GupProvjeraPloca(props: {
  postavke: GupPostavke;
  onPostavke: (p: GupPostavke) => void;
  info: GupInfo;
}) {
  const { postavke: p, onPostavke, info } = props;
  const postavi = (d: Partial<GupPostavke>) => onPostavke({ ...p, ...d });
  const gumb = (aktivan: boolean) =>
    `fokus meta-cip rounded-full border px-2.5 py-1 text-xs font-semibold ${
      aktivan ? "border-maslina bg-maslina text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
    }`;
  const inacica = INACICE.find((i) => i.id === p.inacica) ?? INACICE[0];
  return (
    <div className="mt-3 space-y-3 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Plan iz</p>
        <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Godina plana">
          {GODINE.map((g) => (
            <button key={g} type="button" aria-pressed={p.godina === g} onClick={() => postavi({ godina: g })} className={gumb(p.godina === g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Boja čestice</p>
        <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Boja čestice">
          <button type="button" aria-pressed={p.prikaz === "stanje"} onClick={() => postavi({ prikaz: "stanje" })} className={gumb(p.prikaz === "stanje")}>
            Iskorištenost i sklad
          </button>
          <button type="button" aria-pressed={p.prikaz === "namjena"} onClick={() => postavi({ prikaz: "namjena" })} className={gumb(p.prikaz === "namjena")}>
            Namjena
          </button>
        </div>
      </div>
      {p.prikaz === "stanje" && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kako se broji</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Kako se broji">
            {INACICE.map((i) => (
              <button key={i.id} type="button" aria-pressed={p.inacica === i.id} onClick={() => postavi({ inacica: i.id })} className={gumb(p.inacica === i.id)}>
                {i.naziv}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{inacica.opis}</p>
        </div>
      )}

      <ul className="space-y-1" aria-label="Legenda">
        {p.prikaz === "stanje" &&
          (Object.keys(STANJA) as StanjeCestice[]).map((k) => {
            const st = STANJA[k];
            return (
              <li key={k} className="flex items-center gap-2">
                <span className="relative inline-block size-4 shrink-0 bg-white" aria-hidden>
                  <span
                    className="absolute inset-0 rounded-sm"
                    style={{
                      background: `rgba(224,160,0,${st.ispuna})`,
                      border: `${Math.max(1, st.debljina * 0.75)}px ${st.crtkano ? "dashed" : "solid"} ${st.rub}`,
                    }}
                  />
                </span>
                <span className="flex-1">{st.naziv}</span>
                {info.uOknu && <span className="tabular-nums text-zinc-500">{info.uOknu[k].toLocaleString("hr-HR")}</span>}
              </li>
            );
          })}
        {p.prikaz === "stanje" && (
          <li className="pt-1 text-xs text-zinc-500">
            Boja je namjena iz plana (pretežita na čestici), prozirnost i rub su stanje. Uzorci su u boji mješovite namjene.
          </li>
        )}
        {(p.prikaz === "namjena" || p.prikaz === "stanje") &&
          KLASE.filter((k) => k.kod !== "P").map((k) => (
              <li key={k.kod} className="flex items-center gap-2">
                <span className="inline-block size-3.5 shrink-0 rounded-sm border border-zinc-500" style={{ background: k.bojaPlana }} aria-hidden />
                <span className="font-mono text-xs text-zinc-500">{k.kod}</span>
                <span>{k.kratko}</span>
              </li>
            ))}
        {p.prikaz === "namjena" && (
          <li className="text-xs text-zinc-500">Iscrtkan rub: čestica je u više namjena; boja je pretežita.</li>
        )}
      </ul>
      {p.prikaz === "stanje" && info.uOknu && <p className="text-xs text-zinc-500">Brojke uz stanja: čestice u oknu.</p>}

      <div className="space-y-1">
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.cestice} onChange={(e) => postavi({ cestice: e.target.checked })} />
          Čestice (od zuma {MIN_ZUM})
        </label>
        <label className="meta flex items-center gap-2">
          <input type="checkbox" checked={p.slika} onChange={(e) => postavi({ slika: e.target.checked })} />
          Naše razvrstavanje lista plana (boje legende)
        </label>
      </div>

      {info.zum > 0 && info.zum < MIN_ZUM && p.cestice && (
        <p className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">Približi kartu (zum {MIN_ZUM}+) da se učitaju čestice.</p>
      )}
      {info.stanje === "ucitava" && <p className="text-xs text-zinc-500">Učitavam čestice…</p>}
      {info.stanje === "greska" && <p className="text-xs text-rose-700">Dio podataka se nije učitao; pomakni kartu za novi pokušaj.</p>}
      <p className="text-xs text-zinc-500">
        Klik na česticu pokazuje komade po namjeni, što je izmjereno i kako je presuđeno. Službeni list za usporedbu: „ISPU
        raster” u biralu namjene. Zbrojevi i pravila: <a href="/gup" className="fokus font-semibold text-maslina underline">Split po GUP-u</a>.
      </p>
    </div>
  );
}
