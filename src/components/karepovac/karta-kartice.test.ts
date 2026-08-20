import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  BLIZI_OKVIR,
  CESTE_UZ_PLOHU,
  OKVIR,
  PODLOGA,
  PRSTENI,
  TOCKE,
  TOKOVI,
  VIIRS,
  VISINE,
} from "@/generated/karepovac-karta";

const izvor = readFileSync(
  join(process.cwd(), "src/components/karepovac/karta-kartice.tsx"),
  "utf8",
);

const ploha = JSON.parse(
  readFileSync(join(process.cwd(), "public/geo/karepovac.geojson"), "utf8"),
) as {
  features: { properties: Record<string, string>; geometry: { type: string } }[];
};

test("obris odlagališta nosi izvor i licenciju", () => {
  const karepovac = ploha.features.find((f) => f.properties.naziv === "Karepovac");
  assert.ok(karepovac, "nema poligona imena Karepovac");
  assert.equal(karepovac.geometry.type, "Polygon");
  for (const f of ploha.features) {
    assert.match(f.properties.izvor, /OpenStreetMap \(ODbL\)/);
    assert.match(f.properties.osm_id, /^way\/\d+$/);
  }
});

test("okvir je isti za sve kartice i ima mjerilo", () => {
  assert.equal(OKVIR.viewBox, `0 0 ${OKVIR.sirina} ${OKVIR.visina}`);
  // 500 m na karti mora odgovarati mjerilu, inače kartice nisu usporedive
  assert.ok(Math.abs(OKVIR.mjerilo500 - 500 * OKVIR.pxPoMetru) < 0.1);
  assert.ok(Math.abs(BLIZI_OKVIR.mjerilo200 - 200 * OKVIR.pxPoMetru) < 0.1);
  // bliži okvir mora biti uži od cijelog kvarta, inače nema smisla
  assert.ok(BLIZI_OKVIR.sirina < OKVIR.sirina);
  assert.ok(
    Math.abs(BLIZI_OKVIR.sirina / BLIZI_OKVIR.visina - OKVIR.sirina / OKVIR.visina) < 0.01,
    "bliži okvir mora zadržati omjer stranica",
  );
});

test("podloga ima sve slojeve i nijedan nije prazan", () => {
  for (const [ime, d] of Object.entries(PODLOGA)) {
    assert.ok(d.length > 40, `sloj ${ime} je prazan`);
    assert.match(d, /^M/, `sloj ${ime} ne počinje pomakom`);
  }
  assert.ok(CESTE_UZ_PLOHU.length > 40);
  assert.ok(TOKOVI.sPlohe.length > 40);
  assert.ok(TOKOVI.izvori.length > 0);
});

test("kvart stvarno leži ispod odlagališta", () => {
  assert.ok(
    VISINE.tijelo[0] > VISINE.dracevac[0],
    "tijelo odlagališta mora počinjati iznad Dračevca",
  );
  assert.ok(
    VISINE.dracevac[1] > VISINE.bilice[1],
    "Bilice moraju biti najniže",
  );
  assert.ok(VISINE.najblizaKuca > 0 && VISINE.najblizaKuca < 100);
});

test("mjerne točke idu od plohe prema kvartu i padaju u visini", () => {
  assert.equal(TOCKE.length, 8);
  for (let i = 1; i < TOCKE.length; i += 1) {
    assert.ok(TOCKE[i].d > TOCKE[i - 1].d, "točke moraju biti složene po udaljenosti");
  }
  assert.ok(TOCKE[0].visina > TOCKE[TOCKE.length - 1].visina);
  assert.ok(
    TOCKE.some((t) => t.d === 799),
    "treba postojati točka na 800 m, ona je naglašena na kartici bunara",
  );
  for (const t of TOCKE) {
    assert.ok(["Dračevac", "Bilice"].includes(t.zona));
  }
});

test("prstenovi i satelitska mreža nose stvarne mjere", () => {
  assert.deepEqual(
    PRSTENI.map((p) => p.metara),
    [400, 800, 1200],
  );
  assert.equal(PRSTENI.filter((p) => p.istaknut).length, 1);
  // ćelija je 375 m, koliko i razlučivost dojave — to je poanta kartice
  assert.ok(Math.abs(VIIRS[0].a - 375 * OKVIR.pxPoMetru) < 0.2);
  assert.ok(VIIRS.some((c) => c.pogodak), "nijedna ćelija ne pada na plohu");
  assert.ok(VIIRS.some((c) => !c.pogodak), "sve ćelije padaju na plohu");
});

test("kvart leži sjeverozapadno od plohe", () => {
  // O ovoj osi visi i to nosi li vjetar prema kvartu; strujnice se provjeravaju
  // u strujnice.test.ts, na polju koje se slaže u izvođenju.
  assert.ok(OKVIR.azimut > 270 && OKVIR.azimut < 320);
});

test("stranica nosi svih jedanaest kartica, svaku s oznakom izvora", () => {
  const kartica = izvor.match(/<Kartica\b/g) ?? [];
  assert.equal(kartica.length, 11);
  const oznake = izvor.match(/izvorOznaka="/g) ?? [];
  assert.equal(oznake.length, 11);
  const opisi = izvor.match(/opis="[^"]/g) ?? [];
  assert.ok(opisi.length >= 11);
});

