import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import figures from "@/generated/sidewalk-figures.json";
import obligations from "@/generated/sidewalk-obligations.json";
import { stabala } from "@/lib/gup-grad/planovi-na-snazi";
import { MapFocusButton } from "./map-focus-button";

type Source = { tekst: string; navod?: string; url?: string };
type Act = { naziv: string; klasa: string; datum: string | null; izdao?: string };
type Computed = {
  okvir: number[];
  stabala?: number;
  zelenilo_m2?: number;
  zamjenjuje?: string[];
  ulicna_ispred?: string[];
  ulicna_dvostruki_red?: string[];
  uz_dalekovod?: number | string[];
  mjesta_na_nogostupu?: number;
  mjesta_u_prijedlogu?: number;
  u_kolnim_ulazima?: string[];
  ulicna_u_ulazu?: string[];
  ulicna_uz_instalacije?: number;
  okvir_dalekovod?: number[] | null;
  masline_na_cesti_m2?: number;
  masline_na_cestici_m2?: number;
};
type Obligation = { id: string; tko: string; cestica: string; citat?: string; izvori: Source[]; akti: Act[]; izracun: Computed };
type Figure = {
  src: string; width: number; height: number; source: string;
  marks: { kind: string; xy: number[]; r: number; label?: string }[];
  lines: { kind: string; points: number[][]; label?: string }[];
  areas: { kind: string; points: number[][]; label?: string; label_xy?: number[] }[];
};
// JSON s obvezama raznih vrsta TypeScript vidi kao uniju; ovdje je jedan oblik.
const data = obligations as unknown as { provjereno: string; dugovano_stabala: number; registar: { naziv: string; url: string; napomena: string }; teren: string; obveze: Obligation[] };
const FIGURES = figures as unknown as Record<string, Figure>;
const byId = (id: string) => data.obveze.find((o) => o.id === id)!;

/** Stabla koja susjedne građevine danas duguju (bez uvjetnih obveza). */
export const OWED_TREES = data.dugovano_stabala;
/** Mjesta uz nogostup bez onih koja su pala u kolne ulaze. */
export const STREET_SPOTS = byId("grad-ulica").izracun.mjesta_na_nogostupu ?? 0;
/** Mjesta iz prijedloga nogostupa koja su u kolnim ulazima i otpadaju. */
export const SPOTS_IN_DRIVEWAYS = byId("grad-ulica").izracun.u_kolnim_ulazima ?? [];
export const OBLIGATIONS_URL = "/geo/prijedlozi/nogostupi-obveze.geojson";

