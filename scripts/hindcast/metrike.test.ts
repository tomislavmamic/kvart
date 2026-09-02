import assert from "node:assert/strict";
import test from "node:test";

import {
  aucOznaka,
  aucVrha,
  bezDnevnogHoda,
  dojaveMetrike,
  kljucDojave,
  kontingencija,
  kutnaRazlika,
  kvantil,
  medijan,
  mjesniMjesec,
  mjesniSat,
  mulberry32,
  nulteVrijednosti,
  nultiPojas,
  pearson,
  pearsonLog,
  poRezimima,
  poravnaj,
  pragKvantila,
  rangovi,
  regresija,
  regresijaPoDanima,
  sazetak,
  spearman,
  udioIznad,
  zaokruzi,
} from "./metrike";
import type { DojavaSat, SatUlaza } from "./tipovi";

/** Približna jednakost; NaN je jednak samo NaN-u. */
function blizu(stvarno: number, ocekivano: number, tol = 1e-9): void {
  if (Number.isNaN(ocekivano)) {
    assert.ok(Number.isNaN(stvarno), `očekivan NaN, dobiveno ${stvarno}`);
    return;
  }
  assert.ok(
    Math.abs(stvarno - ocekivano) <= tol,
    `očekivano ${ocekivano}, dobiveno ${stvarno}`,
  );
}

/** Puni sati od `od` (UTC ISO) u nizu, `n` komada. */
function sati(od: string, n: number): string[] {
  const t0 = Date.parse(od);
  return Array.from({ length: n }, (_, i) => new Date(t0 + i * 3_600_000).toISOString());
}

function ulaz(sat: string, brzina: number, smjerOd: number, dubina: number | null): SatUlaza {
  return {
    sat,
    vjetar: { smjerOd, brzina, izvor: "era5" },
    dubina: dubina === null ? null : { m: dubina, izvor: "era5" },
    okolnosti: null,
  };
}

// ---------------------------------------------------------------- pomoćno

test("poravnaj izbacuje parove s rupom i pamti odakle je koji", () => {
  const p = poravnaj([1, null, 3, NaN, 5, 6], [10, 20, undefined, 40, 50]);
  assert.deepEqual(p.x, [1, 5]);
  assert.deepEqual(p.y, [10, 50]);
  assert.deepEqual(p.indeksi, [0, 4]);
});

test("rangovi prosječuju izjednačene vrijednosti", () => {
  assert.deepEqual(rangovi([30, 10, 20]), [3, 1, 2]);
  assert.deepEqual(rangovi([1, 1, 2, 2]), [1.5, 1.5, 3.5, 3.5]);
  assert.deepEqual(rangovi([5, 5, 5]), [2, 2, 2]);
  assert.deepEqual(rangovi([]), []);
});

test("kvantil interpolira kao np.quantile", () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  blizu(kvantil(x, 0.9), 9.1);
  blizu(kvantil(x, 0.5), 5.5);
  blizu(kvantil(x, 0), 1);
  blizu(kvantil(x, 1), 10);
  blizu(kvantil([7], 0.3), 7);
  blizu(kvantil([], 0.5), NaN);
  blizu(medijan([3, 1, 2]), 2);
  blizu(medijan([4, 1, 2, 3]), 2.5);
});

test("mulberry32 je ponovljiv i u [0, 1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const na = Array.from({ length: 5 }, () => a());
  const nb = Array.from({ length: 5 }, () => b());
  const nc = Array.from({ length: 5 }, () => c());
  assert.deepEqual(na, nb);
  assert.notDeepEqual(na, nc);
  for (const v of na) assert.ok(v >= 0 && v < 1);
});

test("mjesni sat i mjesec idu po Zagrebu, s ljetnim vremenom", () => {
  assert.equal(mjesniSat("2026-01-15T00:00:00.000Z"), 1);
  assert.equal(mjesniSat("2026-07-15T00:00:00.000Z"), 2);
  assert.equal(mjesniSat("2026-07-14T22:00:00.000Z"), 0);
  assert.equal(mjesniMjesec("2026-07-14T22:00:00.000Z"), 7);
  // Zadnji sat godine po UTC-u već je siječanj u Zagrebu.
  assert.equal(mjesniMjesec("2025-12-31T23:00:00.000Z"), 1);
});

