import assert from "node:assert/strict";
import test from "node:test";

import { OKVIR } from "@/generated/karepovac-karta";
import { OSNOVE_DIMA } from "@/generated/karepovac-polje";
import { sastaviPolje } from "@/lib/polje-dima";
import {
  GUSTOCA_NA_PLOHI,
  LJESTVICA,
  LJESTVICA_MERKAPTANA,
  OKVIR_M,
  PRAG_NA_LJESTVICI,
  TVARI,
  UBRZANJE,
  ljestvicaBoja,
  mirisneJedinice,
  razina,
  stvoriDim,
} from "@/lib/dim";

/**
 * Zagrijava simulaciju do ustaljenog stanja.
 *
 * Korak je krupan jer izvor ne pulsira: ustaljeno stanje ovisi o omjeru
 * dotoka i odlaska, a ne o tome koliko se sitno otipkava put. Isti krupni
 * korak koristi i zagrijavanje u pregledniku.
 */
function pusti(sim: ReturnType<typeof stvoriDim>, sekundi?: number): void {
  // Krupnije od preglednika: ustaljeno stanje ovisi o omjeru dotoka i
  // odlaska, ne o finoći otipkavanja puta, a provjere ovako stanu u minutu
  // umjesto u pet. Kinematika se mjeri zasebno, sitnim korakom.
  const dt = 0.5;
  const koliko = sekundi ?? sim.zagrijavanje;
  for (let s = 0; s < koliko / dt; s += 1) sim.korak(dt);
}

/**
 * Zagrijavanje kad provjera traži nešto određeno, a ne samo ustaljeno stanje.
 *
 * Inače `pusti` uzima `sim.zagrijavanje` — istu brojku koju koristi i
 * preglednik — pa se provjere i stranica ne mogu raziću u tome što smatraju
 * razvijenim prizorom.
 */
const USTALJENO = 120;

/**
 * Dva vremena kojima se provjerava, složena kao na stranici.
 *
 * Slab istok-jugoistok pod plitkim slojem je ono na što se ljudi žale; jači
 * sjeveroistočnjak pod dubljim nosi zrak s plohe mimo kuća. Polja više nisu
 * zapečena u generiranom modulu nego se slažu iz osnova, isto kao za vjetar
 * koji trenutačno puše.
 */
const SLAB = sastaviPolje({ smjerOd: 112.5, brzina: 1.2, dubina: 80 });
const JAK = sastaviPolje({ smjerOd: 45, brzina: 3.6, dubina: 400 });

test("polje vjetra nosi prema kvartu, ne od njega", () => {
  // Ploha je na istoku okvira, kvart na zapadu; perjanica mora ići ulijevo.
  const sim = stvoriDim(SLAB, { cestica: 8_000 });
  pusti(sim, USTALJENO);
  const lijevo = tezisteX(sim.crtaj(), sim.sirina, sim.visina);
  assert.ok(
    lijevo < 0.55,
    `težište perjanice je na ${lijevo.toFixed(2)} širine — ne ide prema kvartu`,
  );
});

test("perjanica prijeđe kvart do zapadnog ruba", () => {
  const sim = stvoriDim(SLAB, { cestica: 8_000 });
  pusti(sim, USTALJENO);
  const g = sim.crtaj();

  let doseg = sim.sirina;
  for (let i = 0; i < sim.sirina; i += 1) {
    let zbroj = 0;
    for (let j = 0; j < sim.visina; j += 1) zbroj += g[j * sim.sirina + i];
    if (zbroj / sim.visina > 0.02) {
      doseg = i;
      break;
    }
  }
  assert.ok(doseg < sim.sirina * 0.2, `perjanica staje na koloni ${doseg}`);
});