const linkStyle = "fokus rounded font-semibold text-maslina underline underline-offset-4 hover:text-maslina-tamna";
const number = (value: number) => value.toLocaleString("hr-HR", { maximumFractionDigits: 0 });
const date = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
};
/** „Dva”, „Tri”… na početku rečenice; veće brojke ostaju brojke. */
const count = (n: number) => ["Nijedno", "Jedno", "Dva", "Tri", "Četiri"][n] ?? String(n);
/** „D4”, „D4 i D5”, „D4, D5 i D7”. */
const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} i ${items.at(-1)}`);

// Oblici na slikama; boje su iste kao na karti prijedloga.
const SHAPE: Record<string, { stroke: string; fill?: string; fillOpacity?: number; width: number; dash?: string }> = {
  owed: { stroke: "#7e22ce", fill: "#7e22ce", fillOpacity: 0.3, width: 2.5 },
  plan: { stroke: "#7e22ce", fill: "#7e22ce", fillOpacity: 0.15, width: 2.5, dash: "4 3" },
  street: { stroke: "#fff", fill: "#007956", fillOpacity: 1, width: 1.5 },
  "street-conflict": { stroke: "#fff", fill: "#a30037", fillOpacity: 1, width: 1.5 },
  "street-drop": { stroke: "#fff", fill: "#71717b", fillOpacity: 1, width: 1.5 },
  gap: { stroke: "#fff", fill: "#fff", fillOpacity: 0.45, width: 2, dash: "6 4" },
  plot: { stroke: "#7e22ce", width: 1.5 },
  "plot-conditional": { stroke: "#7e22ce", width: 1.5, dash: "6 4" },
  power: { stroke: "#dc2626", width: 3, dash: "10 6" },
  boundary: { stroke: "#f59e0b", width: 4 },
};
const LEGEND: [string, string, string][] = [
  ["plan", "#7e22ce", "Stablo ucrtano u planu"],
  ["owed", "#7e22ce", "Dugovano stablo, naš prijedlog položaja"],
  ["street", "#007956", "Mjesto uz nogostup"],
  ["street-conflict", "#a30037", "Mjesto uz nogostup, blizu voda"],
  ["street-drop", "#71717b", "Mjesto uz nogostup koje otpada"],
  ["power", "#dc2626", "Dalekovod 110 kV"],
  ["boundary", "#f59e0b", "Katastarska međa"],
];
const MIN_DOT = 12; // polumjer točke na slici, u pikselima slike

function Label({ at, figure, children, wide = false, centred = false }: { at: number[]; figure: Figure; children: ReactNode; wide?: boolean; centred?: boolean }) {
  // brojevi mjesta samo na širem zaslonu; na mobitelu ih ima karta
  return <span className={`pointer-events-none absolute -translate-y-1/2 whitespace-nowrap ${centred ? "-translate-x-1/2" : ""} rounded bg-white/90 px-1 text-xs font-semibold leading-4 text-kamen-tinta ${wide ? "hidden sm:block" : ""}`} style={{ left: `${(at[0] / figure.width) * 100}%`, top: `${(at[1] / figure.height) * 100}%` }}>{children}</span>;
}

/** Snimka ili list plana s oznakama: oblici su SVG, natpisi HTML, da ostanu oštri i čitljivi na mobitelu. */
export function ObligationFigure({ id, alt, caption, legend = true }: { id: string; alt: string; caption: string; legend?: boolean }) {
  const f = FIGURES[id];
  const kinds = new Set([...f.marks.map((m) => m.kind), ...f.lines.map((l) => l.kind)]);
  const middle = (points: number[][]) => points[Math.floor(points.length / 2)];
  return <figure>
    <div className="relative overflow-hidden rounded-xl bg-kamen-rub">
      <Image src={f.src} alt={alt} width={f.width} height={f.height} sizes="(max-width: 1024px) 100vw, 992px" className="h-auto w-full" />
      <svg viewBox={`0 0 ${f.width} ${f.height}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {f.areas.map((a, i) => { const s = SHAPE[a.kind] ?? SHAPE.plot; return <polygon key={`a${i}`} points={a.points.map((p) => p.join(",")).join(" ")} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} fill={s.fill ?? "none"} fillOpacity={s.fillOpacity} vectorEffect="non-scaling-stroke" />; })}
        {f.lines.map((l, i) => { const s = SHAPE[l.kind]; return <polyline key={`l${i}`} points={l.points.map((p) => p.join(",")).join(" ")} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} fill="none" vectorEffect="non-scaling-stroke" />; })}
        {f.marks.filter((m) => m.r > 0).map((m, i) => { const s = SHAPE[m.kind]; return <circle key={`m${i}`} cx={m.xy[0]} cy={m.xy[1]} r={Math.max(m.r, MIN_DOT)} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} fill={s.fill} fillOpacity={s.fillOpacity} vectorEffect="non-scaling-stroke" />; })}
      </svg>
      {f.areas.filter((a) => a.label && a.label_xy).map((a, i) => <Label key={`al${i}`} at={a.label_xy!} figure={f} centred>{a.label}</Label>)}
      {f.lines.filter((l, i) => l.label && f.lines.findIndex((o) => o.label === l.label && o.points.length > l.points.length) === -1 && f.lines.findIndex((o) => o.label === l.label && o.points.length === l.points.length) === i).map((l, i) => <Label key={`ll${i}`} at={middle(l.points)} figure={f}>{l.label}</Label>)}
      {f.marks.filter((m) => m.label).map((m, i) => m.kind === "note" ? <Label key={`ml${i}`} at={m.xy} figure={f} centred>{m.label}</Label> : <Label key={`ml${i}`} at={[m.xy[0] + Math.max(m.r, MIN_DOT) + 4, m.xy[1]]} figure={f} wide>{m.label}</Label>)}
    </div>
    {legend && <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-kamen-tekst">{LEGEND.filter(([kind]) => kinds.has(kind)).map(([kind, color, text]) => <li key={kind} className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{text}</li>)}</ul>}
    <figcaption className="mt-2 text-sm leading-6 text-kamen-tekst">{caption} · {f.source}</figcaption>
  </figure>;
}

