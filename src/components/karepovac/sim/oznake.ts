/**
 * Pribadače na karti: gdje se mjeri i što je ondje izmjereno.
 *
 * Brojke stoje na mjestu mjerenja, a ne u ploči sa strane. Razlog je jedan:
 * pitanje koje gledatelj ima glasi „koliko je bilo **ondje**”, a ploča na to ne
 * može odgovoriti — ona ne zna gdje je ondje. Pribadača zna.
 *
 * Dvije vrste, i razlikuju se po tome što izvor uopće objavljuje:
 *
 * - **Postaje uz plohu** (H₂S, merkaptani) objavljuju satni niz, pa brojka
 *   prati klizač i vrijedi za odabrani sat.
 * - **Postaje vjetra** objavljuju samo zadnje očitanje — DHMZ i METAR nemaju
 *   javnu povijest. Zato im brojka stoji samo dok je klizač na sadašnjem satu;
 *   povučen unatrag, pribadača ostaje, a brojka nestane. Zadnje očitanje uz
 *   jučerašnji sat bilo bi tvrdnja koju nitko nije izmjerio.
 *
 * Mjesta dolaze iz `POSTAJE_VJETRA` u generiranoj karti — jedini zapis
 * koordinata u projektu. Ondje stoji i podrijetlo svake točke, pa se na karti
 * ne može naći postaja koju nitko nije ni potražio.
 *
 * Radi se izravno s DOM-om, bez Reacta: pribadače žive i umiru s kartom, a ne
 * s prikazom, pa bi ih React morao stalno pratiti kroz `ref`.
 */

import type { Map as MapaLibre, Marker } from "maplibre-gl";

import { TVARI } from "@/lib/dim";
import type { Kadar } from "@/lib/sim/kadrovi";
import { SIM_POSTAJE, type OznakaPostaje } from "@/lib/sim/postaje-satno";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import { POSTAJE_VJETRA } from "@/generated/karepovac-karta";
import { POSTAJE, type Postaja, type Vjetar } from "@/lib/vjetar";
import { strana } from "@/components/karepovac/sim/vjetar-kartica";
import { satMjesno } from "@/components/karepovac/sim/vremenska-crta";

/**
 * Zadnje očitanje te postaje zaključno s odabranim satom.
 *
 * Zavodove tablice kasne sat-dva, pa sadašnji sat gotovo uvijek stoji prazan.
 * Prazna pribadača na najsvježijem satu čita se kao „ništa se ne mjeri”, a
 * mjeri se — samo još nije objavljeno.
 *
 * Args:
 *   kadrovi: Kadrovi crte, rastuće po vremenu.
 *   doPomaka: Pomak odabranog sata; gleda se on i sve prije njega.
 *   oznaka: Postaja koja se traži.
 *
 * Returns:
 *   Zadnja izmjerena vrijednost i sat u kojem je izmjerena, ili ništa.
 */
export function zadnjeOcitanje(
  kadrovi: readonly Kadar[],
  doPomaka: number,
  oznaka: OznakaPostaje,
): { vrijednost: number; sat: string } | null {
  for (let i = kadrovi.length - 1; i >= 0; i -= 1) {
    const k = kadrovi[i];
    if (k.pomak > doPomaka || k.vrsta === "prognoza") continue;
    const o = k.ocitanja.find((x) => x.postaja === oznaka);
    if (o && o.vrijednost !== null) return { vrijednost: o.vrijednost, sat: k.sat };
  }
  return null;
}

/**
 * Što pribadača postaje uz plohu piše za jednu tvar u zadanom satu.
 *
 * Kad za odabrani sat mjerenja još nema, pokazuje se **zadnje objavljeno**, uz
 * sat u kojem je izmjereno. Brojka bez sata bila bi tvrdnja o krivom satu;
 * prazno mjesto bila bi tvrdnja da se ne mjeri. Sat uz brojku je jedino što je
 * oboje istina.
 */
