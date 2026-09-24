import assert from "node:assert/strict";
import test from "node:test";

import { izracunajGodinu, pokrivenost, procijeniKomad, type Komad, type UvjetiKomada } from "@/lib/gup-grad/izracun";
import { ZADANA_PRAVILA, type Pravila } from "@/lib/gup-grad/pravila";

function komad(dio: Partial<Komad> = {}): Komad {
  return { klasa: 2, n: 100, zk: 0, z25: 0, kat: 0, pr: 0, pa: 0, jv: 0, os: 0, inf: 0, ze: 0, gr: 0, g: 0, ...dio };
}

const gradevna: Pravila = ZADANA_PRAVILA;
const udio: Pravila = { ...ZADANA_PRAVILA, nacin: "udio" };
const prag: Pravila = { ...ZADANA_PRAVILA, nacin: "prag", prag: 0.2 };
const cijela: Pravila = { ...ZADANA_PRAVILA, nacin: "cijela" };

test("udio: iskorišten je samo pokriveni dio", () => {
  const r = procijeniKomad(komad({ zk: 30, z25: 30, g: 1 }), "M/K5", udio);
  assert.equal(r.iskoristeno, 30);
  assert.equal(r.uSkladu, 30);
  assert.equal(r.uSuprotnosti, 0);
});

test("prag: kuća na 30 % čestice broji cijelu česticu, na 10 % samo tlocrt", () => {
  assert.equal(procijeniKomad(komad({ zk: 30, g: 1 }), "M/K5", prag).iskoristeno, 100);
  assert.equal(procijeniKomad(komad({ zk: 10, g: 1 }), "M/K5", prag).iskoristeno, 10);
});

test("cijela: krhotina ispod najmanjeg traga ne pretvara česticu u iskorištenu", () => {
  assert.equal(procijeniKomad(komad({ zk: 2, g: 1 }), "M/K5", cijela).iskoristeno, 2);
  assert.equal(procijeniKomad(komad({ zk: 5, g: 1 }), "M/K5", cijela).iskoristeno, 100);
});

test("kuća u zaštitnom zelenilu je u suprotnosti; ulica kroz njega se izuzima iz zone", () => {
  const r = procijeniKomad(komad({ zk: 20, pr: 30, g: 1 }), "Z5", udio);
  assert.equal(r.uSuprotnosti, 20);
  assert.equal(r.uSkladu, 0);
  assert.equal(r.ulica, 30);
  assert.equal(r.n, 70);
  // bez izuzimanja ulica je korištenje zone, i to po planu
  const bez = procijeniKomad(komad({ zk: 20, pr: 30, g: 1 }), "Z5", { ...udio, ulice: { izuzmi: false, pragUlicneCestice: 0.6 } });
  assert.equal(bez.uSkladu, 30);
  assert.equal(bez.ulica, 0);
});

test("komad koji je većinom ulica izuzima se cijeli; u P ulica ostaje", () => {
  const r = procijeniKomad(komad({ pr: 70 }), "M/K5", udio);
  assert.equal(r.ulica, 100);
  assert.equal(r.n, 0);
  assert.equal(r.iskoristeno, 0);
  const p = procijeniKomad(komad({ klasa: 15, pr: 70 }), "P", udio);
  assert.equal(p.ulica, 0);
  assert.equal(p.iskoristeno, 70);
});

test("izracunajGodinu seli izuzete ulice iz zone u P", () => {
  const r = izracunajGodinu(
    { klasePx: { 2: 1000, 15: 200 }, komadi: [komad({ pr: 30, zk: 20, g: 1 })], pikselM2: 4 },
    udio,
  );
  const m = r.find((x) => x.kod === "M/K5")!;
  const p = r.find((x) => x.kod === "P")!;
  assert.equal(m.ukupnoM2, (1000 - 30) * 4);
  assert.equal(m.uliceM2, 120);
  assert.equal(p.ukupnoM2, (200 + 30) * 4);
  assert.equal(p.iskoristenoM2, 120);
});