test("izvor je neprekidan — ploha ne diše u naletima", () => {
  // Prije je izvor pulsirao i između pulseva potpuno stajao, pa su niz padinu
  // išli odvojeni oblaci. Plin kroz pokrov curi cijelo vrijeme, pa svaka
  // sekunda mora ispustiti jednako.
  const sim = stvoriDim(SLAB, { cestica: 24_000, punjenje: 45 });
  pusti(sim, 10);

  const posekundi: number[] = [];
  let prije = sim.ispusteno();
  for (let s = 0; s < 20; s += 1) {
    for (let k = 0; k < 60; k += 1) sim.korak(1 / 60);
    const sad = sim.ispusteno();
    posekundi.push(sad - prije);
    prije = sad;
  }
  const omjer = Math.max(...posekundi) / Math.max(Math.min(...posekundi), 1);
  assert.ok(
    omjer < 1.02,
    `ispust po sekundi ide od ${Math.min(...posekundi)} do `
      + `${Math.max(...posekundi)} — izvor opet pulsira`,
  );
  assert.ok(
    Math.abs(posekundi[0] - 24_000 / 45) < 10,
    `ispušta ${posekundi[0]}/s, a treba ${Math.round(24_000 / 45)}/s`,
  );
});

test("perjanica nema zajednički takt — vrtlog ne diše uglas", () => {
  // Vrtložni šum je jedno polje sinusa. Kad su sve čestice u istoj fazi, masa
  // u okviru njiše se ravnomjerno svakih pedesetak sekundi i prizor izgleda
  // kao da izvor ipak pulsira, samo sporije.
  //
  // Mjeri se odstupanje od pravca, a ne raspon: spor silazak dok se prizor
  // dokraja slegne je uredu, a val gore-dolje nije.
  const sim = stvoriDim(SLAB, { cestica: 8_000 });
  pusti(sim, USTALJENO);

  const uzorci: number[] = [];
  for (let s = 0; s < 1_800; s += 1) {
    sim.korak(1 / 30);
    if (s % 30 === 0) uzorci.push(zbroj(sim.crtaj()));
  }
  const n = uzorci.length;
  const sx = (n - 1) / 2;
  const sy = uzorci.reduce((a, b) => a + b, 0) / n;
  let gore = 0;
  let dolje = 0;
  uzorci.forEach((y, i) => {
    gore += (i - sx) * (y - sy);
    dolje += (i - sx) ** 2;
  });
  const nagib = gore / dolje;
  const ostatci = uzorci.map((y, i) => y - (sy + nagib * (i - sx)));
  const val = (Math.max(...ostatci) - Math.min(...ostatci)) / sy;
  assert.ok(
    val < 0.05,
    `masa vijuga ${(val * 100).toFixed(1)} % oko pravca — vrtlog ima takt`,
  );
});

test("slab vjetar nakuplja zrak, jak ga raznese", () => {
  // Ovo je jedino zbog čega prikaz uopće odgovara na pitanje koje ljudi imaju.
  // Čestica ne umire od starosti nego kad je vjetar iznese iz okvira, pa se
  // pri slabom vjetru u okviru zadrži višestruko više zraka s plohe.
  const slab = stvoriDim(SLAB, { cestica: 24_000 });
  const jak = stvoriDim(JAK, { cestica: 24_000 });
  pusti(slab, USTALJENO);
  pusti(jak, USTALJENO);

  const omjer = zbroj(slab.crtaj()) / Math.max(zbroj(jak.crtaj()), 1e-6);
  assert.ok(
    omjer > 3,
    `slab vjetar drži samo ${omjer.toFixed(1)}× više zraka nego jak — `
      + "nakupljanja se ne vidi",
  );
});

test("nošenje ide brzinom stvarnog vjetra, uz poznato ubrzanje", () => {
  // Ovo je brojka koju je prikaz prije imao krivu: perjanica je išla oko dvjesto
  // puta brže od stvarnog vjetra, pa je slab istočnjak izgledao kao oluja.
  // Jednoliko polje od 1 m/s, jedan ispust, bez vrtloga — mora ispasti 1 m/s.
  const izmjereno = brzinaIzPrikaza(jednolikoPolje(1, 0), "x", OKVIR_M.sirina);
  assert.ok(
    Math.abs(izmjereno - 1) < 0.08,
    `polje od 1 m/s nosi kao ${izmjereno.toFixed(2)} m/s`,
  );
});

