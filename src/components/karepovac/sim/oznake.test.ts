import assert from "node:assert/strict";
import test from "node:test";

import {
  natpisMjerenja,
  natpisVjetra,
  zadnjeOcitanje,
  zadnjiIzNiza,
} from "@/components/karepovac/sim/oznake";
import type { Kadar } from "@/lib/sim/kadrovi";
import { SIM_POSTAJE } from "@/lib/sim/postaje-satno";
import { POSTAJE_VJETRA } from "@/generated/karepovac-karta";
import { POSTAJE, type Vjetar } from "@/lib/vjetar";

const K1 = SIM_POSTAJE[0];
const K2 = SIM_POSTAJE[1];

function kadar(p: Partial<Kadar> = {}): Kadar {
  return {
    sat: "2026-08-21T15:00:00.000Z",
    pomak: -1,
    vrsta: "izmjereno",
    dostupnost: "spreman",
    stanje: { smjerOd: 112.5, brzina: 1.2, dubina: 80 },
    vjetar: null,
    izvor: "split3",
    ocitanja: [
      { postaja: "k1", tvar: "sumporovodik", vrijednost: 2.758, jedinica: "µg/m³", ispodGranice: false },
      { postaja: "k2", tvar: "merkaptani", vrijednost: null, jedinica: "µg/m³", ispodGranice: false },
    ],
    ...p,
  };
}

const OCITANJE: Vjetar = {
  postaja: "marjan",
  smjerOd: 270,
  brzina: 3.4,
  tisina: false,
  promjenjiv: false,
  opazeno: "2026-08-21T15:00:00.000Z",
};

test("izmjerena vrijednost stoji uz svoju tvar", () => {
  const n = natpisMjerenja(kadar(), K1);
  assert.equal(n.kratica, "H₂S");
  assert.equal(n.vrijednost, "2,76");
  assert.equal(n.nema, false);
});

test("postaja koja šuti ostaje na karti, s prazninom umjesto nule", () => {
  const n = natpisMjerenja(kadar(), K2);
  assert.equal(n.vrijednost, "nema");
  assert.equal(n.nema, true, "šutnja se mora čitati drukčije od izmjerenog");
});

test("prognozirani sat ne nosi brojku", () => {
  const n = natpisMjerenja(kadar({ vrsta: "prognoza", ocitanja: [] }), K1);
  assert.equal(n.vrijednost, "—");
  assert.equal(n.nema, true);
});

test("bez kadra se ne izmišlja vrijednost", () => {
  assert.equal(natpisMjerenja(null, K1).vrijednost, "—");
});

test("postaja bez povijesti pokazuje zadnje očitanje, uz sat", () => {
  const sada = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-Marjan", OCITANJE);
  assert.match(sada.vrijednost, /^3,4 m\/s <svg/);
  assert.ok(sada.kada, "i na sadašnjem satu stoji sat očitanja, jer nije satni niz");

  // Klizač u prošlosti: DHMZ nema povijest, pa je zadnje očitanje jedino što
  // postoji. Ono je čak i novije od odabranog sata — zato sat mora stajati uz
  // brojku, inače bi ispalo da je izmjereno onda kad nije.
  const prije = natpisVjetra(kadar(), "Split-Marjan", OCITANJE);
  assert.match(prije.vrijednost, /^3,4 m\/s <svg/);
  assert.ok(prije.kada, "brojka iz drugog sata ne smije stajati bez sata");
  assert.equal(prije.nema, false);
});

test("postaja koja nikad nije javila to i kaže", () => {
  const n = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-Marjan", undefined);
  assert.equal(n.vrijednost, "šuti");
  assert.equal(n.nema, true);
  assert.equal(n.kada, null);
});

test("tišina se piše riječju, jer smjer tada ništa ne znači", () => {
  const n = natpisVjetra(
    kadar({ vrsta: "sada", pomak: 0 }),
    "Split-Marjan",
    { ...OCITANJE, brzina: 0.2, tisina: true },
  );
  assert.equal(n.vrijednost, "tišina");
});

test("svaka postaja vjetra ima provjereno mjesto, iz jednog registra", () => {
  const mjesta = new Map<string, (typeof POSTAJE_VJETRA)[number]>(
    POSTAJE_VJETRA.map((p) => [p.oznaka, p]),
  );
  for (const oznaka of Object.keys(POSTAJE)) {
    assert.ok(mjesta.has(oznaka), `${oznaka} nema mjesto u registru`);
  }
  // Podrijetlo svake točke mora biti zapisano; bez toga se ne zna je li
  // nađena na terenu ili prepisana iz popisa koji promašuje desetke metara.
  for (const p of POSTAJE_VJETRA) {
    assert.ok(p.podrijetlo.length > 10, `${p.oznaka} bez podrijetla`);
  }
  const aerodrom = mjesta.get("aerodrom")!;
  const ldsp = mjesta.get("ldsp")!;
  assert.deepEqual(
    [aerodrom.lat, aerodrom.lon],
    [ldsp.lat, ldsp.lon],
    "METAR mjeri na istoj zračnoj luci, pa je to jedna točka",
  );
});