test("premali ostatak: sam je ostatak, uz slobodnog susjeda nije, uz iskorištenog jest", () => {
  // tri čestice u M/K5 (najmanje 300 m² = 75 px): 0 i 1 se dodiruju, 1 i 2 se dodiruju
  const susjedi = { od: [0, 1, 3, 4], lista: [1, 0, 2, 1] };
  const kom = (cestica: number, n: number, zk = 0) => ({ ...komad({ n, zk, g: zk ? 1 : 0 }), cestica });
  // najmanja čestica iz odredbi: 300 m² za mješovitu (npr. interpolacija u 2.5), zelenilo bez
  const uvjeti = (k: { klasa: number }): UvjetiKomada => ({
    najmanjaPx: k.klasa === 2 ? 75 : 0,
    kig: null,
    novaGradnja: true,
    pikselM2: 4,
  });
  const ulaz = (komadi: ReturnType<typeof kom>[]) => ({ klasePx: { 2: 10_000 }, komadi, pikselM2: 4, susjedi, uvjeti });
  // 0: prazna 40 px, 1: kuća (iskorištena), vrt 30 px, 2: prazna 50 px
  let r = izracunajGodinu(ulaz([kom(0, 40), kom(1, 100, 70), kom(2, 50)]), udio);
  // 0 i 1 nisu spojive u građevnu (1 je iskorištena, ali 0 je slobodna pa se vrt pridružuje: 40+30 < 75);
  // 2 je slobodna i dira 1: 50+30 = 80 ≥ 75 → i 0 se preko 1 spaja: sve jedna skupina od 120 px
  assert.equal(r.find((x) => x.kod === "M/K5")!.ostatakM2, 0);
  // bez treće čestice skupina 0+1 ima 70 px < 75 → oboje ostatak
  r = izracunajGodinu(ulaz([kom(0, 40), kom(1, 100, 70)]), udio);
  assert.equal(r.find((x) => x.kod === "M/K5")!.ostatakM2, (40 + 30) * 4);
  // dva vrta uz dvije kuće se ne spajaju, iako zajedno imaju dosta
  const dvijeKuce = izracunajGodinu(ulaz([kom(0, 100, 50), kom(1, 100, 50)]), udio);
  assert.equal(dvijeKuce.find((x) => x.kod === "M/K5")!.ostatakM2, (50 + 50) * 4);
  // zelenilo nema najmanju površinu
  const z = izracunajGodinu(
    { klasePx: { 11: 1000 }, komadi: [{ ...komad({ klasa: 11, n: 10 }), cestica: 0 }], pikselM2: 4, susjedi, uvjeti },
    udio,
  );
  assert.equal(z.find((x) => x.kod === "Z5")!.ostatakM2, 0);
});

test("kombinirana namjena M/K5 dopušta i stanovanje i poslovanje", () => {
  assert.equal(procijeniKomad(komad({ zk: 20, g: 1 }), "M/K5", udio).uSuprotnosti, 0);
  assert.equal(procijeniKomad(komad({ zk: 20, g: 2 }), "M/K5", udio).uSuprotnosti, 0);
  // čista gospodarska zona stanovanje ne dopušta
  assert.equal(procijeniKomad(komad({ zk: 20, g: 1 }), "I/K", udio).uSuprotnosti, 20);
});

test("zgrada iz 3D modela koje nema u katastru: suprotna u zelenilu, dopuštena u gospodarskoj", () => {
  const k = komad({ zk: 0, z25: 25 });
  assert.equal(procijeniKomad(k, "Z1", udio).uSuprotnosti, 25);
  assert.equal(procijeniKomad(k, "I/K", udio).uSuprotnosti, 0);
  // izvor samo katastar tu zgradu ne vidi
  assert.equal(procijeniKomad(k, "Z1", { ...udio, zgrade: "katastar" }).iskoristeno, 0);
});

test("preklopljena mjerenja ne daju više od površine komada", () => {
  const d = pokrivenost(komad({ zk: 70, z25: 80, pr: 50, os: 40, g: 1 }), udio);
  assert.equal(d.reduce((s, [, v]) => s + v, 0), 100);
  assert.deepEqual(d.map(([v]) => v), ["stambena", "neevidentirana", "promet"]);
});

test("izracunajGodinu zbraja po klasi i množi pikselom", () => {
  const r = izracunajGodinu(
    {
      klasePx: { 2: 1000, 11: 500 },
      komadi: [komad({ zk: 40, g: 1 }), komad({ klasa: 11, zk: 10, g: 1 })],
      pikselM2: 4,
    },
    udio,
  );
  const m = r.find((x) => x.kod === "M/K5")!;
  const z = r.find((x) => x.kod === "Z5")!;
  assert.equal(m.ukupnoM2, 4000);
  assert.equal(m.iskoristenoM2, 160);
  assert.equal(z.uSuprotnostiM2, 40);
  assert.equal(z.suprotnoPoVrstiM2.stambena, 40);
});