test("okvir se prijeđe u vremenu koje odgovara stvarnom vjetru", () => {
  // Ono što gledatelj vidi: slab istočnjak od 1,2 m/s prijeđe kvart za pola
  // minute prikaza, a to je pola sata stvarnog vremena.
  const stvarnihSekundi = OKVIR_M.sirina / 1.2;
  const naEkranu = stvarnihSekundi / UBRZANJE;
  assert.ok(
    naEkranu > 20 && naEkranu < 60,
    `okvir se prijeđe za ${naEkranu.toFixed(0)} s prikaza — predugo ili prebrzo `
      + "da bi se gledalo",
  );
  assert.ok(
    stvarnihSekundi / 60 > 25,
    "stvarni prelazak mora trajati desecima minuta, inače brojke ne stoje",
  );
});

test("sjeverni i istočni vjetar iste brzine prijeđu jednako metara", () => {
  // Okvir je dvostruko širi nego viši. S jednim koeficijentom za oba smjera
  // ista brzina prelazi jednak *dio* okvira, dakle upola manje metara okomito,
  // i perjanica ispadne razvučena u smjeru sjever-jug.
  const vodoravno = brzinaIzPrikaza(jednolikoPolje(1, 0), "x", OKVIR_M.sirina);
  const okomito = brzinaIzPrikaza(jednolikoPolje(0, 1), "y", OKVIR_M.visina);
  assert.ok(
    Math.abs(vodoravno - okomito) < 0.08,
    `vodoravno ${vodoravno.toFixed(2)} m/s, okomito ${okomito.toFixed(2)} m/s`,
  );
});

test("žarišta stežu perjanicu — jednolik izvor daje mrlju", () => {
  const usko = stvoriDim(SLAB, { cestica: 8_000, zarista: 1 });
  const siroko = stvoriDim(SLAB, { cestica: 8_000, zarista: 40 });
  pusti(usko, USTALJENO);
  pusti(siroko, USTALJENO);

  assert.ok(
    pokrivenost(usko.crtaj()) < pokrivenost(siroko.crtaj()),
    "jedno žarište mora pokriti manje okvira nego četrdeset",
  );
});

test("gustoća ostaje ograničena — perjanica ne poplavi okvir", () => {
  const sim = stvoriDim(SLAB, { cestica: 8_000 });
  pusti(sim, USTALJENO * 1.5);
  const dio = pokrivenost(sim.crtaj());
  assert.ok(dio > 0.03, `perjanica je prazna (${(dio * 100).toFixed(1)} %)`);
  assert.ok(dio < 0.75, `perjanica je poplavila okvir (${(dio * 100).toFixed(1)} %)`);
});

test("gustoća ne ovisi o gustoći rešetke, nego o vjetru", () => {
  // Rešetka je razlučivost prikaza, ne količina zraka. Prije je ista perjanica
  // na dvostruko gušćoj rešetci ispadala četiri puta blijeđa, pa bi promjena
  // razlučivosti radi oštrine tiho pomaknula cijelu ljestvicu boja.
  const rijetko = stvoriDim(SLAB, { cestica: 8_000, sirina: 140 });
  const gusto = stvoriDim(SLAB, { cestica: 8_000, sirina: 320 });
  pusti(rijetko);
  pusti(gusto);

  const vrh = (sim: ReturnType<typeof stvoriDim>) => {
    const g = Array.from(sim.crtaj()).sort((a, b) => a - b);
    return g[Math.floor(g.length * 0.99)];
  };
  const omjer = vrh(rijetko) / vrh(gusto);
  assert.ok(
    Math.abs(omjer - 1) < 0.2,
    `dvostruko gušća rešetka dala je ${omjer.toFixed(2)}× drukčiju gustoću`,
  );
});

test("gustoća ne ovisi o broju čestica, nego o vjetru", () => {
  // Broj čestica je samo zrnatost. Kad bi o njemu ovisila i svjetlina,
  // nepomična ljestvica boja ne bi značila ništa.
  const malo = stvoriDim(SLAB, { cestica: 10_000 });
  const puno = stvoriDim(SLAB, { cestica: 40_000 });
  pusti(malo, USTALJENO);
  pusti(puno, USTALJENO);

  const omjer = zbroj(malo.crtaj()) / zbroj(puno.crtaj());
  assert.ok(
    Math.abs(omjer - 1) < 0.15,
    `četverostruko više čestica dalo je ${omjer.toFixed(2)}× drukčiju gustoću`,
  );
});