test("kutnaRazlika prelazi preko sjevera", () => {
  blizu(kutnaRazlika(350, 10), 20);
  blizu(kutnaRazlika(10, 350), 20);
  blizu(kutnaRazlika(0, 180), 180);
  blizu(kutnaRazlika(90, 90), 0);
});

// ------------------------------------------------------------- korelacije

test("spearman na poznatim primjerima", () => {
  // d = [0,0,0,1,1] → 1 − 6·2 / (5·24) = 0,9.
  blizu(spearman([1, 2, 3, 4, 5], [1, 2, 3, 5, 4]), 0.9);
  blizu(spearman([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1);
  blizu(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1);
  // Izjednačeni: rangovi y = [1,5; 1,5; 3,5; 3,5] → 4 / √20.
  blizu(spearman([1, 2, 3, 4], [1, 1, 2, 2]), 4 / Math.sqrt(20));
  // Monoton, nelinearan — rang ne vidi oblik.
  blizu(spearman([1, 2, 3, 4], [1, 10, 100, 1000]), 1);
});

test("spearman je NaN bez raspršenja ili s premalo parova", () => {
  blizu(spearman([1, 1, 1], [1, 2, 3]), NaN);
  blizu(spearman([1], [2]), NaN);
  blizu(spearman([], []), NaN);
  // Rupe ispadaju prije rangiranja.
  blizu(spearman([1, null, 2, 3], [1, 99, 2, 3]), 1);
});

test("pearson i pearsonLog", () => {
  blizu(pearson([1, 2, 3], [2, 4, 6]), 1);
  blizu(pearson([1, 2, 3], [3, 2, 1]), -1);
  blizu(pearson([1, 2, 3], [1, 1, 1]), NaN);
  // y = x³ je linearan u logaritmu, pa je Pearson na logaritmima točno 1.
  blizu(pearsonLog([1, 2, 4, 8], [1, 8, 64, 512]), 1);
  // Nepozitivne vrijednosti ispadaju, ne kvare.
  blizu(pearsonLog([1, 2, 0, 4, 8], [1, 8, 5, 64, 512]), 1);
  blizu(pearsonLog([1, 2, 4, 8], [1, 8, -1, 512]), 1);
});

// -------------------------------------------------------------------- AUC

test("aucVrha je 1 za savršeno razdvojive podatke i 0 za obrnute", () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  blizu(aucVrha(x, x), 1);
  blizu(
    aucVrha(
      x.map((v) => -v),
      x,
    ),
    0,
  );
  // Konstantan model o vrhu ne zna ništa.
  blizu(
    aucVrha(
      x.map(() => 1),
      x,
    ),
    0.5,
  );
});

test("aucVrha slijedi np.quantile i strogi prag kao u bazdari-izvor.py", () => {
  // n = 10, udio 0,3: prag = kvantil 0,7 = 7,3; vrh su 8, 9, 10.
  const mjereno = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Model: 9 najviše, 10 srednje, 8 dijeli mjesto s 5 (prosjek rangova).
  const model = [1, 2, 3, 4, 6, 5, 7, 6, 10, 8];
  // Rangovi modela: 1:1, 2:2, 3:3, 4:4, 6→(6+7)/2=6,5 (×2), 5:5, 7:8, 10:10, 8:9.
  // Vrh (8,9,10) ima rangove 6,5 + 10 + 9 = 25,5; n1 = 3, n0 = 7.
  blizu(aucVrha(model, mjereno, 0.3), (25.5 - 6) / 21);
});

test("aucVrha je NaN kad vrha nema ili je sve vrh", () => {
  blizu(aucVrha([1, 2, 3], [5, 5, 5]), NaN);
  blizu(aucVrha([], []), NaN);
  blizu(aucOznaka([1, 2, 3], [true, true, true]), NaN);
  blizu(aucOznaka([1, 2, 3, 4], [false, false, true, true]), 1);
  // Pozitivni na 1 i 4: rangovi 1 + 4 = 5 → (5 − 3) / (2·2).
  blizu(aucOznaka([1, 2, 3, 4], [true, false, false, true]), 0.5);
  // Pozitivni na 1 i 3: rangovi 1 + 3 = 4 → (4 − 3) / 4.
  blizu(aucOznaka([1, 2, 3, 4], [true, false, true, false]), 0.25);
});

// ----------------------------------------------------------- kontingencija

test("kontingencija broji i računa POD, FAR, CSI, pristranost", () => {
  const mjereno = [0, 0, 1, 1, 2, 2];
  const model = [0, 1, 0, 1, 1, 1];
  const k = kontingencija(model, mjereno, 0.5, 0.5);
  assert.equal(k.n, 6);
  assert.equal(k.pogodci, 3);
  assert.equal(k.promasaji, 1);
  assert.equal(k.lazne, 1);
  assert.equal(k.tocneNegative, 1);
  blizu(k.POD, 0.75);
  blizu(k.FAR, 0.25);
  blizu(k.CSI, 0.6);
  blizu(k.pristranost, 1);
  blizu(k.tocnost, 4 / 6);
});

test("kontingencija je strogo iznad praga i NaN bez pozitivnih", () => {
  const k = kontingencija([1, 1], [1, 1], 1, 1);
  assert.equal(k.tocneNegative, 2);
  blizu(k.POD, NaN);
  blizu(k.FAR, NaN);
  blizu(k.CSI, NaN);
  blizu(k.pristranost, NaN);
  blizu(k.tocnost, 1);
});

test("pragKvantila izjednačava udio pozitivnih", () => {
  const model = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10];
  const prag = pragKvantila(model, 0.3);
  assert.equal(prag, 7);
  blizu(udioIznad(model, prag), 0.3);
  assert.equal(pragKvantila(model, 0), 10);
  blizu(udioIznad(model, pragKvantila(model, 0)), 0);
  assert.equal(pragKvantila(model, 1), -Infinity);
  blizu(udioIznad(model, pragKvantila(model, 1)), 1);
  blizu(pragKvantila([], 0.5), NaN);

  // Tipičan poziv: prag modela biran tako da model proglasi pozitivnim isti
  // udio sati koji je mjerenje iznad svojeg praga → pristranost 1.
  const mjereno = [1, 1, 1, 1, 1, 1, 1, 3, 3, 3];
  const pm = pragKvantila(model, udioIznad(mjereno, 2));
  const k = kontingencija(model, mjereno, 2, pm);
  blizu(k.pristranost, 1);
  assert.equal(k.pogodci + k.lazne, 3);
});