function Sources({ o }: { o: Obligation }) {
  return <details className="text-sm text-kamen-tekst">
    <summary className="fokus inline-flex min-h-11 cursor-pointer items-center font-semibold text-maslina">Izvori i akti</summary>
    <ul className="mt-2 space-y-2 leading-6">
      {o.izvori.map((z) => <li key={z.tekst}>{z.navod ? <Link className={linkStyle} href={z.navod}>{z.tekst}</Link> : z.url ? <a className={linkStyle} href={z.url}>{z.tekst}</a> : z.tekst}</li>)}
      {o.akti.map((a) => <li key={a.klasa}>{a.naziv}{a.izdao ? ` (${a.izdao})` : ""} · <span className="font-mono text-xs">KLASA {a.klasa}</span>{a.datum && `, ${date(a.datum)}`}</li>)}
    </ul>
  </details>;
}

function Stretch({ id, eyebrow, title, figure, children, ask, o, bounds }: { id: string; eyebrow: string; title: string; figure?: ReactNode; children: ReactNode; ask: ReactNode; o: Obligation; bounds?: number[] | null }) {
  return <article id={id} className="scroll-mt-24 space-y-5 border-t border-kamen-rub pt-8">
    <header>
      <p className="text-xs font-bold uppercase tracking-wider text-kamen-tekst">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-bold leading-snug text-kamen-tinta">{title}</h3>
    </header>
    {figure}
    <div className="max-w-3xl space-y-4 text-base leading-7 text-kamen-tekst">{children}</div>
    <p className="max-w-3xl rounded-xl bg-white p-5 text-base leading-7 text-kamen-tinta"><strong>Tražimo:</strong> {ask}</p>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {bounds && <MapFocusButton bounds={bounds} />}
      <Sources o={o} />
    </div>
  </article>;
}