const u = (d: Partial<UvjetiKomada> = {}): UvjetiKomada => ({ najmanjaPx: 125, kig: 0.3, novaGradnja: true, pikselM2: 4, ...d });

test("gradevna: kuća troši tlocrt / kig, a ne manje od Ppmin; ostatak je slobodan tek ako stane nova čestica", () => {
  // 1000 m² (250 px), kuća 150 m² (37,5 px) uz kig 0,3 → treba 125 px = Ppmin 500 m²
  const k = komad({ n: 250, zk: 37.5, g: 1 });
  const r = procijeniKomad(k, "M/K5", gradevna, u());
  assert.equal(r.iskoristeno, 125);
  assert.equal(r.poVrsti.okucnica, 87.5);
  // na 900 m² ostaje 400 m² < Ppmin 500 m² → cijela je čestica okućnica
  const manja = procijeniKomad({ ...k, n: 225 }, "M/K5", gradevna, u());
  assert.equal(manja.iskoristeno, 225);
  // „samo tlocrt” broji samo kuću
  assert.equal(procijeniKomad(k, "M/K5", udio, u()).iskoristeno, 37.5);
});

test("gradevna: okućnica dijeli sud zgrade — kuća u zaštitnom zelenilu, okućnica i ona protivna", () => {
  const r = procijeniKomad(komad({ klasa: 11, n: 100, zk: 20, g: 1 }), "Z5", gradevna);
  assert.equal(r.iskoristeno, 100);
  assert.equal(r.uSuprotnosti, 100);
});

test("gradevna: gdje odredbe ne dopuštaju novu gradnju, slobodno nije za gradnju, a vrt uz kuću je okućnica", () => {
  const prazna = procijeniKomad(komad({ n: 400 }), "M/K5", gradevna, u({ novaGradnja: false }));
  assert.equal(prazna.iskoristeno, 0);
  assert.equal(prazna.zabranjeno, 400);
  const kuca = procijeniKomad(komad({ n: 1000, zk: 37.5, g: 1 }), "M/K5", gradevna, u({ novaGradnja: false }));
  assert.equal(kuca.iskoristeno, 1000);
  assert.equal(kuca.zabranjeno, 0);
});

test("parkiralište, škola, park i gradilište su korištenje zemljišta; ručni pregled popuni ostatak", () => {
  const d = pokrivenost(komad({ pa: 30, jv: 20, ze: 10, gr: 5 }), udio);
  assert.deepEqual(d, [["gradiliste", 5], ["parkiraliste", 30], ["javna", 20], ["zelenilo", 10]]);
  const r = procijeniKomad(komad({ pa: 30, rucno: "parkiraliste" }), "M/K5", udio);
  assert.equal(r.iskoristeno, 100);
  assert.equal(r.uSuprotnosti, 0);
  const s = procijeniKomad(komad({ rucno: "neizgradivo" }), "M/K5", gradevna, u());
  assert.equal(s.neizgradivo, 100);
});

test("gradevna: neboder troši česticu po kis-u, ne samo po tlocrtu", () => {
  // tlocrt 100 px, 8 etaža = 800 px bruto; kig 0,3 → 333 px, kis 1,5 → 533 px
  const k = komad({ n: 3000, z25: 100, kat: 800 });
  const r = procijeniKomad(k, "M/K5", gradevna, u({ kis: 1.5, najmanjaPx: 350 }));
  assert.ok(Math.abs((r.poVrsti.okucnica ?? 0) + 100 - 800 / 1.5) < 1e-9);
});

test("okućnica kuće po planu nije u protivnom po vrsti; okućnica protivne kuće jest", () => {
  const r = izracunajGodinu(
    { klasePx: { 2: 1000, 11: 500 }, komadi: [komad({ n: 100, zk: 20, g: 1 }), komad({ klasa: 11, n: 100, zk: 20, g: 1 })], pikselM2: 4 },
    gradevna,
  );
  const m = r.find((x) => x.kod === "M/K5")!;
  const z = r.find((x) => x.kod === "Z5")!;
  assert.equal(m.suprotnoPoVrstiM2.okucnica, undefined);
  assert.equal(z.suprotnoPoVrstiM2.okucnica, 80 * 4);
  assert.equal(z.uSuprotnostiM2, 100 * 4);
});
