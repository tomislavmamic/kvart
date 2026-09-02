/**
 * Kritika jedne vrtnje na epizodama: gdje i kada model promašuje.
 *
 * Kritičar ne piše model; traži obrazac promašaja. Za svaku epizodu iz
 * knjižnice usporedi sat po sat model (k1) i mjerenje: kad je epizoda
 * počela i završila po mjerenju, a kad po modelu; koliko se sati
 * preklapaju; i koji su sati najgori promašaji — visok H₂S uz prazan model
 * (propust) i pun model uz čist zrak (lažna uzbuna) — zajedno s vjetrom,
 * dubinom i razredom stabilnosti tih sati, da se vidi režim u kojem model
 * pada.
 *
 * Pokretanje: npx tsx scripts/hindcast/kritika.ts <id-vrtnje> [izlaz.md]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { razredStabilnosti, RAZREDI } from "@/lib/sim/stabilnost";

import { RAZDOBLJA } from "./epizode";
import { kvantil, spearman } from "./metrike";
import type { Epizoda, Opazanja, Predikcija, SatUlaza } from "./tipovi";

const [id, izlazPut] = process.argv.slice(2);
if (!id) {
  console.error("kritika.ts <id-vrtnje> [izlaz.md]");
  process.exit(1);
}
const mapa = join(process.cwd(), ".cache", "hindcast", "runs", id);
const pred: Predikcija[] = JSON.parse(readFileSync(join(mapa, "predikcije.json"), "utf8"));
const op: Opazanja = JSON.parse(readFileSync(join(mapa, "opazanja.json"), "utf8"));
const ul: SatUlaza[] = JSON.parse(readFileSync(join(mapa, "ulazi.json"), "utf8")).ulazi;
const epizode: Epizoda[] = JSON.parse(readFileSync(join(process.cwd(), "docs", "hindcast", "epizode.json"), "utf8"));

const model = new Map(pred.filter((p) => p.prijemnik === "k1").map((p) => [p.sat, p.gustoca]));
const obs = new Map(op.h2s.filter((o) => o.izvor === "zavod-k1").map((o) => [o.sat, o.vrijednost]));
const ulaz = new Map(ul.map((u) => [u.sat, u]));

const uUg = (s: string) => s >= `${RAZDOBLJA.ugadjanje.od}T` && s < `${RAZDOBLJA.ugadjanje.do}T`;
const zajedno = [...obs.keys()].filter((s) => model.has(s));
const pragObs = kvantil(zajedno.filter(uUg).map((s) => obs.get(s)!), 0.9);
const modelUg = zajedno.filter(uUg).map((s) => model.get(s)!);
const udio = zajedno.filter(uUg).filter((s) => obs.get(s)! > pragObs).length / zajedno.filter(uUg).length;
const pragModel = kvantil(modelUg, 1 - udio);

function razred(u: SatUlaza | undefined): string {
  if (!u?.vjetar || !u.okolnosti || u.okolnosti.sunce === null || u.okolnosti.oblaci === null) return "?";
  return RAZREDI[razredStabilnosti(u.vjetar.brzina, u.okolnosti.sunce, u.okolnosti.oblaci)];
}
function opisSata(s: string): string {
  const u = ulaz.get(s);
  if (!u?.vjetar) return "bez vjetra";
  return `${u.vjetar.smjerOd.toFixed(0)}° ${u.vjetar.brzina.toFixed(1)} m/s, sloj ${u.dubina?.m ?? "?"} m, ${razred(u)}`;
}
const mjesno = (s: string) =>
  new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", hour: "2-digit", hourCycle: "h23" }).format(new Date(s));

const redci: string[] = [];
redci.push(`# Kritika vrtnje \`${id}\` na epizodama\n`);
redci.push(`Prag epizode (90. postotak H₂S-a u ugađanju): ${pragObs.toFixed(2)} µg/m³; prag modela izjednačen po udjelu: ${pragModel.toFixed(2)}.\n`);
redci.push(`| epizoda | uloga | vrste | sati | ρ | mjereno: prvi/zadnji sat iznad praga | model: prvi/zadnji | preklop | propusti | lažne |`);
redci.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);

type Promasaj = { sat: string; obs: number; model: number; vrsta: "propust" | "lazna" };
const promasaji: Promasaj[] = [];

for (const e of epizode) {
  const od = `${e.razdoblje.od}T00:00:00.000Z`;
  const do_ = `${e.razdoblje.do}T00:00:00.000Z`;
  const sati = zajedno.filter((s) => s >= od && s < do_).sort();
  if (sati.length < 12) continue;
  const o = sati.map((s) => obs.get(s)!);
  const m = sati.map((s) => model.get(s)!);
  const rho = spearman(m, o);
  const obsPoz = sati.filter((s, i) => o[i] > pragObs);
  const modPoz = sati.filter((s, i) => m[i] > pragModel);
  const oba = obsPoz.filter((s) => modPoz.includes(s)).length;
  const propusti = obsPoz.filter((s) => !modPoz.includes(s));
  const lazne = modPoz.filter((s) => !obsPoz.includes(s));
  for (const s of propusti) promasaji.push({ sat: s, obs: obs.get(s)!, model: model.get(s)!, vrsta: "propust" });
  for (const s of lazne) promasaji.push({ sat: s, obs: obs.get(s)!, model: model.get(s)!, vrsta: "lazna" });
  const raspon = (x: string[]) => (x.length ? `${mjesno(x[0])} / ${mjesno(x[x.length - 1])}` : "—");
  redci.push(
    `| ${e.id} | ${e.uloga} | ${e.vrsta.join(", ")} | ${sati.length} | ${Number.isFinite(rho) ? rho.toFixed(2) : "—"} | ${raspon(obsPoz)} (${obsPoz.length} h) | ${raspon(modPoz)} (${modPoz.length} h) | ${oba} | ${propusti.length} | ${lazne.length} |`,
  );
}

const poRezimu = (lista: Promasaj[]) => {
  const r: Record<string, number> = {};
  for (const p of lista) {
    const u = ulaz.get(p.sat);
    const k = `${razred(u)} ${u?.vjetar ? (u.vjetar.brzina < 1 ? "<1 m/s" : u.vjetar.brzina < 2 ? "1–2 m/s" : "≥2 m/s") : "?"}`;
    r[k] = (r[k] ?? 0) + 1;
  }
  return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join("; ");
};
redci.push(`\n## Propusti i lažne uzbune po režimu (razred stabilnosti, brzina)\n`);
redci.push(`- propusti (${promasaji.filter((p) => p.vrsta === "propust").length}): ${poRezimu(promasaji.filter((p) => p.vrsta === "propust"))}`);
redci.push(`- lažne (${promasaji.filter((p) => p.vrsta === "lazna").length}): ${poRezimu(promasaji.filter((p) => p.vrsta === "lazna"))}`);

redci.push(`\n## Najgori propusti (visok H₂S, prazan model)\n`);
redci.push(`| sat (mjesno) | H₂S | model | vjetar, sloj, razred |`);
redci.push(`| --- | --- | --- | --- |`);
for (const p of promasaji.filter((p) => p.vrsta === "propust").sort((a, b) => b.obs - a.obs).slice(0, 15)) {
  redci.push(`| ${mjesno(p.sat)} | ${p.obs.toFixed(2)} | ${p.model.toFixed(1)} | ${opisSata(p.sat)} |`);
}
redci.push(`\n## Najgore lažne uzbune (pun model, čist zrak)\n`);
redci.push(`| sat (mjesno) | H₂S | model | vjetar, sloj, razred |`);
redci.push(`| --- | --- | --- | --- |`);
for (const p of promasaji.filter((p) => p.vrsta === "lazna").sort((a, b) => b.model - a.model).slice(0, 15)) {
  redci.push(`| ${mjesno(p.sat)} | ${p.obs.toFixed(2)} | ${p.model.toFixed(1)} | ${opisSata(p.sat)} |`);
}

const tekst = redci.join("\n") + "\n";
if (izlazPut) writeFileSync(izlazPut, tekst);
else process.stdout.write(tekst);