test("postaje uz plohu stoje na izmjerenoj točki, ne na AZO-ovu zaokruženju", () => {
  assert.ok(
    Math.abs(K1.lat - 43.5166505) < 1e-6 && Math.abs(K1.lon - 16.5169123) < 1e-6,
    "koordinata mora biti precizna, ne zaokružena na tri decimale",
  );
  assert.deepEqual([K1.lat, K1.lon], [K2.lat, K2.lon], "obje postaje su na istom mjestu");
});

test("postaja sa satnim nizom prati klizač, i u prošlosti", () => {
  // AZO objavljuje satni niz, pa Split-2 ne mora čekati sadašnji sat.
  const niz = {
    sat: "2026-08-21T15:00:00.000Z",
    smjerOd: 45,
    brzina: 2.2,
    tisina: false,
    izvor: "split2" as const,
  };
  const n = natpisVjetra(kadar(), "Split-2", undefined, niz);
  assert.match(n.vrijednost, /^2,2 m\/s <svg/);
  assert.equal(n.nema, false, "niz ima povijest, pa brojka stoji i unatrag");
});

test("satni niz ima prednost pred zadnjim očitanjem", () => {
  const niz = {
    sat: "2026-08-21T15:00:00.000Z",
    smjerOd: 45,
    brzina: 2.2,
    tisina: false,
    izvor: "split2" as const,
  };
  const n = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "Split-2", OCITANJE, niz);
  assert.match(n.vrijednost, /^2,2 m\/s <svg/, "za odabrani sat vrijedi niz, ne zadnje očitanje");
});

test("kad mjerenje za sat još nije objavljeno, pokazuje se zadnje — sa satom", () => {
  const kadrovi: Kadar[] = [
    kadar({ pomak: -2, sat: "2026-08-21T13:00:00.000Z" }),
    kadar({
      pomak: -1,
      sat: "2026-08-21T14:00:00.000Z",
      ocitanja: [
        { postaja: "k1", tvar: "sumporovodik", vrijednost: null, jedinica: "µg/m³", ispodGranice: false },
      ],
    }),
    kadar({ pomak: 0, vrsta: "sada", sat: "2026-08-21T15:00:00.000Z", ocitanja: [] }),
  ];
  const sada = kadrovi[2];
  const zadnje = zadnjeOcitanje(kadrovi, sada.pomak, "k1");
  assert.equal(zadnje?.sat, "2026-08-21T13:00:00.000Z", "preskače sat bez vrijednosti");

  const n = natpisMjerenja(sada, K1, zadnje);
  assert.equal(n.vrijednost, "2,76");
  assert.equal(n.nema, false, "brojka postoji, samo je iz ranijeg sata");
  assert.ok(n.kada, "uz staru brojku mora stajati sat u kojem je izmjerena");
});

test("brojka iz odabranog sata nema sat uz sebe", () => {
  const n = natpisMjerenja(kadar(), K1, { vrijednost: 9.9, sat: "2026-08-20T10:00:00.000Z" });
  assert.equal(n.vrijednost, "2,76", "vrijednost odabranog sata ima prednost");
  assert.equal(n.kada, null, "sat se piše samo kad brojka nije iz odabranog sata");
});

test("kad postaja nikad nije javila, ostaje praznina", () => {
  const prazni = [kadar({ pomak: 0, vrsta: "sada", ocitanja: [] })];
  assert.equal(zadnjeOcitanje(prazni, 0, "k1"), null);
  assert.equal(natpisMjerenja(prazni[0], K1, null).vrijednost, "nema");
});

test("prognozirani sat ne posuđuje mjerenje iz prošlosti", () => {
  const n = natpisMjerenja(kadar({ vrsta: "prognoza", pomak: 2 }), K1, {
    vrijednost: 2.5,
    sat: "2026-08-21T13:00:00.000Z",
  });
  assert.equal(n.vrijednost, "—", "budućnost se ne popunjava prošlošću");
});