export function natpisMjerenja(
  kadar: Kadar | null,
  postaja: (typeof SIM_POSTAJE)[number],
  zadnje?: { vrijednost: number; sat: string } | null,
): { kratica: string; vrijednost: string; nema: boolean; kada: string | null } {
  const kratica = TVARI[postaja.tvar].kratica;
  // Budućnost se ne mjeri; crtica, a ne prazno mjesto koje bi izgledalo kao nula.
  if (!kadar || kadar.vrsta === "prognoza") {
    return { kratica, vrijednost: "—", nema: true, kada: null };
  }
  const o = kadar.ocitanja.find((x) => x.postaja === postaja.oznaka);
  if (o && o.vrijednost !== null) {
    return { kratica, vrijednost: broj(o.vrijednost, 2), nema: false, kada: null };
  }
  if (zadnje) {
    return {
      kratica,
      vrijednost: broj(zadnje.vrijednost, 2),
      nema: false,
      kada: satMjesno(zadnje.sat),
    };
  }
  return { kratica, vrijednost: "nema", nema: true, kada: null };
}

/**
 * Zadnje očitanje vjetra iz satnog niza, zaključno s odabranim satom.
 *
 * Args:
 *   niz: Satni niz te postaje.
 *   sat: Odabrani sat, puni ISO 8601.
 *
 * Returns:
 *   Zadnje očitanje u tom satu ili prije njega, ili ništa.
 */
export function zadnjiIzNiza(
  niz: ReadonlyMap<string, SatniVjetar> | undefined,
  sat: string,
): SatniVjetar | null {
  if (!niz) return null;
  let najbolji: SatniVjetar | null = null;
  for (const v of niz.values()) {
    if (v.sat > sat) continue;
    if (!najbolji || v.sat > najbolji.sat) najbolji = v;
  }
  return najbolji;
}

/**
 * Što pribadača postaje vjetra piše u zadanom satu.
 *
 * Redoslijed je isti kao kod postaja uz plohu: prvo očitanje **iz odabranog
 * sata**, pa zadnje objavljeno **uz sat u kojem je izmjereno**, pa tek onda
 * praznina. Brojka bez sata bila bi tvrdnja o krivom satu; prazna pribadača
 * bila bi tvrdnja da postaja ne mjeri.
 *
 * Razlika prema plohi je u tome što DHMZ i METAR ne objavljuju povijest, nego
 * samo zadnje očitanje. Ono zna biti i **novije** od odabranog sata — gledaš
 * jutros, a postaja javlja podne. Zato sat uz brojku ondje nije ukras nego
 * jedino što razliku čini vidljivom.
 */
export function natpisVjetra(
  kadar: Kadar | null,
  imena: string,
  ocitanje: Vjetar | undefined,
  /** Očitanje te postaje točno u odabranom satu, ako ga ima. */
  niz?: SatniVjetar | undefined,
  /** Zadnje očitanje iz njezina niza zaključno s odabranim satom. */
  raniji?: SatniVjetar | null,
  /** Je li dohvat vjetra uopće završio; do tada se ne zna ništa. */
  stiglo: boolean = true,
): { imena: string; vrijednost: string; nema: boolean; kada: string | null } {
  if (niz) return { imena, vrijednost: brzinaISmjer(niz), nema: false, kada: null };
  if (raniji) {
    return {
      imena,
      vrijednost: brzinaISmjer(raniji),
      nema: false,
      kada: satMjesno(raniji.sat),
    };
  }
  if (ocitanje) {
    return {
      imena,
      vrijednost: brzinaISmjer(ocitanje),
      nema: false,
      kada: satMjesno(ocitanje.opazeno),
    };
  }
  // Dok dohvat traje, postaja nije šutljiva nego neispitana. Razlika je
  // važna: „šuti” je tvrdnja o postaji, a čekanje je stanje ove stranice.
  // Dohvat s AZO-a traje dvadesetak sekundi jer se pozivi moraju razmaknuti.
  return {
    imena,
    vrijednost: stiglo ? "šuti" : "…",
    nema: true,
    kada: null,
  };
}

export type Oznake = {
  /** Osvježava brojke za odabrani sat. */
  postavi(
    kadar: Kadar | null,
    sada: readonly Vjetar[],
    serije: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>,
    /** Svi kadrovi crte; iz njih se vadi zadnje objavljeno mjerenje. */
    kadrovi: readonly Kadar[],
    /** Je li dohvat vjetra završio; do tada pribadače čekaju, ne šute. */
    vjetarStigao: boolean,
  ): void;
  vidljivost(vidljive: boolean): void;
  ukloni(): void;
};