// --------------------------------------------------------------- regresija

test("regresija pogađa točan pravac", () => {
  const x = [1, 2, 3, 4, 5];
  const r = regresija(
    x,
    x.map((v) => 2 * v + 1),
  );
  assert.equal(r.n, 5);
  blizu(r.nagib, 2);
  blizu(r.odsjecak, 1);
  blizu(r.r2, 1);
  // Ravno y: nagib 0, r² nema smisla.
  const r0 = regresija(x, [3, 3, 3, 3, 3]);
  blizu(r0.nagib, 0);
  blizu(r0.r2, NaN);
  // Bez raspršenja u x nema regresije.
  blizu(regresija([1, 1, 1], [1, 2, 3]).nagib, NaN);
  blizu(regresija([1], [1]).nagib, NaN);
});

test("regresija: r² na poznatom primjeru", () => {
  // x = 1..4, y = [2, 4, 5, 8]: nagib 1,9, odsječak 0; ostatci 0,1, 0,2,
  // −0,7, 0,4 → SSres = 0,7; SStot = 18,75.
  const r = regresija([1, 2, 3, 4], [2, 4, 5, 8]);
  blizu(r.nagib, 1.9);
  blizu(r.odsjecak, 0);
  blizu(r.r2, 1 - 0.7 / 18.75);
});

