import Link from "next/link";
import report from "../../../public/geo/prijedlozi/bilice-cesta.json";
import { BiliceRoadVisual } from "./bilice-road-visual";
import { BiliceRoadParcels } from "./bilice-road-parcels";

const number = (value: number) => Math.round(value).toLocaleString("hr-HR");
const linkStyle = "fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina underline underline-offset-4";
const provisions = "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14341&PortalId=0&language=hr-HR";

export function BiliceRoadProposal() {
  const { metrics } = report;
  return <div className="space-y-10 sm:space-y-14">
    <section id="prijedlog" className="scroll-mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Kratki spoj. Nastavak postojećim cestama.</h2>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Kandidat za provjeru · pristup još nije riješen</span>
      </div>
      <p className="mb-5 max-w-3xl border-l-2 border-amber-600 pl-4 leading-7 text-kamen-tekst">Nije pronađena potvrđena cjelovita veza koja istodobno prati DPU i čuva sve zgrade. Prikazujemo razrađeni kandidat od 182 m; kraća sjeverna mogućnost od 64 m uspoređena je niže. Postojeći odvojak D1 služi za ulaz; zakonit izlaz na glavnu cestu ostaje neriješen.</p>
      <BiliceRoadVisual />
    </section>

    <BiliceRoadParcels />

    <dl className="grid grid-cols-3 gap-3 border-y border-kamen-rub py-6 sm:gap-8">
      {[
        [`≈ ${number(metrics.newLengthM)} m`, "Nova etapa za izgradnju i uređenje"],
        [`≈ ${number(metrics.existingLengthM)} m`, "Postojeći istočni nastavak za zadržavanje"],
        [String(metrics.newStageBuildingConflicts), "Presjeka nove etape sa zgradama iz sloja 2025."],
      ].map(([value, label]) => <div key={label}><dt className="text-sm leading-5 text-kamen-tekst">{label}</dt><dd className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</dd></div>)}
    </dl>

    <section className="grid gap-6 sm:grid-cols-[1fr_1.25fr]">
      <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">Najprije spoj koji nedostaje.</h2>
      <div className="space-y-4 text-lg leading-8 text-kamen-tekst">
        <p>U 3D prikazu razrađen je spoj iz Bilica II na južni dio planirane ulice 4B, zatim zapadnim dijelom 4E do postojeće ulice Dračevac. Dalje se koristi postojeća cesta prema istočnom ulaznom odvojku glavne cestovne mreže.</p>
        <p>Nova etapa ne presijeca zgrade u gradskom sloju iz 2025. Postojeće ceste koriste se gdje je moguće. Uz novu vezu, zahvat uključuje i proširenje prvih 75 m ulice unutar Bilica; taj rad i zemljište treba uključiti u troškovnik. Starije katastarske objekte i stvarne rubove postojećeg nastavka treba dodatno provjeriti.</p>
        <p className="border-l-2 border-amber-600 pl-4 text-base leading-7 text-kamen-tinta">Ovo još nije cjelovito prometno rješenje. Prvo treba utvrditi dopušten izlaz na D1 i potvrditi da spoj s postojećim nastavkom može biti samostalna etapa. Bez toga se ne preporučuje pokretanje gradnje.</p>
      </div>
    </section>

    <section>
      <h2 className="text-2xl font-bold tracking-tight">Trasa, dionicu po dionicu</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-2">
        {report.segments.map((segment, index) => <li key={segment.id} className="flex gap-4 rounded-xl bg-kamen-plitko p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold">{index + 1}</span>
          <div><h3 className="font-bold">{segment.label}</h3><p className="mt-1 text-sm leading-6 text-kamen-tekst">≈ {number(segment.lengthM)} m{segment.onewayInbound ? " · samo ulazni smjer s D1" : ""}</p></div>
        </li>)}
      </ol>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-kamen-tekst">Zeleno je postojeća cesta koja se zadržava, a narančasto spoj koji nedostaje. Planirani kolnik DPU-a prikazan je samo na novoj etapi; postojeći istočni nastavak prati današnju trasu. Ostale planirane ceste mogu se zasebno uključiti za usporedbu. Duljine se računaju po radnim osima kandidata, a prikazana širina postojećeg nastavka je shematska. Stvarne rubove, dovoljnu širinu i javni status treba potvrditi snimkom i dokumentacijom.</p>
    </section>

    <section>
      <h2 className="text-2xl font-bold tracking-tight">Usporedba mogućih smjerova</h2>
      <p className="mt-3 max-w-3xl leading-7 text-kamen-tekst">Usporedba prvo provjerava očuvanje zgrada. Puni profili ovih koridora ne prolaze taj uvjet u dostupnim podacima. Kraći spoj zato ostaje predmet provjere, ali nije dokazana najjeftinija izvediva veza. Uspoređeni su navedeni koridori, ne sve moguće projektne varijante.</p>
      <p className="mt-3 max-w-3xl leading-7 text-kamen-tekst"><strong className="text-kamen-tinta">Za traženje najnižeg troška prvo provjeriti sjevernu mogućnost:</strong> približno 64 m spoja uz korištenje postojećeg puta Bilice II, s uključenjem u 4B sjeverno od duge zgrade. Sam spoj izbjegava zgrade iz 2025., ali nastavak po 4A zahvaća jednu zgradu planiranim nogostupom. Treba dokazati dopušten pomak nogostupa, prava na postojeći put i cjelovit spoj s D1; zato nije označena kao izvedivo rješenje.</p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-kamen-rub">
        <table className="w-full min-w-[600px] text-left text-sm">
          <caption className="sr-only">Usporedba cestovnih varijanti prema zahvatu i očuvanju zgrada</caption>
          <thead className="bg-kamen-plitko"><tr><th className="p-4">Varijanta</th><th className="p-4">Zgrade u zahvatu</th><th className="p-4">Ocjena</th></tr></thead>
          <tbody>{report.alternatives.map((alternative) => <tr key={alternative.id} className="border-t border-kamen-rub align-top">
            <th className="p-4 font-semibold">{alternative.label}</th>
            <td className="p-4 tabular-nums">{alternative.buildingConflicts == null ? "Nije potvrđeno" : alternative.buildingConflicts}</td>
            <td className="max-w-lg p-4 leading-6 text-kamen-tekst">{alternative.reason}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="grid gap-8 sm:grid-cols-2">
      <div><h2 className="text-xl font-bold">Štednja kroz manji opseg</h2>
        <p className="mt-3 leading-7 text-kamen-tekst">Prednost je u korištenju postojećeg nastavka i izbjegavanju rušenja. Ova etapa ne uključuje izgradnju cijele prometne mreže poslovne zone. U troškovnik treba uključiti i 75 m proširenja u Bilicama. Duljina novog asfalta sama nije troškovnik: odvodnja, nogostupi, rasvjeta, instalacije, zidovi i zemljište mogu promijeniti redoslijed troškova.</p>
        <p className="mt-3 leading-7 text-kamen-tekst">Zato ne navodimo neprovjerenu cijenu u eurima. Za novu etapu ispitan je profil od približno {number(metrics.newFullProfileAreaM2)} m². Nakon rješenja izlaza i etapnosti treba usporediti trošak punog koridora, zemljišta i konstrukcija; tek tada je moguće odabrati najjeftinije izvedivo rješenje.</p>
      </div>
      <div><h2 className="text-xl font-bold">Puni profil nove etape</h2>
        <p className="mt-3 leading-7 text-kamen-tekst">DPU dopušta etapnu izvedbu samostalnih prometnih cjelina i razradu priključaka susjednog područja. Za novu prometnicu traži cjelovit profil s pripadajućim nogostupima, drvoredom i opremom; najmanji nogostup je 2 m.</p>
        <p className="mt-3 leading-7 text-kamen-tekst">Ulica 4E prolazi ispod planiranog pješačkog nathodnika. Niveletu, rampe i konstrukciju treba riješiti projektom. Njihova odgoda nije potvrđena. Ako etapa nije prihvatljiva bez pune denivelacije ili proširenja 4D, prikazani manji opseg nije izvediv.</p>
        <a href={provisions} className={linkStyle}>DPU 10/25 · odjeljci 3.1–3.1.2, str. 11–12</a>
      </div>
    </section>

    <section className="rounded-xl bg-maslina-vez p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-tight">Što prvo riješiti</h2>
      <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-kamen-tekst">
        <li>Potvrditi etapnost, javni status svih dionica i dopuštene smjerove na priključku glavnoj mreži.</li>
        <li>Snimiti cijeli koridor i prilaze kućama. Sačuvati svaku zgradu; provjeriti i zidove, ograde, stabla te vatrogasni pristup.</li>
        <li>Riješiti cestovne čestice i pravo gradnje. Gradski GIS i postojanje puta nisu dokaz riješenog vlasništva.</li>
        <li>Projektirati niveletu, preglednost, odvodnju, nogostupe i instalacije u okviru DPU-a, zatim izraditi troškovnik.</li>
      </ol>
    </section>

    <details className="border-t border-kamen-rub pt-5">
      <summary className="fokus cursor-pointer py-2 font-semibold">Podaci, ograničenja i izvori</summary>
      <div className="mt-4 space-y-5 text-sm leading-7 text-kamen-tekst">
        <p>Podloga: GIS Grada Splita, prometne plohe važećeg DPU-a i DGU model reljefa. Prostorni presjek s evidentiranim zgradama početni je probir; ne zamjenjuje geodetsku snimku ni projekt. Prikaz je idejna trasa, ne izdana dozvola ili projekt izvedenog stanja.</p>
        <ul className="list-disc space-y-2 pl-5">{report.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        <ul className="list-disc space-y-2 pl-5">{report.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul>
        <div className="flex flex-wrap gap-x-6 gap-y-1">{report.sources.map((source) => <a key={source.label} className={linkStyle} href={source.url || source.path}>{source.label}</a>)}</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <a className={linkStyle} href="/geo/prijedlozi/bilice-cesta.geojson" download>Preuzmi trasu i prostorne provjere</a>
          <a className={linkStyle} href="/geo/prijedlozi/bilice-cesta.json" download>Preuzmi usporedbu varijanti</a>
          <Link className={linkStyle} href="/karta?pogled=katastar&podloga=dof&c=43.527,16.496&z=17">Otvori katastar i ortofoto</Link>
        </div>
      </div>
    </details>
  </div>;
}