function broj(x: number, decimala: number): string {
  return x.toFixed(decimala).replace(".", ",");
}

/** Mjesto svake postaje vjetra, po oznaci. */
const MJESTA = new Map(POSTAJE_VJETRA.map((p) => [p.oznaka as Postaja, p]));

/**
 * Strelica koja pokazuje **kamo** vjetar nosi.
 *
 * Ista je pogodba kao na kartici gore lijevo: crta se kamo zrak ide, a piše se
 * odakle puše. To dvoje je suprotno i stalno se brka, pa strelica nikad ne
 * stoji sama — uz nju u `title` i za čitač zaslona ide „iz JZ”, riječima.
 * Slika odgovara na pitanje tko je niz vjetar, natpis na pitanje kako se taj
 * vjetar zove.
 *
 * Args:
 *   smjerOd: Meteorološki smjer iz kojega puše, u stupnjevima.
 *
 * Returns:
 *   SVG strelice, zaokrenut prema odredištu.
 */
function strelica(smjerOd: number): string {
  const kut = (smjerOd + 180) % 360;
  return (
    `<svg class="sim-oznaka__strelica" viewBox="0 0 12 12" aria-hidden="true">` +
    `<path d="M6 1.5 L9 10 L6 8 L3 10 Z" transform="rotate(${kut.toFixed(0)} 6 6)"/>` +
    `</svg>`
  );
}

/**
 * Vjetar u obliku u kojem ga nose sve pribadače: brzina, mjera, strelica.
 *
 * Mjera stoji uz brojku, a ne u opisu: `1,2` se dade pročitati i kao čvorovi i
 * kao km/h, a razlika između 1,2 m/s i 1,2 čvora je razlika između tišine i
 * povjetarca. Pri tišini se brojka izostavlja jer smjer tada ništa ne znači —
 * vidi `tisina` u `vjetar.ts`.
 *
 * Args:
 *   v: Očitanje s postaje, satno ili zadnje objavljeno.
 *
 * Returns:
 *   Natpis oblika `1,2 m/s ↗`, ili `tišina`.
 */
function brzinaISmjer(v: { brzina: number; smjerOd: number; tisina: boolean }): string {
  if (v.tisina) return "tišina";
  return `${broj(v.brzina, 1)} m/s ${strelica(v.smjerOd)}`;
}

/** Riječima, za `title` i čitače zaslona; strelica sama ne kaže odakle puše. */
function rijecima(v: { brzina: number; smjerOd: number; tisina: boolean } | undefined): string {
  if (!v) return "";
  if (v.tisina) return "tišina, vjetar praktički ne nosi";
  return `iz ${strana(v.smjerOd)}, ${broj(v.brzina, 1)} m/s`;
}

/** Postaje vjetra koje se mogu zabosti — one kojima registar zna mjesto. */
const SA_MJESTOM = (Object.keys(POSTAJE) as Postaja[]).filter((k) => MJESTA.has(k));

/** Zračna luka nosi dvije postaje na istoj točki; zabada se jednom. */
function poMjestu(): { kljuc: string; lat: number; lon: number; postaje: Postaja[] }[] {
  const skup = new Map<string, { kljuc: string; lat: number; lon: number; postaje: Postaja[] }>();
  for (const k of SA_MJESTOM) {
    const p = MJESTA.get(k)!;
    const kljuc = `${p.lat},${p.lon}`;
    const dosad = skup.get(kljuc);
    if (dosad) dosad.postaje.push(k);
    else skup.set(kljuc, { kljuc, lat: p.lat, lon: p.lon, postaje: [k] });
  }
  return [...skup.values()];
}

function element(klase: string, html: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = klase;
  el.innerHTML = html;
  return el;
}

/**
 * Zabada pribadače na kartu.
 *
 * Args:
 *   karta: Karta na koju idu.
 *   maplibre: Modul, da se ne uvozi drugi put.
 *
 * Returns:
 *   Upravljač pribadačama.
 */