test("regresijaPoDanima je determinirana sjemenom i uzorkuje dane", () => {
  const n = 24 * 12;
  const s = sati("2026-03-01T00:00:00.000Z", n);
  const dani = s.map((t) => t.slice(0, 10));
  const slucajno = mulberry32(7);
  const x = Array.from({ length: n }, () => slucajno() * 10);
  // Sum po danima: svaki dan ima svoju pozadinu, pa dani nisu zamjenjivi.
  const y = x.map((v, i) => 1.5 * v + 2 + Math.floor(i / 24) * 0.2 + (slucajno() - 0.5));

  const a = regresijaPoDanima(x, y, dani, 100, 11);
  const b = regresijaPoDanima(x, y, dani, 100, 11);
  const c = regresijaPoDanima(x, y, dani, 100, 12);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.nagib95, c.nagib95);
  assert.equal(a.dana, 12);
  assert.equal(a.ponavljanja, 100);
  assert.equal(a.sjeme, 11);
  assert.ok(a.nagib95[0] <= a.nagib && a.nagib <= a.nagib95[1]);
  assert.ok(a.nagib95[0] < a.nagib95[1]);
  blizu(a.nagib, 1.5, 0.1);

  // Na točnom pravcu svaki uzorak dana daje isti nagib: raspon je točka.
  const tocno = regresijaPoDanima(
    x,
    x.map((v) => 3 * v - 1),
    dani,
    50,
    1,
  );
  blizu(tocno.nagib95[0], 3, 1e-9);
  blizu(tocno.nagib95[1], 3, 1e-9);
});

test("regresijaPoDanima: raspon po danima širi je od naivnog kad su dani skupine", () => {
  // Deset dana; unutar dana x i y su gotovo isti, između dana odnos se
  // mijenja. Uzorkovanje po danima to mora vidjeti kao nesigurnost.
  const n = 24 * 10;
  const s = sati("2026-03-01T00:00:00.000Z", n);
  const dani = s.map((t) => t.slice(0, 10));
  const slucajno = mulberry32(5);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const dan = Math.floor(i / 24);
    const nagibDana = 1 + (dan % 2 === 0 ? 1 : -1) * 0.8;
    const v = slucajno() * 5;
    x.push(v);
    y.push(nagibDana * v + slucajno() * 0.01);
  }
  const r = regresijaPoDanima(x, y, dani, 200, 9);
  assert.ok(r.nagib95[1] - r.nagib95[0] > 0.3, `raspon ${r.nagib95}`);
});

test("regresijaPoDanima s jednim danom nema raspona", () => {
  const s = sati("2026-03-01T00:00:00.000Z", 5);
  const r = regresijaPoDanima(
    [1, 2, 3, 4, 5],
    [2, 4, 6, 8, 10],
    s.map((t) => t.slice(0, 10)),
  );
  blizu(r.nagib, 2);
  assert.equal(r.dana, 1);
  blizu(r.nagib95[0], NaN);
});

// ------------------------------------------------------------- dnevni hod

test("bezDnevnogHoda ostavlja medijan svakog mjesnog sata na nuli", () => {
  const n = 24 * 5;
  const s = sati("2026-06-01T00:00:00.000Z", n);
  const slucajno = mulberry32(3);
  // Jak dnevni hod plus šum.
  const v = s.map((t) => 5 + 3 * Math.sin((mjesniSat(t) / 24) * 2 * Math.PI) + slucajno());
  const o = bezDnevnogHoda(s, v);
  assert.equal(o.length, n);
  const poSatu = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const h = mjesniSat(s[i]);
    poSatu.set(h, [...(poSatu.get(h) ?? []), o[i]]);
  }
  assert.equal(poSatu.size, 24);
  for (const vs of poSatu.values()) blizu(medijan(vs), 0);
  // Ukupni medijan po satu prije čišćenja nije nula, dakle nešto je oduzeto.
  assert.ok(Math.abs(medijan(v)) > 1);
});

test("bezDnevnogHoda čuva rupe kao NaN", () => {
  const s = sati("2026-06-01T00:00:00.000Z", 48);
  const v: (number | null)[] = s.map((_, i) => (i === 5 ? null : i % 24));
  const o = bezDnevnogHoda(s, v);
  assert.ok(Number.isNaN(o[5]));
  // Dva dana s istim hodom: sve ostalo je točno nula.
  for (let i = 0; i < 48; i += 1) if (i !== 5 && i !== 29) blizu(o[i], 0);
  // Sat 5 drugog dana ostaje sam u svom košu — medijan je on sam, ostatak 0.
  blizu(o[29], 0);
});

