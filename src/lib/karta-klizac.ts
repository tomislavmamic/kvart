/**
 * Klizač: pomični razdjelnik koji reže dva Leaflet okna jedno uz drugo.
 *
 * Napisan ručno, a ne preko `leaflet-side-by-side`: taj dodatak iznutra radi
 * `require('./layout.css')`, a Turbopack tu tvornicu ne isporuči modulu
 * povučenom dinamičkim `import()`-om, pa uvoz padne.
 *
 * Izvađen iz map-client.tsx jer ga sada traže DVIJE stvari — usporedba dviju
 * godina namjene i vremeplov između dviju snimaka. Druga kopija istih sto
 * dvadeset redaka razišla bi se prvom ispravkom, i to najvjerojatnije baš u
 * tipkovničkom dijelu, koji se rjeđe isprobava rukom.
 *
 * Račun reza i korak tipke stoje kao čiste funkcije, pa se daju ispitati bez
 * DOM-a (vidi tests/karta-klizac.test.ts); `postaviKlizac` je samo ožičenje.
 */

export interface Tocka {
  x: number;
  y: number;
}

/** Onoliko Leafletove karte koliko klizaču treba — ništa više. */
export interface KartaZaKlizac {
  getSize(): Tocka;
  containerPointToLayerPoint(tocka: [number, number]): Tocka;
  getContainer(): HTMLElement;
  dragging: { enable(): void; disable(): void };
  on(dogadaji: string, rukovatelj: () => void): void;
  off(dogadaji: string, rukovatelj: () => void): void;
}

/** Događaji koje drška guta da ne dobubblaju do karte — vidi `zaustaviSirenje`. */
const MISJI_DOGADAJI = ["mousedown", "click", "dblclick"] as const;

export interface Rezovi {
  /** CSS `clip` za lijevo okno. */
  lijevo: string;
  /** CSS `clip` za desno okno. */
  desno: string;
  /** Vodoravni položaj drške u pikselima spremnika. */
  drska: number;
  /** Postotak za `aria-valuenow`. */
  posto: number;
}

/**
 * Gdje rezati oba okna za zadani omjer.
 *
 * Okna se režu u KOORDINATAMA SLOJA, a drška se postavlja u koordinatama
 * spremnika: Leaflet pri pomicanju karte pomiče sloj ispod nepomičnog
 * spremnika, pa bi jedan sustav za oboje pomaknuo rez pri svakom povlačenju
 * karte. Zato `containerPointToLayerPoint` za rezove i sirova širina za dršku.
 *
 * Args:
 *   nw: Gornji lijevi kut okna, u koordinatama sloja.
 *   se: Donji desni kut okna, u koordinatama sloja.
 *   sirina: Širina spremnika u pikselima.
 *   omjer: Položaj razdjelnika, 0–1.
 *
 * Returns:
 *   Vrijednosti za `style.clip` obaju okna i položaj drške.
 */
export function rezovi(
  nw: Tocka,
  se: Tocka,
  sirina: number,
  omjer: number,
): Rezovi {
  const rez = nw.x + sirina * omjer;
  return {
    lijevo: `rect(${nw.y}px,${rez}px,${se.y}px,${nw.x}px)`,
    desno: `rect(${nw.y}px,${se.x}px,${se.y}px,${rez}px)`,
    drska: sirina * omjer,
    posto: Math.round(omjer * 100),
  };
}

/**
 * Novi omjer nakon pritiska tipke, ili `null` ako tipka nije za klizač.
 *
 * Korak je 2 % po pritisku i 10 % uz PageUp/PageDown — dovoljno sitno da se
 * rez namjesti na granicu jedne čestice, dovoljno krupno da se prijeđe cijela
 * karta bez pedeset pritisaka.
 *
 * Args:
 *   omjer: Trenutačni položaj, 0–1.
 *   tipka: `KeyboardEvent.key`.
 *
 * Returns:
 *   Omjer stegnut na 0–1, ili `null` kad tipka ne pripada klizaču.
 */
export function pomakTipkom(omjer: number, tipka: string): number | null {
  const korak = tipka === "PageUp" || tipka === "PageDown" ? 0.1 : 0.02;
  let n: number;
  if (tipka === "ArrowLeft" || tipka === "ArrowDown" || tipka === "PageDown")
    n = omjer - korak;
  else if (tipka === "ArrowRight" || tipka === "ArrowUp" || tipka === "PageUp")
    n = omjer + korak;
  else if (tipka === "Home") n = 0;
  else if (tipka === "End") n = 1;
  else return null;
  return Math.min(1, Math.max(0, n));
}

/**
 * Postavlja razdjelnik nad dva okna i vraća funkciju za uklanjanje.
 *
 * Args:
 *   map: Karta.
 *   lijevo: Okno koje se vidi lijevo od reza.
 *   desno: Okno koje se vidi desno od reza.
 *   natpisi: Što stoji na kojoj strani — ide u `aria-valuetext`, jer čitaču
 *     zaslona „62” ne znači ništa, a „62 %, lijevo 2011., desno 2023.” znači.
 *
 * Returns:
 *   Funkcija koja miče dršku, odjavljuje rukovatelje i briše rezove.
 */