test("simulacija je determinističa", () => {
  const a = stvoriDim(SLAB, { cestica: 4_000 });
  const b = stvoriDim(SLAB, { cestica: 4_000 });
  pusti(a, 8);
  pusti(b, 8);
  assert.deepEqual(Array.from(a.crtaj()), Array.from(b.crtaj()));
});

test("čestice se vraćaju u optjecaj, bez curenja", () => {
  const sim = stvoriDim(SLAB, { cestica: 4_000 });
  pusti(sim, USTALJENO);
  const zivih = sim.zivih();
  assert.ok(zivih > 0, "nijedna čestica nije živa");
  assert.ok(zivih <= sim.cestica, "živih je više nego što ih uopće ima");
});

test("ljestvice idu od prozirnog do zasićenog", () => {
  for (const l of [LJESTVICA, LJESTVICA_MERKAPTANA]) {
    const lut = ljestvicaBoja(l);
    assert.equal(lut[3], 0, "najniža razina mora biti prozirna");
    assert.ok(lut[255 * 4 + 3] > 200, "najviša razina mora biti gotovo neprozirna");
    for (let i = 1; i < 256; i += 1) {
      assert.ok(
        lut[i * 4 + 3] >= lut[(i - 1) * 4 + 3] - 1,
        `neprozirnost pada na razini ${i}`,
      );
    }
  }
});

test("dvije tvari daju boje koje se razlikuju i bez crvene i zelene", () => {
  // Gruba provjera za deuteranopiju: plava se komponenta u sredini ljestvice
  // mora bitno razlikovati, jer je to jedina os koja ostaje.
  const topla = ljestvicaBoja(LJESTVICA);
  const hladna = ljestvicaBoja(LJESTVICA_MERKAPTANA);
  for (const i of [96, 160, 220]) {
    const razlika = Math.abs(topla[i * 4 + 2] - hladna[i * 4 + 2]);
    assert.ok(razlika > 60, `na razini ${i} plava se razlikuje samo za ${razlika}`);
  }
});

test("boja se pojavi otprilike ondje gdje se tvar počne osjećati", () => {
  // Ljestvica nema oštru granicu — imala ju je i izgledala je kao izolinija.
  // Ono što mora vrijediti je slabije, ali dovoljno: dno je prozirno, a
  // neprozirnost naraste u okolici praga, pa obojeno znači „osjeti se”.
  for (const l of [LJESTVICA, LJESTVICA_MERKAPTANA]) {
    const lut = ljestvicaBoja(l);
    const alfa = (v: number) => lut[Math.round(v * 255) * 4 + 3];
    assert.equal(alfa(PRAG_NA_LJESTVICI * 0.6), 0, "dno ljestvice mora biti prozirno");
    assert.ok(
      alfa(PRAG_NA_LJESTVICI) > 20 && alfa(PRAG_NA_LJESTVICI) < 140,
      `na pragu je neprozirnost ${alfa(PRAG_NA_LJESTVICI)} — boja kreće prerano `
        + "ili prekasno",
    );
    assert.ok(alfa(PRAG_NA_LJESTVICI * 2) > 200, "iznad praga mora biti zasićeno");
  }
});

test("merkaptani se osjete daleko šire nego sumporovodik", () => {
  // Ista perjanica, ista fizika — razlika je samo u tome koliko je koje tvari
  // iznad praga mirisa. Ako se to ne vidi, prebacivanje tvari nema smisla.
  const sim = stvoriDim(SLAB, { cestica: 24_000 });
  pusti(sim, USTALJENO);
  const g = sim.crtaj();

  const iznadPraga = (tvar: "sumporovodik" | "merkaptani") => {
    let n = 0;
    for (let i = 0; i < g.length; i += 1) if (razina(g[i], tvar) > PRAG_NA_LJESTVICI) n += 1;
    return n / g.length;
  };
  const h2s = iznadPraga("sumporovodik");
  const merk = iznadPraga("merkaptani");
  assert.ok(h2s > 0, "sumporovodik se nigdje ne osjeti");
  assert.ok(
    merk > h2s * 1.5,
    `merkaptani pokrivaju ${(merk * 100).toFixed(0)} %, `
      + `sumporovodik ${(h2s * 100).toFixed(0)} % — razlika se ne vidi`,
  );
  assert.ok(merk < 0.98, "merkaptani su zasitili cijeli kadar");
});

