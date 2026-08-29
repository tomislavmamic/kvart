/**
 * Provjera dojava na modelu prijenosa: sat po sat, dojava po dojavom.
 *
 * Za svaku dojavu (razloženu na satna opažanja, istim pravilima kao ruža u
 * `src/lib/dojave.ts`) ispisuje izmjereni vjetar toga sata, smjer prema
 * odlagalištu iz mjesta dojave i kutnu razliku — pa se vidi slaže li se
 * tvrdnja modela („miris donosi vjetar koji puše od plohe prema kući”)
 * s onim što su ljudi javili.
 *
 * Pokretanje: npx tsx scripts/provjeri-dojave.ts
 */
import { readFileSync } from "node:fs";

import { sektor, SEKTOR_IMENA, TEZINA, vjetarUSatu } from "@/lib/dojave";
import type { OdourStrength } from "@/lib/constants";

type Red = {
  id: number;
  occurredAt: string;
  endedAt: string | null;
  smelled: boolean;
  strength: OdourStrength | null;
  place: string | null;
  reporterId: string | null;
  lat: number | null;
  lng: number | null;
  hidden: boolean;
};

/** Težište glavne plohe (features[0] u karepovac.geojson — isto što model puši). */
const PLOHA = { lat: 43.52154, lng: 16.5105 };
/** Manja ploha sjeverno od glavne; nije izvor u modelu, ali jest odlagalište. */
const MANJA = { lat: 43.52909, lng: 16.50287 };

/** Mjesta bez koordinate, po adresi iz `place` (kucni-brojevi.geojson). */
const ADRESE: Record<string, { lat: number; lng: number }> = {
  "Dračevac 7B": { lat: 43.527789, lng: 16.50401 },
  // Sredina ulice (Nominatim ne zna broj 59); ulica je duga ~1,5 km pa je
  // ovo ±0,7 km — dovoljno za smjer prema plohi, ne i za više od toga.
  "Matoševa ulica 59, Solin": { lat: 43.5312, lng: 16.4995 },
};

/**
 * Vjetar za sate iza kraja generiranog niza: izmjereno na Split-3 (AZO,
 * postaja 305), skinut 29. 8. 2026. Isti izvor koji `spoj` stavlja na prvo
 * mjesto, pa se ništa ne miješa.
 */
const DOPUNA_VJETRA: Record<number, { smjer: number; brzina: number }> = {
  [Date.UTC(2026, 7, 29, 6) / 3_600_000]: { smjer: 161, brzina: 0.9 },
  [Date.UTC(2026, 7, 29, 8) / 3_600_000]: { smjer: 167, brzina: 1.4 },
};

/** Open-Meteo: modelska dubina miješanog sloja, za kontekst uz svaki sat. */
const METEO: Record<string, { smjer: number; brzina: number; dubina: number }> =
  JSON.parse(
    readFileSync(
      "/private/tmp/claude-501/-Users-tomo/8ddcad46-9be2-4447-acd0-97458b67575b/scratchpad/openmeteo.json",
      "utf8",
    ),
  );

function tocka(r: Red): { lat: number; lng: number } | null {
  if (r.lat !== null && r.lng !== null) return { lat: r.lat, lng: r.lng };
  return r.place ? (ADRESE[r.place] ?? null) : null;
}

/** Azimut i udaljenost od `a` prema `b` (ravninska aproksimacija, dovoljna <5 km). */
function premaIzvoru(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (b.lat - a.lat) * 111_320;
  const dx = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const azimut = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return { azimut, metara: Math.hypot(dx, dy) };
}