test("sve pribadače vjetra nose isti oblik: brzina, mjera, smjer", () => {
  const oblik = /^\d+,\d m\/s <svg class="sim-oznaka__strelica"/;
  const sada = kadar({ vrsta: "sada", pomak: 0 });

  // Postaja sa satnim nizom i postaja sa zadnjim očitanjem moraju izgledati
  // jednako; gledatelj ne treba znati koja od njih objavljuje povijest.
  const izNiza = natpisVjetra(sada, "Split-2", undefined, {
    sat: sada.sat, smjerOd: 200, brzina: 2.2, tisina: false, izvor: "split2",
  });
  const izOcitanja = natpisVjetra(sada, "Split-Marjan", OCITANJE);
  for (const n of [izNiza, izOcitanja]) {
    assert.match(n.vrijednost, oblik, `${n.imena}: „${n.vrijednost}” nije u dogovorenom obliku`);
  }
});

test("strelica pokazuje kamo nosi, a ne odakle puše", () => {
  // Vjetar iz juga (180°) nosi zrak prema sjeveru; strelica mora biti
  // zaokrenuta za 0°, dakle prema vrhu. Da pokazuje odakle puše, bilo bi 180°.
  const juzni = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "P", {
    ...OCITANJE, smjerOd: 180,
  });
  assert.match(juzni.vrijednost, /rotate\(0 6 6\)/, "jugo nosi prema sjeveru");

  const zapadni = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "P", {
    ...OCITANJE, smjerOd: 270,
  });
  assert.match(zapadni.vrijednost, /rotate\(90 6 6\)/, "zapadnjak nosi prema istoku");
});

test("pri tišini nema strelice, jer smjer tada ništa ne znači", () => {
  const n = natpisVjetra(kadar({ vrsta: "sada", pomak: 0 }), "P", {
    ...OCITANJE, brzina: 0.2, tisina: true,
  });
  assert.equal(n.vrijednost, "tišina");
  assert.doesNotMatch(n.vrijednost, /svg/);
});

test("očitanje iz odabranog sata nema sat uz sebe, ono iz drugog ga ima", () => {
  const k = kadar();
  const uSatu = { sat: k.sat, smjerOd: 200, brzina: 2.2, tisina: false, izvor: "split2" as const };
  const raniji = { ...uSatu, sat: "2026-08-21T11:00:00.000Z", brzina: 1.4 };

  const tocno = natpisVjetra(k, "Split-2", undefined, uSatu, raniji);
  assert.equal(tocno.kada, null, "za odabrani sat sat se ne piše");
  assert.match(tocno.vrijednost, /^2,2 m\/s/);

  const rupa = natpisVjetra(k, "Split-2", undefined, undefined, raniji);
  assert.ok(rupa.kada, "rupa u nizu pada na ranije očitanje, uz sat");
  assert.match(rupa.vrijednost, /^1,4 m\/s/);
});

test("iz niza se bira zadnje očitanje do odabranog sata, ne bilo koje", () => {
  const niz = new Map(
    ["09:00", "11:00", "16:00"].map((h) => {
      const sat = `2026-08-21T${h.slice(0, 2)}:00:00.000Z`;
      return [sat, { sat, smjerOd: 90, brzina: Number(h.slice(0, 2)), tisina: false, izvor: "split2" as const }];
    }),
  );
  const nadeno = zadnjiIzNiza(niz, "2026-08-21T14:00:00.000Z");
  assert.equal(nadeno?.brzina, 11, "uzima 11:00, ne 16:00 koji je poslije");
  assert.equal(zadnjiIzNiza(niz, "2026-08-21T08:00:00.000Z"), null, "prije svega — ništa");
  assert.equal(zadnjiIzNiza(undefined, "2026-08-21T14:00:00.000Z"), null);
});

test("dok dohvat traje, postaja čeka — ne šuti", () => {
  // „šuti” je tvrdnja o postaji; dok se ne zna, tvrdnje nema. Dohvat s AZO-a
  // traje dvadesetak sekundi, pa bi inače cijela mreža na prvi pogled
  // izgledala kao da je pala.
  const ceka = natpisVjetra(kadar(), "Split-3", undefined, undefined, null, false);
  assert.equal(ceka.vrijednost, "…");
  assert.equal(ceka.nema, true);

  const stiglo = natpisVjetra(kadar(), "Split-3", undefined, undefined, null, true);
  assert.equal(stiglo.vrijednost, "šuti", "kad je dohvat gotov, šutnja je nalaz");
});

test("kad podatak postoji, čekanje ga ne skriva", () => {
  const n = natpisVjetra(kadar(), "Split-Marjan", OCITANJE, undefined, null, false);
  assert.match(n.vrijednost, /^3,4 m\/s/, "ono što je stiglo pokazuje se odmah");
});