test("mirisne jedinice su ono što piše u tablici tvari", () => {
  assert.ok(
    Math.abs(mirisneJedinice("sumporovodik") - 1.99) < 0.05,
    "sumporovodik je oko dvaput iznad praga",
  );
  assert.ok(
    Math.abs(mirisneJedinice("merkaptani") - 17.1) < 0.5,
    "merkaptani su oko sedamnaest puta iznad praga",
  );
  for (const t of ["sumporovodik", "merkaptani"] as const) {
    assert.ok(TVARI[t].razina > TVARI[t].prag, `${t} je ispod praga — provjeri brojke`);
  }
});

test("sidro ljestvice odgovara gustoći koju perjanica drži nad plohom", () => {
  // Bez postavki, kao na stranici. Jednom je mjerilo gustoće bilo izvedeno iz
  // zadanog broja čestica, pa je smanjenje tog broja radi brzine podijelilo
  // sve gustoće s tri — perjanica je gotovo nestala, a nijedna provjera to
  // nije uhvatila jer su sve zadavale svoj broj čestica.
  const sim = stvoriDim(SLAB);
  pusti(sim);
  pusti(sim, 20);
  const sortirano = Array.from(sim.crtaj()).sort((a, b) => a - b);
  const p99 = sortirano[Math.floor(sortirano.length * 0.99)];
  assert.ok(
    Math.abs(p99 - GUSTOCA_NA_PLOHI) < GUSTOCA_NA_PLOHI * 0.25,
    `99. postotak gustoće je ${p99.toFixed(1)}, a sidro `
      + `${GUSTOCA_NA_PLOHI} — ljestvica boja više ne odgovara`,
  );
});

test("polje dima stoji u istom okviru kao ostale karte", () => {
  const okvirOmjer = OKVIR.sirina / OKVIR.visina;
  const poljeOmjer = OSNOVE_DIMA.gw / OSNOVE_DIMA.gh;
  assert.ok(
    Math.abs(okvirOmjer - poljeOmjer) < 0.03,
    `okvir ${okvirOmjer.toFixed(3)} ≠ polje ${poljeOmjer.toFixed(3)} — `
      + "perjanica bi bila razvučena preko karte",
  );
});

test("veličina okvira u metrima prati kartu", () => {
  for (const [ime, iz, moje] of [
    ["širina", OKVIR.sirina / OKVIR.pxPoMetru, OKVIR_M.sirina],
    ["visina", OKVIR.visina / OKVIR.pxPoMetru, OKVIR_M.visina],
  ] as const) {
    assert.ok(
      Math.abs(iz - moje) < 10,
      `${ime}: karta kaže ${iz.toFixed(0)} m, dim računa s ${moje} m`,
    );
  }
});

test("čestica koja izađe iz polja nestane, a ne ostane zauvijek u kutu", () => {
  // Prije je čestica malo izvan ruba uzimala brzinu izvan niza, dobivala NaN
  // i time preskakala provjeru ruba — pa se skupljala u ćeliji (0, 0) i ondje
  // svijetlila kao da je ondje izvor. Provjera je izravna: ugasi se izvor i
  // pusti jak vjetar; ako išta preživi, preživjelo je krivo.
  const sim = stvoriDim(jednolikoPolje(5, 0), { cestica: 8_000, zarista: 1 });
  pusti(sim, 20);
  assert.ok(sim.zivih() > 0, "ništa nije ni izašlo iz izvora");

  sim.postavi("punjenje", 1e9);
  pusti(sim, 60);
  assert.equal(sim.zivih(), 0, "čestice su ostale u polju iako ih je vjetar odnio");

  const g = sim.crtaj();
  for (let i = 0; i < g.length; i += 1) {
    assert.ok(Number.isFinite(g[i]) && g[i] === 0, `ćelija ${i} drži ${g[i]}`);
  }
});