test("svaka karta ima tekstualni opis za čitač zaslona", () => {
  // Kartica mirisa nosi KartaDima jer joj se perjanica računa u pregledniku;
  // za čitač zaslona je to ista obveza kao i kod nepomičnih karata.
  const karte = izvor.match(/<Karta(?:Dima)?\b/g) ?? [];
  // Deset kartica ima kartu — obveze i rokovi nemaju jer nisu prostorni
  // podatak — a jedanaesta je velika perjanica za /karepovac/zrak.
  assert.equal(karte.length, 11);
  assert.doesNotMatch(izvor, /<Karta(?:Dima)?\s+opis={?""/);
});

test("perjanica se crta na platnu, ispod natpisa i uz obris plohe", () => {
  // Redoslijed je jedina stvar koja ovdje može tiho puknuti: platno mora leći
  // preko podloge, a natpisi preko platna, inače dim proguta imena mjesta.
  // Provjerava se u obje složbe — u kartici (`KartaDima`) i u velikom prikazu
  // s izborom tvari, jer su to dva odvojena mjesta koja slažu iste tri sloja.
  const odKarte = izvor.slice(izvor.indexOf("export function KartaDima"));
  for (const [ime, tijelo] of [
    ["KartaDima", odKarte.slice(0, odKarte.indexOf("\n/**"))],
    [
      "PerjanicaSIzborom",
      readFileSync(
        join(process.cwd(), "src/components/karepovac/perjanica-s-izborom.tsx"),
        "utf8",
      ),
    ],
  ] as const) {
    const podloga = tijelo.search(/\{podloga\}|<PodlogaKarte\b/);
    const platno = tijelo.search(/<(DimPerjanica|img)\b/);
    const natpisi = tijelo.search(/\{natpisi\}|<NatpisiKarte\b/);
    assert.ok(podloga >= 0, `${ime}: nema podloge`);
    assert.ok(platno > podloga, `${ime}: platno ne dolazi nakon podloge`);
    assert.ok(natpisi > platno, `${ime}: natpisi ne dolaze nakon platna`);
  }
  // Natpisi ne smiju hvatati klikove — ispod njih je karta.
  assert.match(izvor, /aria-label={opis}[\s\S]{0,120}pointer-events-none/);
});

test("izbor tvari ne ruši simulaciju, nego samo ljestvicu", () => {
  // Sumporovodik i merkaptani putuju istim zrakom; da promjena tvari ulazi u
  // ovisnosti učinka, perjanica bi pri svakom kliku krenula od prazne karte.
  const perjanica = readFileSync(
    join(process.cwd(), "src/components/karepovac/dim-perjanica.tsx"),
    "utf8",
  );
  const ovisnosti = perjanica.match(/\}, \[([^\]]*)\]\);/g) ?? [];
  const glavni = ovisnosti.find((o) => o.includes("polje"));
  assert.ok(glavni, "učinak simulacije nema ovisnost o polju vjetra");
  assert.doesNotMatch(glavni, /tvar/, "tvar ne smije rušiti simulaciju");
});

test("gibanje ima mirnu inačicu", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const razred = ["karepovac-tece", "karepovac-struja", "karepovac-puls", "karepovac-plamen"];
  const mirno = css.slice(css.lastIndexOf("prefers-reduced-motion"));
  for (const r of razred) {
    assert.match(css, new RegExp(`\\.${r}\\b`), `nedostaje stil .${r}`);
    assert.match(mirno, new RegExp(`\\.${r}\\b`), `.${r} nema mirnu inačicu`);
  }
});

test("podloga je potpisana jer je izvedena iz tuđih slojeva", () => {
  // OSM je pod ODbL — potpis mora biti vidljiv na stranici, ne samo u datoteci
  assert.match(izvor, /OpenStreetMapa \(ODbL\)/);
  assert.match(izvor, /Državne geodetske uprave/);
});

test("pregled i projekt su razdvojeni", () => {
  const pregled = readFileSync(join(process.cwd(), "src/app/karepovac/page.tsx"), "utf8");
  const projekt = readFileSync(
    join(process.cwd(), "src/app/karepovac/(projekt)/zrak/page.tsx"),
    "utf8",
  );

  // /karepovac je samo pregled — kartice i ništa drugo
  assert.match(pregled, /<KarepovacKarte \/>/);
  assert.doesNotMatch(pregled, /KAREPOVAC_PHASES|EvidenceRegister|MonitoringField/);

  // projekt praćenja zraka ne smije ponovno vući kartice
  assert.doesNotMatch(projekt, /KarepovacKarte/);
  assert.match(projekt, /KAREPOVAC_PHASES/);
});

test("u projekt se ulazi kroz karticu mirisa", () => {
  assert.match(izvor, /poveznica="\/karepovac\/zrak"/);
  const poveznice = izvor.match(/poveznica="/g) ?? [];
  assert.equal(poveznice.length, 1, "samo kartica mirisa vodi u projekt");

  const nav = readFileSync(join(process.cwd(), "src/lib/karepovac.ts"), "utf8");
  assert.match(nav, /\{ href: "\/karepovac\/zrak", label: "Pregled" \}/);
  assert.doesNotMatch(nav, /\{ href: "\/karepovac", label/);
});