test("bezDnevnogHoda: korelacija koja je samo dnevni hod pada na nulu", () => {
  const n = 24 * 20;
  const s = sati("2026-04-01T00:00:00.000Z", n);
  const hod = s.map((t) => Math.sin((mjesniSat(t) / 24) * 2 * Math.PI));
  const slucajno = mulberry32(8);
  const a = hod.map((h) => h + 0.2 * (slucajno() - 0.5));
  const b = hod.map((h) => 2 * h + 0.2 * (slucajno() - 0.5));
  assert.ok(spearman(a, b) > 0.9);
  const ra = bezDnevnogHoda(s, a);
  const rb = bezDnevnogHoda(s, b);
  assert.ok(Math.abs(spearman(ra, rb)) < 0.15, `ρ bez hoda ${spearman(ra, rb)}`);
});

// ------------------------------------------------------------ nulti pojas

test("nultiPojas na nepovezanim podacima je oko nule, a savršen model ostaje izvan njega", () => {
  const n = 24 * 40;
  const s = sati("2026-01-01T00:00:00.000Z", n);
  const slucajno = mulberry32(21);
  const mjereno = Array.from({ length: n }, () => slucajno());
  const model = Array.from({ length: n }, () => slucajno());

  const pojas = nultiPojas(model, mjereno, s, [1, 2, 3, 5, 7]);
  assert.deepEqual(pojas.pomaci, [1, -1, 2, -2, 3, -3, 5, -5, 7, -7]);
  assert.equal(pojas.uzorci.length, 10);
  for (const u of pojas.uzorci) {
    assert.equal(u.n, n - Math.abs(u.pomak) * 24);
    assert.ok(Math.abs(u.spearman) < 0.15, `pomak ${u.pomak}: ρ ${u.spearman}`);
    assert.ok(Math.abs(u.aucVrha - 0.5) < 0.12, `pomak ${u.pomak}: AUC ${u.aucVrha}`);
  }
  assert.ok(Math.abs(pojas.spearman.medijan) < 0.1);
  assert.ok(pojas.spearman.min <= pojas.spearman.medijan);
  assert.ok(pojas.spearman.medijan <= pojas.spearman.max);
  assert.ok(Math.abs(pojas.aucVrha.medijan - 0.5) < 0.1);

  // Model = mjerenje: ρ je 1, a pojas i dalje oko nule — to je smisao pojasa.
  const savrsen = nultiPojas(mjereno, mjereno, s, [1, 3]);
  blizu(spearman(mjereno, mjereno), 1);
  assert.ok(savrsen.spearman.max < 0.2);
});

test("nultiPojas pomiče po stvarnom vremenu, pa rupe u satima ispadaju", () => {
  const s = sati("2026-01-01T00:00:00.000Z", 72).filter((_, i) => i !== 30);
  const v = s.map((_, i) => i);
  const pojas = nultiPojas(v, v, s, [1]);
  const naprijed = pojas.uzorci.find((u) => u.pomak === 1);
  // 71 sati; naprijed za dan: zadnja 24 nemaju par, a sat 6 drugog dana
  // (indeks 30 izbačen) nema para ni onome dan prije njega.
  assert.equal(naprijed?.n, 71 - 24 - 1);
  const natrag = pojas.uzorci.find((u) => u.pomak === -1);
  assert.equal(natrag?.n, 71 - 24 - 1);
});

// ---------------------------------------------------------------- režimi

test("poRezimima razvrstava sate po režimima i broji ih", () => {
  const n = 24 * 4;
  const s = sati("2026-07-01T00:00:00.000Z", n);
  const slucajno = mulberry32(2);
  const mjereno = Array.from({ length: n }, () => slucajno());
  const model = mjereno.map((v) => v + 0.01 * slucajno());
  const ulazi: SatUlaza[] = s.map((sat, i) =>
    ulaz(sat, [0.5, 1.5, 3, 6][i % 4], i % 2 ? 300 : 120, i % 3 === 0 ? 50 : i % 3 === 1 ? 200 : 500),
  );
  // Zadnjih 12 sati bez vjetra i dubine.
  for (let i = n - 12; i < n; i += 1) ulazi[i] = { sat: s[i], vjetar: null, dubina: null, okolnosti: null };

  const r = poRezimima(s, model, mjereno, ulazi, (u) => (u.vjetar?.smjerOd ?? 0) === 300);

  assert.equal(r.dobaDana.noc.n + r.dobaDana.dan.n, n);
  // Noć 21–06 = 9 sati po danu, 4 dana.
  assert.equal(r.dobaDana.noc.n, 9 * 4);
  assert.equal(r.sezona.JJA.n, n);
  assert.equal(r.sezona.DJF.n, 0);
  blizu(r.sezona.DJF.spearman, NaN);

  const brzine = Object.values(r.brzina).map((o) => o.n);
  assert.deepEqual(brzine, [21, 21, 21, 21]);
  assert.equal(r.smjer?.nizvjetar.n, 42);
  assert.equal(r.smjer?.ostalo.n, 42);
  const dubine = Object.values(r.dubina).map((o) => o.n);
  assert.equal(dubine.reduce((a, b) => a + b, 0), n - 12);
  assert.equal(r.dubina["<100"].n, 28);

  // Model prati mjerenje posvuda.
  for (const o of Object.values(r.brzina)) blizu(o.spearman, 1, 0.05);
  assert.ok(r.dobaDana.noc.aucVrha > 0.9);
});

