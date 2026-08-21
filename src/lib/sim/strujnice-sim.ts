/**
 * Strujnice kroz polje vjetra simulatora.
 *
 * Kartica „Kuda vjetar nosi zrak s plohe” na `/karepovac` ne crta strelice nego
 * strujnice: duge putanje koje prate struju, s tankim svijetlim potezom koji
 * po njima teče. Razlog nije ukras. Strelica kaže kamo vjetar puše **u jednoj
 * točki**, a to je najmanje zanimljivo pitanje nad ovim reljefom — zanima nas
 * kamo zrak s plohe **dođe**, a to je putanja, ne smjer.
 *
 * Ovdje je isti račun, ali nad širim poljem i za kartu umjesto SVG-a:
 * sjeme se posije po rešetki, pa se prati sredinom koraka (RK2) dok putanja ne
 * izađe iz okvira ili ne potroši korake.
 *
 * Uz svaku točku pamti se i **vrijeme** koje je zrak dotad putovao. To je ono
 * što potezu daje brzinu: crtica koja teče po jednakim razmacima vremena sama
 * od sebe juri ondje gdje je vjetar jak, a jedva se miče ondje gdje je tišina —
 * bez ijedne postavke koja bi to glumila.
 */

/** Koliko sjemena po osi; gušće od ovoga postane šara, a ne struja. */
const PO_OSI = 11;

/** Duljina koraka u ćelijama polja. */
const KORAK_CELIJA = 0.9;

/** Najviše koraka po putanji; duže se ionako izgubi izvan okvira. */
const NAJVISE_KORAKA = 260;

/** Ispod ove brzine putanja prestaje; tišina nema kamo voditi. */
const NAJMANJA_BRZINA = 0.02;

export type Strujnica = {
  /** Točke putanje kao udjeli okvira (0–1), redom. */
  readonly tocke: readonly (readonly [number, number])[];
  /** Vrijeme putovanja do svake točke, u sekundama. */
  readonly vremena: readonly number[];
};

/** Bilinearno očitanje polja u udjelima okvira. */
function uzorak(
  A: Float32Array,
  gw: number,
  gh: number,
  x: number,
  y: number,
): number {
  const fx = Math.min(1, Math.max(0, x)) * (gw - 1);
  const fy = Math.min(1, Math.max(0, y)) * (gh - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(gw - 1, i0 + 1);
  const j1 = Math.min(gh - 1, j0 + 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = A[j0 * gw + i0];
  const b = A[j0 * gw + i1];
  const c = A[j1 * gw + i0];
  const d = A[j1 * gw + i1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Izvodi strujnice kroz polje vjetra.
 *
 * Args:
 *   vx: Brzina prema istoku po ćeliji, u m/s.
 *   vy: Brzina prema jugu po ćeliji, u m/s (y rešetke raste prema jugu).
 *   gw: Širina rešetke u ćelijama.
 *   gh: Visina rešetke u ćelijama.
 *   sirinaM: Širina okvira u metrima.
 *   visinaM: Visina okvira u metrima.
 *
 * Returns:
 *   Putanje s vremenima putovanja; prazne se izostavljaju.
 */
export function izvediStrujnice(
  vx: Float32Array,
  vy: Float32Array,
  gw: number,
  gh: number,
  sirinaM: number,
  visinaM: number,
): Strujnica[] {
  const korakX = (KORAK_CELIJA / gw);
  const izlaz: Strujnica[] = [];

  for (let j = 0; j < PO_OSI; j += 1) {
    for (let i = 0; i < PO_OSI; i += 1) {
      // Rešetka se razbija dvaput: pomakom svakog drugog retka i sitnim
      // determinističkim odmakom. Bez toga u gotovo jednolikom vjetru sve
      // putanje izađu usporedne i jednako razmaknute, pa polje izgleda kao
      // češalj umjesto kao struja.
      const sjeme = Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453;
      const mrva = sjeme - Math.floor(sjeme) - 0.5;
      const sjeme2 = Math.sin((i + 1) * 39.3468 + (j + 1) * 11.135) * 24634.6345;
      const mrva2 = sjeme2 - Math.floor(sjeme2) - 0.5;
      const x0 = (i + 0.5 + (j % 2) * 0.5 + mrva * 0.7) / PO_OSI;
      const y0 = (j + 0.5 + mrva2 * 0.7) / PO_OSI;
      if (!(x0 > 0 && x0 < 1 && y0 > 0 && y0 < 1)) continue;

      const tocke: [number, number][] = [];
      const vremena: number[] = [];
      let x = x0;
      let y = y0;
      let t = 0;

      for (let k = 0; k < NAJVISE_KORAKA; k += 1) {
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) break;
        tocke.push([x, y]);
        vremena.push(t);

        // RK2: smjer se uzima na sredini koraka, inače putanja siječe zavoje.
        const ux = uzorak(vx, gw, gh, x, y);
        const uy = uzorak(vy, gw, gh, x, y);
        const brzina = Math.hypot(ux, uy);
        if (!(brzina > NAJMANJA_BRZINA)) break;

        // Korak je stalne **duljine**, pa gustoća točaka ne ovisi o brzini.
        const dx = (ux / brzina) * korakX;
        const dy = (uy / brzina) * korakX * (sirinaM / visinaM);
        const sx = uzorak(vx, gw, gh, x + dx / 2, y + dy / 2);
        const sy = uzorak(vy, gw, gh, x + dx / 2, y + dy / 2);
        const sBrzina = Math.hypot(sx, sy);
        if (!(sBrzina > NAJMANJA_BRZINA)) break;

        const kx = (sx / sBrzina) * korakX;
        const ky = (sy / sBrzina) * korakX * (sirinaM / visinaM);
        x += kx;
        y += ky;
        // Vrijeme koje je zrak potrošio na taj potez, pri brzini na sredini.
        t += (KORAK_CELIJA * (sirinaM / gw)) / sBrzina;
      }

      // Putanja od dvije točke nije struja nego točka; ne crta se.
      if (tocke.length > 3) izlaz.push({ tocke, vremena });
    }
  }
  return izlaz;
}
