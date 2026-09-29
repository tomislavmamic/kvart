import type { ReactNode } from "react";
import Link from "next/link";
import obligations from "@/generated/sidewalk-obligations.json";
import { stabala } from "@/lib/gup-grad/planovi-na-snazi";

type Reason = { tekst: string; navod?: string; url?: string };
type Act = { naziv: string; klasa: string; datum: string | null; izdao?: string };
type Obligation = {
  id: string;
  vrsta: "ulica" | "dpu" | "gup";
  tko: string;
  uloga?: string;
  cestica: string;
  cestice?: string;
  adresa?: string;
  sto?: string;
  sto_dodatno?: string;
  zasto: Reason[];
  akti: Act[];
  posadeno?: string;
  stanje: string;
  uvjetno?: boolean;
  izracun: { stabala?: number; neizgradeno_m2?: number; zelenilo_m2?: number };
};
// JSON s obvezama raznih vrsta TypeScript vidi kao uniju; ovdje je jedan oblik.
const data = obligations as unknown as {
  provjereno: string;
  dugovano_stabala: number;
  registar: { naziv: string; url: string; napomena: string };
  obveze: Obligation[];
};

/** Stabla koja susjedne građevine danas duguju (bez uvjetnih obveza). */
export const OWED_TREES = data.dugovano_stabala;
export const OBLIGATIONS_URL = "/geo/prijedlozi/nogostupi-obveze.geojson";

const linkStyle = "fokus rounded font-semibold text-maslina underline underline-offset-4 hover:text-maslina-tamna";
const number = (value: number) => value.toLocaleString("hr-HR", { maximumFractionDigits: 0 });
const date = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
};

function what(o: Obligation) {
  if (o.vrsta !== "gup") return o.sto;
  const { stabala: n = 0, neizgradeno_m2: unbuilt = 0 } = o.izracun;
  return `${o.uvjetno ? "Oko" : "Najmanje"} ${stabala(n)}: 1 na 200 m² neizgrađenog dijela čestice (danas oko ${number(unbuilt)} m²); ${o.sto_dodatno}.`;
}

function where(o: Obligation) {
  if (o.vrsta === "ulica") return `Uz nogostup, unutar cestovne čestice ${o.cestica}: zeleni krugovi na karti.`;
  if (o.vrsta === "dpu") return "Na mjestima koja plan crta: ljubičasti krugovi na karti.";
  if (o.uvjetno) return "Na čestici, kad se pogon izgradi. Na karti je označena samo čestica.";
  const one = o.izracun.stabala === 1;
  return `Na neizgrađenom dijelu čestice; točan položaj određuje projekt. Na karti ${one ? "ga" : "ih"} predlažemo što bliže ulici, kao drugi red iza stabala na nogostupu, gdje bi ${one ? "hladilo" : "hladila"} i pješake.`;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return <div className="sm:grid sm:grid-cols-[7rem_1fr] sm:gap-4"><dt className="font-semibold text-kamen-tinta">{term}</dt><dd className="mt-1 leading-7 sm:mt-0">{children}</dd></div>;
}

function ObligationCard({ o }: { o: Obligation }) {
  return <article className={`rounded-xl border p-5 ${o.uvjetno ? "border-dashed border-kamen-rub" : "border-kamen-rub"} bg-white`}>
    <h3 className="text-lg font-bold leading-snug">{o.tko}</h3>
    <p className="mt-1 text-sm text-kamen-tekst">{[o.uloga, o.adresa, `k.č. ${o.cestice ?? o.cestica}, k.o. Split`].filter(Boolean).join(" · ")}{o.uvjetno && <span className="ml-2 rounded-full bg-kamen-tlo px-2 py-0.5 font-semibold">uvjetno</span>}</p>
    <dl className="mt-4 space-y-3 text-kamen-tekst">
      <Row term="Što">{what(o)}</Row>
      <Row term="Zašto"><ul className="space-y-1">{o.zasto.map((z) => <li key={z.tekst}>{z.navod ? <Link className={linkStyle} href={z.navod}>{z.tekst}</Link> : z.url ? <a className={linkStyle} href={z.url}>{z.tekst}</a> : z.tekst}</li>)}</ul></Row>
      <Row term="Akti"><ul className="space-y-1">{o.akti.map((a) => <li key={a.klasa}>{a.naziv} · <span className="whitespace-nowrap font-mono text-xs">KLASA {a.klasa}</span>{a.datum && `, ${date(a.datum)}`}{a.izdao && ` · ${a.izdao}`}</li>)}</ul></Row>
      <Row term="Gdje">{where(o)}</Row>
      <Row term="Danas">{[o.posadeno, o.stanje].filter(Boolean).join(" ")}</Row>
    </dl>
  </article>;
}

export function PlantingObligations() {
  return <section id="obveze" className="scroll-mt-24">
    <h2 className="text-2xl font-bold tracking-tight">Tko je dužan saditi</h2>
    <div className="mt-3 max-w-3xl space-y-3 text-lg leading-8 text-kamen-tekst">
      <p>Dio drvoreda uz ovu cestu već je propisan. Grad je dužan urediti ulicu s drvoredom gdje ima prostora, a vlasnici susjednih građevina dužni su posaditi stabla na svojim česticama, po detaljnom planu ili po GUP-u, kao dio dozvole za gradnju.</p>
      <p>Susjedne građevine danas duguju {stabala(OWED_TREES)}, a nijedno nije posađeno kako plan traži. Na karti su ljubičasta.</p>
    </div>
    <div className="mt-6 space-y-4">{data.obveze.map((o) => <ObligationCard key={o.id} o={o} />)}</div>
    <div className="mt-6 max-w-3xl space-y-3 text-sm leading-6 text-kamen-tekst">
      <p>GUP (čl. 91.) traži stabla „očekivane visine cca 10 m”, pri sadnji visoka najmanje 3 m, a hortikulturno rješenje mora biti u projektu za dozvolu. Njegova je provedba uvjet za uporabnu dozvolu. Uz to traži 1 stablo na 4 otvorena parkirna mjesta; koliko je mjesta odobreno ne znamo, pa ta stabla nisu u zbroju.</p>
      <p>Akti su iz javnog <a className={linkStyle} href={data.registar.url}>{data.registar.naziv}</a> (provjereno {date(data.provjereno)}), a stanje sa snimaka DGU-a od 2011. do 2025./26. Registar pokazuje samo osnovne podatke o aktu. Koliko je stabala i gdje ucrtano, vidi se u glavnom projektu, koji se od Grada Splita može zatražiti pozivom na pravo na pristup informacijama i klasu akta. {data.registar.napomena} Ostale zgrade uz cestu starije su od te obveze ili nemaju dozvolu izdanu otkad je GUP 2006. uveo.</p>
      <p><a className={linkStyle} href={OBLIGATIONS_URL}>Preuzmi podatke o obvezama (GeoJSON)</a></p>
    </div>
  </section>;
}
