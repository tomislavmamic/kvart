"use client";

/**
 * Obuhvati planova užeg područja s lista 4.d prijedloga GUP-a 2025., s imenom
 * iz legende. Poligone izvodi scripts/gup-grad/planski-obrisi.py.
 *
 *  - na snazi (46 DPU-a, UPU-a i stari PUP; na listu crveno): gradi se samo
 *    po tom planu (čl. 103. st. 5) — fuksija, blizu ljubičastih čestica „plan na snazi”
 *  - propisani (34 UPU-a; na listu plavo): nova gradnja ne stoji u cijelom
 *    obuhvatu, nego samo u područjima sanacije, preobrazbe i neuređenog
 *    (čl. 103. st. 1 i 3) — to pokazuju boje čestica u načinu „Planski režim”
 *
 * Crta se sam obuhvat, tanko da ne nadjača čestice, s natpisom od zuma
 * NATPISI_OD. Prelazak mišem preko imena podeblja rub tog plana i blago mu
 * oboji cijeli obuhvat; klik na ime otvara skočni prozor s onim što list
 * kaže o planu, a obuhvat ostaje istaknut dok je prozor otvoren. Crte ne
 * hvataju miš, pa klik drugdje ide čestici.
 */
import { useEffect } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection, Point } from "geojson";

import type { GupPostavke } from "@/components/gup-grad/gup-provjera";
import { navodHtml } from "@/lib/gup-dokument/id";
import { cekanje, objave, type SvojstvaObuhvata } from "@/lib/gup-grad/obuhvati";

/** Plava obuhvata propisanog UPU-a s lista 4.d, malo tamnija da se vidi na snimci. */
export const BOJA_OBUHVATA = "#1d4ed8";
/**
 * Plan na snazi: fuksija — do ljubičastih čestica „plan na snazi” u „Planskom
 * režimu”, a jasno drukčija od plave propisanih i crvene „protivno planu”.
 */
export const BOJA_VAZECEG = "#c026d3";
const NATPISI_OD = 15;
const URL = "/geo/gup-grad/planski-rezim-2025.geojson";

/** Vrijede li obuhvati za ove postavke: popis je iz prijedloga 2025. */
export function obrisiVrijede(p: GupPostavke): boolean {
  return p.obrisi && p.godina === 2025;
}

const PLANOVI_NA_SNAZI = "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi";
/** Iste boje kao područja čekanja u „Planskom režimu” (REZIM_KARTE u gup-provjera.tsx). */
const BOJE_CEKANJA = { sanacija: "#6fdc4f", neuredeno: "#fde047", preobrazba: "#fb923c" } as const;
const VRSTA_PLANA: Record<string, string> = {
  DPU: "detaljni plan uređenja — ulice, građevne čestice i uvjeti gradnje za svaku česticu",
  UPU: "urbanistički plan uređenja — ulična mreža, namjena i uvjeti gradnje za dio grada",
  PUP: "provedbeni urbanistički plan — stara vrsta plana, iz vremena prije današnjeg zakona",
};

let ucitano: Promise<FeatureCollection> | null = null;

const vrsta = (f?: Feature) => (f?.properties as SvojstvaObuhvata | undefined)?.vrsta ?? "propisan";
const boja = (f?: Feature) => (vrsta(f) === "vazeci" ? BOJA_VAZECEG : BOJA_OBUHVATA);

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ha = (v: number) => `${v.toLocaleString("hr-HR", { maximumFractionDigits: 1 })} ha`;