export function postaviKlizac(
  map: KartaZaKlizac,
  lijevo: HTMLElement,
  desno: HTMLElement,
  natpisi: { lijevo: string; desno: string },
): () => void {
  let omjer = 0.5;
  const drska = document.createElement("div");

  // Razdjelnik koji se DA pomaknuti tipkovnicom.
  //
  // Prije je bio `role="separator"` bez `tabindex`, bez `aria-valuenow` i samo
  // s rukovateljima pokazivača — dakle usporedba dviju godina GUP-a, jedno od
  // tri pitanja s kojima se dolazi na kartu, mišem je radila, a tipkovnicom
  // nije postojala. To je WCAG 2.1.1, razina A, ne AA.
  drska.setAttribute("role", "separator");
  drska.setAttribute("aria-label", "Razdjelnik usporedbe");
  drska.setAttribute("aria-orientation", "vertical");
  drska.setAttribute("tabindex", "0");
  drska.setAttribute("aria-valuemin", "0");
  drska.setAttribute("aria-valuemax", "100");
  drska.style.cssText =
    "position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;" +
    "background:#fff;box-shadow:0 0 4px rgba(0,0,0,.5);cursor:ew-resize;" +
    "z-index:400;touch-action:none";
  drska.classList.add("klizac-rucka", "fokus");
  map.getContainer().appendChild(drska);

  const osvjezi = () => {
    const velicina = map.getSize();
    const r = rezovi(
      map.containerPointToLayerPoint([0, 0]),
      map.containerPointToLayerPoint([velicina.x, velicina.y]),
      velicina.x,
      omjer,
    );
    lijevo.style.clip = r.lijevo;
    desno.style.clip = r.desno;
    drska.style.left = `${r.drska}px`;
    drska.setAttribute("aria-valuenow", String(r.posto));
    drska.setAttribute(
      "aria-valuetext",
      `${r.posto} % — lijevo ${natpisi.lijevo}, desno ${natpisi.desno}`,
    );
  };

  const pomak = (e: PointerEvent) => {
    const okvir = map.getContainer().getBoundingClientRect();
    omjer = Math.min(1, Math.max(0, (e.clientX - okvir.left) / okvir.width));
    osvjezi();
  };

  const naTipku = (e: KeyboardEvent) => {
    const n = pomakTipkom(omjer, e.key);
    if (n === null) return;
    e.preventDefault();
    // Strelice inače pomiču samu kartu (Leaflet ih sluša na spremniku), pa bi
    // se bez zaustavljanja rez i prikaz micali istodobno.
    e.stopPropagation();
    omjer = n;
    osvjezi();
  };

  const kraj = (e: PointerEvent) => {
    drska.releasePointerCapture(e.pointerId);
    drska.removeEventListener("pointermove", pomak);
    map.dragging.enable();
  };

  /**
   * Drška je DIJETE Leafletova spremnika, pa sve što se na njoj dogodi
   * dobubla do karte. To je kvarilo dvije stvari odjednom:
   *
   * 1. `click` je otvarao dosje čestice zatečene pod razdjelnikom — rez se
   *    pomakne, a preko pola zaslona se otvori ploča koju nitko nije tražio.
   * 2. `mousedown` je davao fokus spremniku karte (Leaflet ga ondje uzima za
   *    svoje tipkovničke prečace), pa je drška fokus gubila istog trenutka
   *    kad bi ga dobila. Tko je dršku uhvatio mišem pa htio dovršiti
   *    strelicama, tipkao je u prazno.
   *
   * Tabom se do drške dolazilo i prije, pa se rukom nije primjećivalo.
   */
  const zaustaviSirenje = (e: Event) => e.stopPropagation();

  const pocetak = (e: PointerEvent) => {
    // `preventDefault` ovdje zaustavlja označavanje teksta i nativno
    // povlačenje — ali usput zaustavlja i to da drška dobije fokus, jer
    // preglednik fokus dodjeljuje upravo zadanom radnjom pritiska.
    //
    // Posljedica je bila tiha: tko dršku uhvati mišem pa htjedne dovršiti
    // strelicama, tipkao je u prazno — fokus je ostao na <body>, a strelice
    // je pojela karta. Tabom se do drške i dalje dolazilo, pa se rukom nije
    // primjećivalo. Zato se fokus postavlja izrijekom.
    e.preventDefault();
    drska.focus({ preventScroll: true });
    drska.setPointerCapture(e.pointerId);
    drska.addEventListener("pointermove", pomak);
    map.dragging.disable();
  };

  drska.addEventListener("pointerdown", pocetak);
  drska.addEventListener("pointerup", kraj);
  drska.addEventListener("keydown", naTipku);
  for (const dogadaj of MISJI_DOGADAJI)
    drska.addEventListener(dogadaj, zaustaviSirenje);
  map.on("move zoom resize", osvjezi);
  osvjezi();

  return () => {
    map.off("move zoom resize", osvjezi);
    drska.removeEventListener("pointerdown", pocetak);
    drska.removeEventListener("pointerup", kraj);
    drska.removeEventListener("keydown", naTipku);
    for (const dogadaj of MISJI_DOGADAJI)
      drska.removeEventListener(dogadaj, zaustaviSirenje);
    drska.remove();
    lijevo.style.clip = "";
    desno.style.clip = "";
  };
}