export function PlantingObligations() {
  const street = byId("grad-ulica"), d4 = byId("dracevac-4d"), hall = byId("hala-7a"), c15 = byId("dracevac-15"), c9 = byId("dracevac-9c");
  const hallReplaced = hall.izracun.zamjenjuje ?? [];
  const hallKept = hall.izracun.ulicna_dvostruki_red ?? [];
  const hallDriveway = hall.izracun.ulicna_u_ulazu ?? [];
  const powerSpots = (street.izracun.uz_dalekovod as string[] | undefined) ?? [];
  const olives = (c15.izracun.masline_na_cesti_m2 ?? 0) + (c15.izracun.masline_na_cestici_m2 ?? 0);
  // udio je grub (pojas maslina očitan sa snimke), pa se kaže riječima
  const share = (c15.izracun.masline_na_cesti_m2 ?? 0) / (olives || 1) >= 0.6 ? "dvije trećine" : "polovice";
  return <section id="obveze" className="scroll-mt-24 space-y-10">
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Tko sadi, od zapada prema istoku</h2>
      <p className="mt-3 text-lg leading-8 text-kamen-tekst">Uz nogostup sadi Grad. Na susjednim česticama sade vlasnici: stabla im propisuje plan ili ih GUP traži uz dozvolu za gradnju.</p>
    </div>

    <Stretch id="ulica" eyebrow="Ulica · k.č. 419/9" title="Drvored uz nogostup je posao Grada" o={street} bounds={street.izracun.okvir}
      ask={<>da Grad drvored uvrsti u svako uređenje ove ceste, a za mjesta blizu vodova s upraviteljima dogovori zaštitu ili izmještanje voda.</>}>
      <p>Cesta je nerazvrstana; njome upravlja Grad, a čestica je prema gradskom GIS-u u vlasništvu države. GUP traži da se ulice uređuju s drvoredom gdje za to ima prostora, a nacrt izmjena iz 2025. to izričito proteže na sve postojeće ceste.</p>
      <p>Uz nogostup smo našli {street.izracun.mjesta_na_nogostupu} mjesta za stabla; {street.izracun.ulicna_uz_instalacije} ih je blizu podzemnih vodova. Za cestu preko ove čestice Županija je izdala lokacijsku dozvolu, produljenu 2020.; novo produljenje odbijeno je 2025.</p>
    </Stretch>

    <Stretch id="dracevac-4d" eyebrow="Dračevac 4d · sjeverna strana" title="Drvored iz plana nikad nije posađen" o={d4} bounds={d4.izracun.okvir}
      figure={<div className="grid gap-4 sm:grid-cols-2">
        <ObligationFigure id="dracevac-4d-plan" legend={false} alt="List plana: uz južnu među čestice ucrtan je red od 11 krošnji, a uz istočnu među još 8" caption="Plan iz 2004.: krošnje uz južnu i istočnu među" />
        <ObligationFigure id="dracevac-4d-danas" alt="Ista čestica danas: na mjestima krošnji iz plana nema visokih stabala" caption="Danas, na istim mjestima" />
      </div>}
      ask={<>da vlasnik posadi {stabala(d4.izracun.stabala ?? 0)} na mjestima iz plana: 11 visokih stablašica uz ulicu i 8 uz istočnu među.</>}>
      <blockquote className="border-l-4 border-kamen-rub pl-4 text-lg leading-8 text-kamen-tinta">„{d4.citat}”<footer className="mt-1 text-sm text-kamen-tekst">DPU dijela područja Dračevac, Sl. gl. 23/04, čl. 6. t. 2.6.</footer></blockquote>
      <p>Detaljni plan iz 2004. dopustio je na ovoj čestici poslovnu zgradu, uz drvored prema ulici. Plan crta {stabala(d4.izracun.stabala ?? 0)}: 11 uz ulicu i 8 uz manju građevinu na istoku.</p>
      <p>Uz ulicu danas raste red niskih biljaka, krošnji dva do tri metra; visokih stablašica nema ni na jednoj snimci od 2011. Uporabnu dozvolu zgrada je ipak dobila 2008., a GUP od 2006. kaže da je sadnja iz projekta uvjet za nju.</p>
      <p>Mjesta {list(d4.izracun.zamjenjuje ?? [])} na nogostupu leže uz podzemne vodove; kad se posadi drvored iz plana, otpadaju.{d4.izracun.uz_dalekovod ? <> {count(d4.izracun.uz_dalekovod as number)} zapadna stabla iz plana su uz dalekovod 110 kV, pa njihovu visinu treba uskladiti s HOPS-om.</> : null}</p>
    </Stretch>

    <Stretch id="hala-7a" eyebrow="Dračevac 7A · sjeverna strana" title="Osam stabala hale, odmah iza ograde" o={hall} bounds={hall.izracun.okvir}
      figure={<ObligationFigure id="hala-7a" alt="Hala uz ulicu: kamionski i glavni ulaz ostaju slobodni, a osam dugovanih stabala stoji u redu iza ograde, na mjestu uličnih mjesta koja leže na kabelu" caption="Pročelje hale prema ulici" />}
      ask={<>{hall.izracun.stabala} visokih stabala iza ograde, izvan dva kolna ulaza. Stabla uz parkiralište, jedno na četiri mjesta, dolaze uz to.</>}>
      <p>Dozvola iz 2016. je za proizvodnu halu i urede. Po GUP-u čestica mora imati jedno stablo na 200 m² neizgrađenog dijela, ovdje najmanje {stabala(hall.izracun.stabala ?? 0)}, i barem 20 % zelenila. Iza ulične ograde danas je samo živica.</p>
      <p>Hala ima dva kolna ulaza: kamionski na zapadu i glavni, s parkiralištem, na istoku. Oba ostaju slobodna.{hallDriveway.length > 0 && <> Mjesta {list(hallDriveway)} iz prvog prijedloga nogostupa pala su upravo u te ulaze, pa otpadaju.</>}</p>
      <p>{hallKept.length === 0 ? "Sva preostala" : `Od preostalih, ${hallReplaced.length}`} mjesta na nogostupu ispred hale ({list(hallReplaced)}) leže na podzemnom kabelu ili odvodnji. Zato predlažemo da hala svoja stabla posadi odmah iza ograde, izvan ulaza: ondje zamjenjuju ta mjesta i hlade nogostup.{hallKept.length > 0 && <> Uz {list(hallKept)}, koje ostaje, ulica dobiva dvostruki red.</>}</p>
      <p>Ako Grad kabel zaštiti ili izmjesti, stabla na nogostupu i iza ograde mogu stajati zajedno, u dvostrukom redu.</p>
    </Stretch>

    <Stretch id="dracevac-15" eyebrow="Dračevac 15 · k.č. 291 · južna strana" title="Masline na međi, a zid treba izmjeriti" o={c15} bounds={c15.izracun.okvir}
      figure={<div className="grid gap-4 sm:grid-cols-2">
        <ObligationFigure id="dracevac-15-2019" legend={false} alt="Red maslina uz ulicu 2019.: veći dio krošnji je sjeverno od katastarske međe, na cestovnoj čestici" caption="2019./20.: red maslina preko međe" />
        <ObligationFigure id="dracevac-15" alt="Isti rub danas: uz red maslina podignuta je nova građevina" caption="Danas: nova građevina uz masline" />
      </div>}
      ask={<>da Grad geodetski utvrdi gdje je zid. Ako je na javnoj površini, pojas se vraća ulici i u njemu je mjesto za drvored. Masline presaditi, a uz ulicu posaditi visoka stabla.</>}>
      <p>Dvorište na čestici 291 od ulice dijeli betonski zid sa žičanom ogradom, a iza zida je red maslina, posađen prije 2017. Oko {share} krošnji leži preko katastarske međe, na cestovnoj čestici u vlasništvu države. Građevna čestica iz dozvole iz 2017. je samo k.č. 291, bez tog pojasa.</p>
      <p>Je li zid na međi ili na javnoj površini, snimke ne mogu reći. Na snimci iz 2011., prije maslina, rub dvorišta je na međi ili do metar izvan nje, a to je unutar točnosti katastarskog plana.</p>
      <p>Dozvola iz 2017. je za proizvodnju sladoleda. Kad se pogon izgradi, čestica po GUP-u duguje oko {stabala(c15.izracun.stabala ?? 0)} koja narastu oko deset metara; masline u ovakvom redu ostaju niske. Između 2023. i 2025. uz sam red maslina podignuta je nova građevina; prijave početka građenja za nju u registru nema.</p>
    </Stretch>

    <Stretch id="dracevac-9c" eyebrow="Dračevac 9C · južna strana" title="Jedno stablo" o={c9} bounds={c9.izracun.okvir}
      ask={<>stablo na uskom kraju čestice uz ulicu, iza mjesta {list(c9.izracun.ulicna_ispred ?? [])} na nogostupu.</>}>
      <p>Dozvola iz 2021. je za stambeno-poslovnu zgradu koja je na čestici stajala i prije. Po GUP-u čestica mora imati najmanje jedno stablo i 30 % zelenila, oko {number(c9.izracun.zelenilo_m2 ?? 0)} m². Neizgrađeni dio uz zgradu je popločen.</p>
    </Stretch>

    <Stretch id="ostatak" eyebrow="Ostatak ulice" title="Ostale zgrade danas ne duguju ništa" o={street} bounds={street.izracun.okvir_dalekovod}
      ask={<>da Grad u dozvolama i u budućem UPU-u Dračevac 2 stabla koja traži GUP smjesti uz ulicu.</>}>
      <p>Za ostale zgrade uz ulicu u registru nema dozvole izdane otkad je GUP 2006. uveo ovu obvezu, ili su od nje starije. Obveza nastaje s prvom novom dozvolom: jedno stablo na 200 m² neizgrađenog dijela čestice, a po nacrtu izmjena iz 2025. na 200 m² cijele čestice, i 20 do 30 % zelenila. Nijedno pravilo ne kaže gdje.</p>
      {powerSpots.length > 0 && <p>Na istočnom zavoju mjesta {list(powerSpots)} na nogostupu su ispod ili uz dalekovod 110 kV; visinu stabala ondje treba dogovoriti s HOPS-om.</p>}
    </Stretch>

    <div className="max-w-3xl space-y-3 border-t border-kamen-rub pt-6 text-sm leading-6 text-kamen-tekst">
      <p>Akti su iz javnog <a className={linkStyle} href={data.registar.url}>{data.registar.naziv}</a>, provjereno {date(data.provjereno)}; stanje na terenu: {data.teren}. {data.registar.napomena} Koliko je stabala i gdje ucrtano u projektu za dozvolu, vidi se tek u glavnom projektu, koji se od Grada može zatražiti pozivom na pravo na pristup informacijama i klasu akta.</p>
      <p><a className={linkStyle} href={OBLIGATIONS_URL}>Preuzmi podatke o obvezama (GeoJSON)</a></p>
    </div>
  </section>;
}