test("poRezimima bez predikata nema režima smjera, a ulazi se traže po satu", () => {
  const s = sati("2026-01-10T00:00:00.000Z", 48);
  const v = s.map((_, i) => i);
  // Ulazi u obrnutom redoslijedu i s viškom — smiju.
  const ulazi = [...s].reverse().map((sat) => ulaz(sat, 2.5, 0, 150));
  ulazi.push(ulaz("2030-01-01T00:00:00.000Z", 9, 0, 999));
  const r = poRezimima(s, v, v, ulazi);
  assert.equal(r.smjer, undefined);
  assert.equal(r.brzina["2-4"].n, 48);
  assert.equal(r.dubina["100-300"].n, 48);
  assert.equal(r.sezona.DJF.n, 48);
  blizu(r.brzina["2-4"].spearman, 1);
});

// ----------------------------------------------------------- nulti modeli

test("nulteVrijednosti: klimatologija uči samo na razdoblju ugađanja", () => {
  const ug = sati("2026-02-01T00:00:00.000Z", 24 * 3);
  // Po satu dana: 10 + sat, tri dana isto → medijan = 10 + sat.
  const ugV = ug.map((t) => 10 + mjesniSat(t));
  const s = sati("2026-05-10T00:00:00.000Z", 24);
  const mjereno = s.map(() => 999);
  const nulte = nulteVrijednosti(s, mjereno, [], {
    ugadjanje: { sati: ug, vrijednosti: ugV },
  });
  for (let i = 0; i < 24; i += 1) blizu(nulte.klimatologija[i], 10 + mjesniSat(s[i]));
  // Bez ugađanja klimatologije nema.
  const bez = nulteVrijednosti(s, mjereno, [], { ugadjanje: { sati: [], vrijednosti: [] } });
  assert.ok(bez.klimatologija.every((v) => Number.isNaN(v)));
});

test("nulteVrijednosti: perzistencija je prethodni sat, rupa daje NaN", () => {
  const s = sati("2026-05-10T00:00:00.000Z", 5);
  const mjereno = [1, 2, null, 4, 5];
  const nulte = nulteVrijednosti(s, mjereno, [], { ugadjanje: { sati: [], vrijednosti: [] } });
  assert.ok(Number.isNaN(nulte.perzistencija[0]));
  assert.equal(nulte.perzistencija[1], 1);
  assert.equal(nulte.perzistencija[2], 2);
  assert.ok(Number.isNaN(nulte.perzistencija[3]));
  assert.equal(nulte.perzistencija[4], 4);
});