/** Najmanja kutna razlika dvaju azimuta. */
function kut(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Isti raspis sata kao `satiDojave` u dojave.ts. */
function sati(r: Red): number[] {
  const pocetak = Math.floor(Date.parse(r.occurredAt) / 3_600_000);
  const kraj = r.endedAt ? Math.floor((Date.parse(r.endedAt) - 1) / 3_600_000) : pocetak;
  if (!(kraj > pocetak)) return [pocetak];
  const zadnji = Math.min(kraj, pocetak + 5);
  const s: number[] = [];
  for (let h = pocetak; h <= zadnji; h += 1) s.push(h);
  return s;
}

const dojave: Red[] = JSON.parse(readFileSync("data/dojave.json", "utf8"));

// Sažimanje po dojavitelju i satu, isto kao u ruži: jače nadjačava slabije.
type Opazanje = { sat: number; red: Red };
const poKljucu = new Map<string, Opazanje>();
for (const r of dojave.filter((d) => !d.hidden)) {
  for (const sat of sati(r)) {
    const kljuc = `${r.reporterId ?? `?${r.id}`}@${sat}`;
    const dosad = poKljucu.get(kljuc);
    const jace =
      !dosad ||
      (r.smelled && !dosad.red.smelled) ||
      (r.smelled === dosad.red.smelled &&
        (r.smelled ? TEZINA[r.strength ?? "osjetno"] : 0) >
          (dosad.red.smelled ? TEZINA[dosad.red.strength ?? "osjetno"] : 0));
    if (jace) poKljucu.set(kljuc, { sat, red: r });
  }
}

const opazanja = [...poKljucu.values()].sort((a, b) => a.sat - b.sat);
console.log(`${dojave.length} dojava → ${opazanja.length} satnih opažanja\n`);

const fmt = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

let pogodak = 0, promasaj = 0, tisina = 0, bezVjetra = 0;

for (const { sat, red } of opazanja) {
  const kada = new Date(sat * 3_600_000);
  const vjetar = vjetarUSatu(kada) ?? DOPUNA_VJETRA[sat] ?? null;
  const meteo = METEO[kada.toISOString().slice(0, 13) + ":00"];
  const t = tocka(red);
  const glava = `#${red.id} ${fmt.format(kada)} ${red.place ?? "?"} — ${
    red.smelled ? (red.strength ?? "osjetno") : "NIJE smrdjelo"
  }`;
  if (!vjetar) {
    console.log(`${glava}\n    vjetar: nema podatka za taj sat\n`);
    bezVjetra += 1;
    continue;
  }
  const smjer =
    `${vjetar.smjer.toFixed(0)}° (${SEKTOR_IMENA[sektor(vjetar.smjer)]}) ${vjetar.brzina.toFixed(1)} m/s` +
    (meteo ? `, sloj ${meteo.dubina.toFixed(0)} m` : "");
  if (!t) {
    console.log(`${glava}\n    vjetar iz ${smjer}; mjesto nepoznato\n`);
    continue;
  }
  const g = premaIzvoru(t, PLOHA);
  const m = premaIzvoru(t, MANJA);
  const dg = kut(vjetar.smjer, g.azimut);
  const dm = kut(vjetar.smjer, m.azimut);
  // Sud ide protiv modela kakav u kodu jest: izvor je samo glavna ploha
  // (maska_plohe čita features[0]). Manja ploha stoji u ispisu kao napomena.
  const slabo = vjetar.brzina <= 1.0;
  const nosi = dg <= 45;
  let sud: string;
  if (red.smelled) {
    if (nosi) { sud = "✓ vjetar s plohe"; pogodak += 1; }
    else if (slabo) { sud = "✗/~ vjetar s druge strane, ali ≤1 m/s (model: vrtloženje šire od smjera)"; promasaj += 1; }
    else { sud = "✗ vjetar s druge strane"; promasaj += 1; }
  } else {
    if (!nosi) { sud = "✓ vjetar ne ide od plohe"; tisina += 1; }
    else { sud = "✗ vjetar s plohe, a nije smrdjelo"; promasaj += 1; }
  }
  console.log(glava);
  console.log(
    `    vjetar iz ${smjer}; ploha na ${g.azimut.toFixed(0)}°/${(g.metara / 1000).toFixed(2)} km ` +
    `(Δ${dg.toFixed(0)}°), manja na ${m.azimut.toFixed(0)}°/${(m.metara / 1000).toFixed(2)} km (Δ${dm.toFixed(0)}°)`,
  );
  console.log(`    ${sud}\n`);
}

console.log(
  `slaganje: ${pogodak + tisina}/${opazanja.length - bezVjetra} ` +
  `(mirisa uz vjetar s plohe ili tišinu: ${pogodak}; tišine uz vjetar s druge strane: ${tisina}; ` +
  `protiv modela: ${promasaj}; bez vjetra: ${bezVjetra})`,
);