/** Skočni prozor plana: ono što list 4.d i njegova legenda kažu o njemu. */
export function popupPlana(s: SvojstvaObuhvata): string {
  const sivo = "color:#71717b";
  const red = (os: string, sadrzaj: string) =>
    `<div style="display:grid;grid-template-columns:92px 1fr;gap:8px;margin-top:6px"><span style="${sivo}">${os}</span><span>${sadrzaj}</span></div>`;
  const kvadrat = (bg: string) =>
    `<span style="display:inline-block;width:11px;height:11px;border-radius:2px;border:1px solid #52525c;background:${bg};margin-right:5px;vertical-align:-1px"></span>`;
  const kratica = s.naziv.slice(0, 3);
  const vazeci = s.vrsta === "vazeci";
  let h =
    `<b>${esc(s.naziv)}</b><br>` +
    `<span style="${sivo}">${vazeci ? "plan na snazi" : "propisani plan, još nije donesen"} · br. ${s.broj} na ` +
    `${navodHtml("list-planske-mjere-2025", "listu 4.d")} prijedloga GUP-a 2025.</span>` +
    red("Obuhvat", ha(s.ha));
  if (vazeci) {
    const o = objave(s.glasnik);
    h +=
      (o.donesen ? red("Donesen", `${o.donesen}.`) : "") +
      (o.izmjene.length ? red("Izmjene", o.izmjene.map((g) => `${g}.`).join(", ")) : "") +
      (s.glasnik ? red("Sl. glasnik", `<span style="${sivo}">Grada Splita ${esc(s.glasnik)}</span>`) : "") +
      red("Gradnja", `<b>samo po ovom planu</b>, ne neposredno po GUP-u (${navodHtml("plan-na-snazi-2025", "čl. 103. st. 5")}); plan može biti stroži od GUP-a`);
  } else {
    const { ceka, poGupu } = cekanje(s);
    const dijelovi = (
      [
        ["sanacija", "urbana sanacija", s.sanacija_ha],
        ["neuredeno", "neuređeno", s.neuredeno_ha],
        ["preobrazba", "urbana preobrazba", s.preobrazba_ha],
      ] as const
    ).filter(([, , v]) => (v ?? 0) >= 0.1);
    h +=
      (ceka >= 0.1
        ? red(
            "Čeka plan",
            `<b>${ha(ceka)}</b> — nova gradnja stoji dok se UPU ne donese (${navodHtml("obveza-plana-2025", "čl. 103. st. 1")})` +
              dijelovi
                .map(([k, naziv, v]) => `<br><span style="${sivo}">${kvadrat(BOJE_CEKANJA[k])}${naziv} ${ha(v ?? 0)}</span>`)
                .join(""),
          )
        : "") +
      red(
        "Po GUP-u",
        ceka >= 0.1
          ? `${ha(poGupu)} — do plana se gradi neposredno po GUP-u (${navodHtml("obuhvat-izvan-cekanja-2025", "st. 3")})`
          : `cijeli obuhvat — plan je preporuka, do njega se gradi po GUP-u (${navodHtml("preporuka-plana-2025", "st. 4")})`,
      ) +
      (ceka >= 0.1
        ? `<div style="margin-top:6px;${sivo}">Dok plana nema, i u dijelu koji čeka smiju se graditi ulice, manja komunalna infrastruktura i javne građevine (${navodHtml("do-plana-2025", "čl. 105. st. 5")}).</div>`
        : "");
  }
  if (VRSTA_PLANA[kratica]) h += `<div style="margin-top:6px;${sivo}">${kratica}: ${VRSTA_PLANA[kratica]}.</div>`;
  h +=
    `<div style="margin-top:8px;padding-top:6px;border-top:1px solid #e4e4e7">` +
    (vazeci ? `<a href="${PLANOVI_NA_SNAZI}" target="_blank" rel="noopener" style="color:#047857">Planovi na snazi, split.hr ↗</a> · ` : "") +
    `${navodHtml("list-planske-mjere-2025", "List 4.d")}</div>`;
  return h;
}