test("nulteVrijednosti: sektorski i zastoj", () => {
  const s = sati("2026-05-10T00:00:00.000Z", 5);
  const ulazi: SatUlaza[] = [
    ulaz(s[0], 2, 320, null), // u sektoru ±45 oko 320
    ulaz(s[1], 0.1, 350, null), // u sektoru, brzina ispod poda
    ulaz(s[2], 2, 140, null), // suprotno
    ulaz(s[3], 2, 6, null), // 46° dalje → van
    { sat: s[4], vjetar: null, dubina: null, okolnosti: null },
  ];
  const nulte = nulteVrijednosti(s, s.map(() => 1), ulazi, {
    ugadjanje: { sati: [], vrijednosti: [] },
    azimutUzvjetra: 320,
  });
  blizu(nulte.sektorski[0], 0.5);
  blizu(nulte.sektorski[1], 1 / 0.3);
  blizu(nulte.sektorski[2], 0);
  blizu(nulte.sektorski[3], 0);
  assert.ok(Number.isNaN(nulte.sektorski[4]));
  blizu(nulte.zastoj[0], 0.5);
  blizu(nulte.zastoj[1], 1 / 0.3);
  blizu(nulte.zastoj[2], 0.5);
  assert.ok(Number.isNaN(nulte.zastoj[4]));

  // Rub sektora je uključiv; bez azimuta sektorskog nema.
  const rub = nulteVrijednosti(s, s.map(() => 1), [ulaz(s[0], 1, 5, null)], {
    ugadjanje: { sati: [], vrijednosti: [] },
    azimutUzvjetra: 320,
    sektor: 45,
  });
  blizu(rub.sektorski[0], 1);
  const bezAzimuta = nulteVrijednosti(s, s.map(() => 1), ulazi, {
    ugadjanje: { sati: [], vrijednosti: [] },
  });
  assert.ok(Number.isNaN(bezAzimuta.sektorski[0]));
  blizu(bezAzimuta.zastoj[0], 0.5);
});

// ------------------------------------------------------------------ dojave

test("dojaveMetrike broji po dojavljenim satima i računa AUC", () => {
  const s = sati("2026-08-01T18:00:00.000Z", 6);
  const dojava = (i: number, smrdi: boolean, prijemnik = "dracevac"): DojavaSat => ({
    sat: s[i],
    prijemnik,
    smrdi,
    tezina: smrdi ? 1 : 0,
    dojavitelj: "a",
    idDojave: i,
  });
  const dojave = [
    dojava(0, true),
    dojava(1, true),
    dojava(2, false),
    dojava(3, false),
    dojava(4, true),
    dojava(5, false, "bilice"), // nema predikcije → ispada
  ];
  const predikcije = new Map<string, number>([
    [kljucDojave("dracevac", s[0]), 0.9],
    [kljucDojave("dracevac", s[1]), 0.2],
    [kljucDojave("dracevac", s[2]), 0.1],
    [kljucDojave("dracevac", s[3]), 0.6],
    [kljucDojave("dracevac", s[4]), 0.7],
  ]);
  const m = dojaveMetrike(dojave, predikcije, 0.5);
  assert.equal(m.n, 5);
  assert.equal(m.nSmrdi, 3);
  assert.equal(m.pogodci, 2);
  assert.equal(m.promasaji, 1);
  assert.equal(m.lazne, 1);
  assert.equal(m.tocneNegative, 1);
  blizu(m.POD, 2 / 3);
  blizu(m.FAR, 1 / 3);
  blizu(m.CSI, 0.5);
  // Rangovi: 0,9→5, 0,2→2, 0,1→1, 0,6→3, 0,7→4; smrdi: 5+2+4 = 11; (11 − 6) / (3·2).
  blizu(m.aucDojava, 5 / 6);

  const prazno = dojaveMetrike([], predikcije, 0.5);
  assert.equal(prazno.n, 0);
  blizu(prazno.POD, NaN);
  blizu(prazno.aucDojava, NaN);
});

// ----------------------------------------------------------------- sažetak

test("zaokruzi ide kroz strukturu i ostavlja NaN", () => {
  const z = zaokruzi({ a: 1.23456789, b: [NaN, 2.00004], c: { d: "x", e: null } });
  assert.deepEqual(z.a, 1.2346);
  assert.ok(Number.isNaN(z.b[0]));
  assert.equal(z.b[1], 2);
  assert.deepEqual(z.c, { d: "x", e: null });
});