export function stvoriOznake(
  karta: MapaLibre,
  MarkerRazred: typeof Marker,
): Oznake {
  const pribadace: Marker[] = [];

  // --- postaje uz plohu: jedna točka, obje tvari ---
  const mjerenja = element(
    "sim-oznaka sim-oznaka--mjerenje",
    `<div class="sim-oznaka__tocka"></div><div class="sim-oznaka__ploca" data-mjerenja></div>`,
  );
  const plocaMjerenja = mjerenja.querySelector("[data-mjerenja]") as HTMLElement;
  pribadace.push(
    new MarkerRazred({ element: mjerenja, anchor: "left" })
      .setLngLat([SIM_POSTAJE[0].lon, SIM_POSTAJE[0].lat])
      .addTo(karta),
  );

  // --- postaje vjetra ---
  const vjetrovi = poMjestu().map((m) => {
    const el = element(
      "sim-oznaka sim-oznaka--vjetar",
      `<div class="sim-oznaka__tocka"></div><div class="sim-oznaka__ploca" data-v></div>`,
    );
    pribadace.push(
      new MarkerRazred({ element: el, anchor: "left" }).setLngLat([m.lon, m.lat]).addTo(karta),
    );
    return { ...m, ploca: el.querySelector("[data-v]") as HTMLElement };
  });

  return {
    postavi(kadar, sada, serije, kadrovi, vjetarStigao) {
      // Postaje uz plohu prate klizač: njihov niz je satni.
      const redci = SIM_POSTAJE.map((p) => {
        const zadnje = kadar ? zadnjeOcitanje(kadrovi, kadar.pomak, p.oznaka) : null;
        const n = natpisMjerenja(kadar, p, zadnje);
        const klasa = n.nema ? "sim-oznaka__red sim-oznaka__red--nema" : "sim-oznaka__red";
        const v = n.nema ? `<i>${n.vrijednost}</i>` : n.vrijednost;
        // Sat se piše samo kad brojka nije iz odabranog sata.
        const kada = n.kada ? ` <em>${n.kada}</em>` : "";
        return `<span class="${klasa}"><b>${n.kratica}</b> ${v}${kada}</span>`;
      });
      plocaMjerenja.innerHTML = redci.join("");
      plocaMjerenja.title =
        "Izmjereno na postajama uz plohu, µg/m³. Kad uz brojku stoji sat, " +
        "mjerenje za odabrani sat još nije objavljeno, pa se pokazuje zadnje.";

      for (const m of vjetrovi) {
        const imena = m.postaje.map((k) => POSTAJE[k].oznaka).join(" · ");
        // Ako neka od postaja na ovoj točki ima satni niz, on ima prednost.
        const izNiza = kadar
          ? m.postaje.map((k) => serije.get(k)?.get(kadar.sat)).find(Boolean)
          : undefined;
        const raniji = kadar
          ? m.postaje.map((k) => zadnjiIzNiza(serije.get(k), kadar.sat)).find(Boolean)
          : null;
        const n = natpisVjetra(
          kadar,
          imena,
          sada.find((v) => m.postaje.includes(v.postaja)),
          izNiza,
          raniji,
          vjetarStigao,
        );
        const klasa = n.nema ? "sim-oznaka__red sim-oznaka__red--nema" : "sim-oznaka__red";
        const v = n.nema ? `<i>${n.vrijednost}</i>` : n.vrijednost;
        const kada = n.kada ? ` <em>${n.kada}</em>` : "";
        m.ploca.innerHTML = `<span class="${klasa}"><b>${n.imena}</b> ${v}${kada}</span>`;
        const opis = rijecima(
          izNiza ?? raniji ?? sada.find((v) => m.postaje.includes(v.postaja)),
        );
        m.ploca.title = !opis
          ? vjetarStigao
            ? `${imena} — trenutačno ne javlja`
            : `${imena} — čekam očitanje`
          : izNiza
            ? `${imena} — ${opis}, izmjereno u odabranom satu`
            : `${imena} — ${opis}, izmjereno u ${n.kada}, ne u odabranom satu`;
        m.ploca.setAttribute("aria-label", m.ploca.title);
      }
    },
    vidljivost(vidljive) {
      for (const p of pribadace) {
        p.getElement().style.display = vidljive ? "" : "none";
      }
    },
    ukloni() {
      for (const p of pribadace) p.remove();
      pribadace.length = 0;
    },
  };
}