export function useObrisi(opts: {
  mapRef: { current: LeafletNS.Map | null };
  LRef: { current: typeof LeafletNS | null };
  spremno: boolean;
  postavke: GupPostavke;
}) {
  const { mapRef, LRef, spremno, postavke } = opts;
  const aktivno = obrisiVrijede(postavke);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!spremno || !map || !L || !aktivno) return;
    let ziv = true;
    let skupina: LeafletNS.LayerGroup | null = null;
    let natpisi: LeafletNS.LayerGroup | null = null;
    let istaknut: LeafletNS.Layer | null = null;
    // plan čiji je skočni prozor otvoren: ostaje istaknut i kad miš ode s imena
    let otvoren: Feature | null = null;
    const makni = () => {
      istaknut?.remove();
      istaknut = null;
    };
    if (!map.getPane("gup-obrisi")) {
      // iznad čestica (400) i zgrada (420), ispod skočnih prozora
      const okno = map.createPane("gup-obrisi");
      okno.style.zIndex = "430";
      okno.style.pointerEvents = "none";
    }
    const natpisiVidljivi = () => {
      if (!natpisi) return;
      if (map.getZoom() >= NATPISI_OD) natpisi.addTo(map);
      else natpisi.remove();
    };
    ucitano ??= fetch(URL).then((r) => {
      if (!r.ok) throw new Error(`${URL}: ${r.status}`);
      return r.json() as Promise<FeatureCollection>;
    });
    ucitano
      .then((fc) => {
        if (!ziv) return;
        const renderer = L.svg({ pane: "gup-obrisi" });
        // važeći ispod propisanih: gdje dijele rub, vidi se plava crta kao na listu
        const redom = [...fc.features].sort((a, b) => Number(vrsta(a) === "propisan") - Number(vrsta(b) === "propisan"));
        const sloj = { type: "FeatureCollection", features: redom } as FeatureCollection;
        // bijela podloga ispod crte, da se vidi i na satelitskoj snimci
        const podloga = L.geoJSON(sloj, {
          renderer,
          interactive: false,
          style: () => ({ color: "#ffffff", weight: 3, opacity: 0.5, fill: false }),
        } as LeafletNS.GeoJSONOptions);
        const rub = L.geoJSON(sloj, {
          renderer,
          interactive: false,
          style: (f) => ({ color: boja(f), weight: 1.5, opacity: 0.75, fill: false }),
        } as LeafletNS.GeoJSONOptions);
        skupina = L.layerGroup([podloga, rub]).addTo(map);
        const istakni = (f: Feature) => {
          istaknut?.remove();
          istaknut = L.layerGroup([
            L.geoJSON(f, {
              renderer,
              interactive: false,
              style: () => ({ color: "#ffffff", weight: 5.5, opacity: 0.9, fill: false }),
            } as LeafletNS.GeoJSONOptions),
            L.geoJSON(f, {
              renderer,
              interactive: false,
              style: () => ({ color: boja(f), weight: 2.5, opacity: 1, fillColor: boja(f), fillOpacity: 0.18 }),
            } as LeafletNS.GeoJSONOptions),
          ]).addTo(map);
        };
        natpisi = L.layerGroup(
          redom.map((f) => {
            const s = f.properties as SvojstvaObuhvata;
            const tocka = (s.tocka ?? (f.geometry as Point).coordinates) as [number, number];
            const natpis = L.marker([tocka[1], tocka[0]], {
              pane: "gup-obrisi",
              interactive: true,
              keyboard: false,
              icon: L.divIcon({
                className: "",
                iconSize: undefined,
                html:
                  // duga imena DPU-a lome se u retke, da se natpisi susjednih planova ne preklapaju
                  `<div style="transform:translate(-50%,-50%);width:max-content;max-width:13em;text-align:center;font:600 12px/1.15 system-ui,sans-serif;` +
                  `color:${boja(f)};text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">` +
                  `${esc(s.naziv)}</div>`,
              }),
            });
            natpis.on("mouseover", () => istakni(f));
            natpis.on("mouseout", () => (otvoren ? istakni(otvoren) : makni()));
            natpis.on("click", () => {
              otvoren = f;
              istakni(f);
              L.popup({ maxWidth: 320, className: "gup-provjera-popup" })
                .setLatLng(natpis.getLatLng())
                .setContent(popupPlana(s))
                .on("remove", () => {
                  if (otvoren !== f) return;
                  otvoren = null;
                  makni();
                })
                .openOn(map);
            });
            return natpis;
          }),
        );
        natpisiVidljivi();
        map.on("zoomend", natpisiVidljivi);
      })
      .catch(() => {
        ucitano = null; // idući put pokušaj ponovno
      });
    return () => {
      ziv = false;
      map.off("zoomend", natpisiVidljivi);
      skupina?.remove();
      natpisi?.remove();
      istaknut?.remove();
    };
  }, [spremno, aktivno, mapRef, LRef]);
}