test("sazetak slaže sve u zaokružen zapis koji se da spremiti kao JSON", () => {
  const n = 24 * 30;
  const s = sati("2026-03-01T00:00:00.000Z", n);
  const slucajno = mulberry32(99);
  const ulazi: SatUlaza[] = s.map((sat) =>
    ulaz(sat, 0.3 + slucajno() * 5, slucajno() * 360, 50 + slucajno() * 400),
  );
  const mjereno = s.map((_, i) => {
    const v = ulazi[i].vjetar as NonNullable<SatUlaza["vjetar"]>;
    const nizvjetar = kutnaRazlika(v.smjerOd, 320) <= 45;
    return 1.2 + (nizvjetar ? 3 / Math.max(v.brzina, 0.3) : 0) + slucajno() * 0.5;
  });
  const model = mjereno.map((v) => 0.01 * (v - 1.2) + 0.0005 * slucajno());
  const ug = sati("2025-03-01T00:00:00.000Z", 24 * 10);
  const dojave: DojavaSat[] = [0, 1, 2, 3].map((i) => ({
    sat: s[i],
    prijemnik: "dracevac",
    smrdi: mjereno[i] > 2,
    tezina: 1,
    dojavitelj: "a",
    idDojave: i,
  }));
  const predikcije = new Map(dojave.map((d) => [kljucDojave(d.prijemnik, d.sat), model[d.idDojave]]));

  const o = sazetak({
    sati: s,
    model,
    mjereno,
    ulazi,
    pragMjereno: 2.4,
    nizvjetar: (u) => kutnaRazlika(u.vjetar?.smjerOd ?? 0, 320) <= 45,
    ugadjanje: { sati: ug, vrijednosti: ug.map(() => 1.2) },
    azimutUzvjetra: 320,
    dojave,
    predikcije,
    ponavljanja: 50,
    sjeme: 4,
  });

  assert.equal(o.n, n);
  assert.equal(o.pragMjereno, 2.4);
  assert.equal(o.udioVrha, 0.1);
  assert.ok(o.ukupno.spearman > 0.9);
  assert.ok(o.ukupno.aucVrha > 0.9);
  assert.ok(o.ukupno.spearmanBezHoda > 0.8);
  assert.ok(Math.abs(o.nultiPojas.spearman.medijan) < 0.2);
  assert.ok(o.ukupno.spearman > o.nultiPojas.spearman.max);

  assert.deepEqual(Object.keys(o.nultiModeli).sort(), [
    "klimatologija",
    "perzistencija",
    "sektorski",
    "zastoj",
  ]);
  assert.equal(o.nultiModeli.klimatologija.n, n);
  // Klimatologija je ravna → ρ je NaN; sektorski nulti model ovdje je gotovo
  // sama istina, pa mu je ρ visok. To je i poanta: model mora biti bolji.
  assert.ok(Number.isNaN(o.nultiModeli.klimatologija.spearman));
  assert.ok(o.nultiModeli.sektorski.spearman > 0.5);
  assert.ok(o.nultiModeli.perzistencija.n === n - 1);

  // Izjednačeni kvantili: pristranost ≈ 1.
  blizu(o.kontingencija.pristranost, 1, 0.05);
  assert.equal(o.kontingencija.pogodci + o.kontingencija.promasaji, mjereno.filter((v) => v > 2.4).length);
  assert.ok(o.kontingencija.POD > 0.8);

  blizu(o.regresija.nagib, 100, 5);
  assert.ok(o.regresija.nagib95[0] <= o.regresija.nagib && o.regresija.nagib <= o.regresija.nagib95[1]);
  assert.equal(o.regresija.dana, 30);
  assert.equal(o.regresija.ponavljanja, 50);

  assert.ok(o.rezimi.smjer);
  assert.equal(o.rezimi.dobaDana.noc.n + o.rezimi.dobaDana.dan.n, n);
  assert.equal(o.rezimi.sezona.MAM.n, n);

  assert.ok(o.dojave);
  assert.equal(o.dojave?.n, 4);

  // Zaokruženo na 4 decimale i prolazi kroz JSON (NaN → null).
  const tekst = JSON.stringify(o);
  const natrag = JSON.parse(tekst);
  assert.equal(natrag.nultiModeli.klimatologija.spearman, null);
  assert.equal(natrag.ukupno.spearman, o.ukupno.spearman);
  const decimale = String(o.ukupno.spearman).split(".")[1] ?? "";
  assert.ok(decimale.length <= 4);
  // Sat s rupom u modelu ispada iz svega.
  const oRupa = sazetak({
    sati: s,
    model: model.map((v, i) => (i < 10 ? null : v)),
    mjereno,
    ulazi,
    pragMjereno: 2.4,
    ponavljanja: 10,
  });
  assert.equal(oRupa.n, n - 10);
  assert.equal(oRupa.dojave, null);
  assert.equal(oRupa.rezimi.smjer, undefined);
  assert.deepEqual(Object.keys(oRupa.nultiModeli).sort(), ["perzistencija", "zastoj"]);
});