test("kut okvira ne skuplja gustoću preko onoga što vjetar donese", () => {
  const sim = stvoriDim(SLAB, { cestica: 8_000 });
  pusti(sim, USTALJENO);
  const g = sim.crtaj();

  let najvise = 0;
  for (let i = 0; i < g.length; i += 1) if (g[i] > najvise) najvise = g[i];
  const kut = Math.max(g[0], g[1], g[sim.sirina], g[sim.sirina + 1]);
  // Zapadni rub sad legitimno drži nešto zraka, jer se ondje perjanica
  // nakuplja prije nego što izađe. Nasjedanje na NaN bilo je red veličine
  // veće od toga i uvijek u samom kutu.
  assert.ok(najvise > 0, "polje mora imati nešto u sebi");
  assert.ok(
    kut < najvise * 0.25,
    `kut (0, 0) drži ${kut.toFixed(2)}, a najviše u polju je ${najvise.toFixed(2)}`,
  );
});

/** Jednoliko polje zadane brzine, s izvorom u jednoj ćeliji; za kinematiku. */
function jednolikoPolje(u: number, v: number) {
  const gw = 32;
  const gh = 16;
  const skala = 8;
  const bajt = (m: number) =>
    Buffer.from(
      new Uint8Array(gw * gh).fill(Math.round((m / skala + 1) * 127.5)),
    ).toString("base64");
  const mk = new Uint8Array(gw * gh);
  // Y u okviru raste prema dolje, a `v` je brzina prema sjeveru; izvor se
  // stavlja na onu stranu s koje čestice imaju kamo otići.
  const j = v > 0 ? gh - 3 : 2;
  const i = u > 0 ? 2 : gw - 3;
  mk[j * gw + (u !== 0 ? i : gw >> 1)] = 255;
  return {
    gw,
    gh,
    skala,
    vx: bajt(u),
    vy: bajt(-v),
    maska: Buffer.from(mk).toString("base64"),
  };
}

/**
 * Vraća brzinu vjetra kakvu prikaz doista pokazuje, u m/s.
 *
 * Args:
 *   polje: Jednoliko polje poznate brzine.
 *   os: Os po kojoj se mjeri pomak.
 *   metara: Veličina okvira u toj osi.
 *
 * Returns:
 *   Prijeđeni metri podijeljeni s proteklim stvarnim vremenom.
 */
function brzinaIzPrikaza(
  polje: ReturnType<typeof jednolikoPolje>,
  os: "x" | "y",
  metara: number,
): number {
  const sim = stvoriDim(polje, {
    cestica: 4_000,
    // Gušća rešetka i dulji put, da zaokruživanje na ćeliju ne odluči rezultat.
    sirina: 400,
    vrtlog: 0,
    zarista: 1,
    punjenje: 1e9,
  });
  // Jedan ispust, pa se prati kako putuje — bez dotoka koji bi vukao težište.
  sim.postavi("punjenje", 0.05);
  sim.korak(0.05);
  sim.postavi("punjenje", 1e9);

  const prije = teziste(sim, os);
  const sekundi = 6;
  for (let s = 0; s < sekundi / 0.05; s += 1) sim.korak(0.05);
  const puta = Math.abs(teziste(sim, os) - prije) * metara;
  return puta / (sekundi * UBRZANJE);
}

function teziste(sim: ReturnType<typeof stvoriDim>, os: "x" | "y"): number {
  const g = sim.crtaj();
  let zbrojT = 0;
  let tezina = 0;
  for (let j = 0; j < sim.visina; j += 1) {
    for (let i = 0; i < sim.sirina; i += 1) {
      const val = g[j * sim.sirina + i];
      zbrojT += val * (os === "x" ? i / sim.sirina : j / sim.visina);
      tezina += val;
    }
  }
  return tezina > 0 ? zbrojT / tezina : 0;
}

function zbroj(g: Float32Array): number {
  let s = 0;
  for (let i = 0; i < g.length; i += 1) s += g[i];
  return s;
}

function pokrivenost(g: Float32Array): number {
  let n = 0;
  for (let i = 0; i < g.length; i += 1) if (g[i] > 0.02) n += 1;
  return n / g.length;
}

function tezisteX(g: Float32Array, W: number, H: number): number {
  let zbrojT = 0;
  let tezina = 0;
  for (let j = 0; j < H; j += 1) {
    for (let i = 0; i < W; i += 1) {
      const v = g[j * W + i];
      zbrojT += v * i;
      tezina += v;
    }
  }
  return tezina > 0 ? zbrojT / tezina / W : 0.5;
}
