import Link from "next/link";
import Image from "next/image";
import { SchoolBusMap } from "./school-bus-map";
import report from "../../../public/geo/prijedlozi/skolski-autobus.json";

const linkStyle = "fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina underline underline-offset-4";
const plan = "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14243&PortalId=0&language=hr-HR";
const provisions = "https://split.hr/DesktopModules/Bring2mind/DMX/API/Entries/Download?Command=Core_Download&EntryId=14341&PortalId=0&language=hr-HR";
const coordinate = (value: number) => value.toLocaleString("hr-HR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
type Candidate = (typeof report.candidates)[number];

function CandidateCard({ stop }: { stop: Candidate }) {
  return <article id={stop.id.toLowerCase()} className="rounded-xl border border-kamen-rub bg-white p-5 sm:p-6">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-kamen-tinta text-sm font-bold text-white">{stop.id}</span><p className="text-sm font-semibold text-kamen-tekst">{stop.stage}</p></div>
    <h3 className="mt-5 text-2xl font-bold leading-tight tracking-tight">{stop.title}</h3>
    <p className="mt-3 leading-7 text-kamen-tekst">{stop.location}</p>
    <p className="mt-3 leading-7 text-kamen-tekst">{stop.reason}</p>
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-y border-kamen-rub py-4 text-sm leading-6">
      <dt className="text-kamen-tekst">Čestica</dt><dd className="font-semibold">{stop.parcel.split(":")[1]}, k.o. Split</dd>
      <dt className="text-kamen-tekst">GIS vlasništvo</dt><dd>{stop.publicLevel === "city" ? "Grad Split" : "Republika Hrvatska"}</dd>
      <dt className="text-kamen-tekst">Točka (šir., duž.)</dt><dd className="tabular-nums">{coordinate(stop.coordinate[1])} · {coordinate(stop.coordinate[0])}</dd>
    </dl>
    <h4 className="mt-5 font-semibold">Kako dolazi autobus</h4><p className="mt-2 leading-7 text-kamen-tekst">{stop.direction}</p>
    <p className="mt-5 text-sm font-semibold">Blizina adresa u naselju</p>
    <p className="mt-1 leading-7"><strong className="text-2xl tabular-nums">{stop.catchment.within300m}/{stop.catchment.totalAddresses}</strong><span className="ml-2 text-kamen-tekst">unutar 300 m zračno</span></p>
    <p className="mt-1 text-sm leading-6 text-kamen-tekst">Do 500 m: {stop.catchment.within500m} od {stop.catchment.totalAddresses} adresnih točaka. To nisu izmjerene pješačke udaljenosti ni broj djece.</p>
    <details className="mt-5 border-t border-kamen-rub pt-3"><summary className="fokus cursor-pointer py-2 font-semibold">Zemljište i uvjeti razrade</summary><p className="mt-2 text-sm leading-6 text-kamen-tekst">{stop.evidence}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-kamen-tekst">{stop.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul><p className="mt-3 text-sm leading-6 text-kamen-tekst">{stop.ownershipNote}</p></details>
  </article>;
}

export function SchoolBusProposal() {
  const dracevac = report.candidates.filter((stop) => stop.neighborhood === "dracevac");
  const bilice = report.candidates.find((stop) => stop.id === "B2")!;
  return <div className="space-y-10 sm:space-y-14">
    <section className="grid gap-6 border-y border-kamen-rub py-7 sm:grid-cols-[1fr_1.4fr]">
      <h2 className="text-2xl font-bold leading-tight tracking-tight">Dračevac iz radne zone.<br />Bilice uz novi ulaz.</h2>
      <div className="space-y-3 leading-7 text-kamen-tekst">
        <p>Za Dračevac prednost ima <strong className="text-kamen-tinta">R1, s dolaskom iz radne zone</strong>. Usporedna mogućnost je <strong className="text-kamen-tinta">N1, sjeverni rub rotora</strong>. To su dvije varijante za jedno stajalište.</p>
        <p>Za Bilice predlažemo <strong className="text-kamen-tinta">B2 uz novi ulaz iz 4B</strong>. Ulaz je već prikazan u DPU-u; autobusno stajalište uz njega novi je prijedlog koji treba uklopiti u projekt.</p>
        <p className="text-sm">Sve tri referentne točke imaju GIS evidenciju javnog zemljišta. Položaj cijelog ugibališta, završni manevri i povratak iz škole ostaju dio projektne razrade.</p>
      </div>
    </section>

    <section id="prijedlog" className="scroll-mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kamen-tekst">Bilice · Dračevac → Sv. Kajo</p><h2 className="text-2xl font-bold tracking-tight">Stajališta uz planirane prilaze</h2></div><a href="/geo/prijedlozi/skolski-autobus.geojson" download className={linkStyle}>Preuzmi lokacije</a></div>
      <SchoolBusMap />
    </section>

    <section aria-labelledby="dracevac-title">
      <h2 id="dracevac-title" className="text-2xl font-bold tracking-tight">Dračevac: R1 ili sjeverni rub rotora</h2>
      <p className="mb-5 mt-3 max-w-3xl leading-7 text-kamen-tekst">R1 je bliže većem broju evidentiranih adresa Dračevca. N1 daje odvojenu mogućnost izvan rekreativne zone, uz dodatnu razradu pristupa i zelenog pojasa.</p>
      <div className="grid gap-6 sm:grid-cols-2">{dracevac.map((stop) => <CandidateCard key={stop.id} stop={stop} />)}</div>
    </section>

    <section className="grid items-start gap-7 sm:grid-cols-2">
      <div><h2 className="text-2xl font-bold tracking-tight">R1: dolazak sa juga mijenja rješenje</h2><p className="mt-4 leading-7 text-kamen-tekst">Autobus prilazi iz radne zone ulicom 4D / Os 6 i koristi izdvojeni desni skretač prema istoku. Taj je krak prikazan na prometnom listu, a izdvojene desne skretače opisuje i §3.1.1 DPU-a.</p><p className="mt-3 leading-7 text-kamen-tekst">Zelena strelica na karti završava prije lokalnog ulaza u R1. Pokazuje smjer dolaska po planiranom kolniku. Ulaz do perona, ukrcaj i odlazak treba položiti tako da autobus ne koristi prostor igre za okretanje.</p><a href={plan} className={`${linkStyle} mt-3`}>DPU 2a-1 · prilaz i desni skretač</a></div>
      <figure><Image src="/prijedlozi/skolski-autobus-r1-dpu.png" alt="Izvorni prometni plan s južnim prilazom 4D, Os 6 i izdvojenim desnim skretačem prema istočnom kraku rotora" width={889} height={936} sizes="(max-width: 640px) 100vw, 480px" className="h-auto w-full rounded-xl border border-kamen-rub" /><figcaption className="mt-3 text-sm leading-6 text-kamen-tekst">Grad Split, DPU 2a-1 (2024.), izvadak. Dolazak iz radne zone prati južni prilaz i odvojeni desni skretač. Na sjevernom rubu nije ucrtano autobusno ugibalište.</figcaption></figure>
    </section>

    <section aria-labelledby="bilice-title">
      <h2 id="bilice-title" className="text-2xl font-bold tracking-tight">Bilice: ulaz je u DPU-u, stajalište je dopuna</h2>
      <p className="mb-5 mt-3 max-w-3xl leading-7 text-kamen-tekst">Na zapadnoj strani 4B / Os 4, sjeverno od spoja s 4E, prometni list prikazuje otvor prema Bilicama II. Time postoji planska osnova da se stajalište razmotri zajedno s novim ulazom. DPU ne crta školski peron na tom mjestu; §3.1.3 dopušta naknadna stajališta s ugibalištem uz ispunjene tehničke uvjete.</p>
      <div className="grid items-start gap-6 sm:grid-cols-2"><CandidateCard stop={bilice} /><div><figure><Image src="/prijedlozi/skolski-autobus-bilice-dpu.png" alt="Izvorni DPU: zapadno otvoren priključak prema Bilicama II iz ulice 4B, Os 4, iznad raskrižja s ulicom 4E" width={588} height={604} sizes="(max-width: 640px) 100vw, 480px" className="h-auto w-full rounded-xl border border-kamen-rub" /><figcaption className="mt-3 text-sm leading-6 text-kamen-tekst">Grad Split, DPU 2a-1. Vidljiv je otvor prema zapadu iz Os 4. Ulaz je označen i na karti; B2 pokazuje područje uz cestu za razradu stajališta.</figcaption></figure><p className="mt-5 leading-7 text-kamen-tekst">Autobus ostaje u profilu radne zone. Djeca iz Bilica dolaze uređenim pješačkim pristupom kroz novi ulaz, bez potrebe da autobus ulazi u usku Bilice II. Stajalište se razrađuje u istoj etapi kao cesta i nogostup.</p><div className="mt-3 flex flex-wrap gap-x-5"><a href={provisions} className={linkStyle}>DPU · §3.1.3, str. 12</a><Link href="/prijedlozi/pristupna-cesta-bilice" className={linkStyle}>Prijedlog pristupne ceste</Link></div></div></div>
    </section>

    <section className="grid gap-7 sm:grid-cols-2">
      <div><h2 className="text-2xl font-bold tracking-tight">Jedno stajalište po naselju</h2><p className="mt-3 leading-7 text-kamen-tekst">Radni slijed za usporedbu je B2 uz 4B, zatim 4E i 4D do R1. U drugoj se varijanti umjesto R1 ispituje N1. Tako se prijevoz nastoji povezati s planiranom cestom i izbjeći dodatne vožnje kroz stambene odvojke.</p><p className="mt-3 leading-7 text-kamen-tekst">Treba provjeriti cijeli put do OŠ Vjekoslava Paraća u Sv. Kaju i povratak, uključujući stvarne smjerove i izlaz nakon stajanja. Taj slijed još nije potvrđena autobusna linija. Trošak se uspoređuje po cijeloj vožnji i potrebnim radovima.</p></div>
      <div><h2 className="text-2xl font-bold tracking-tight">Javno zemljište i siguran dolazak</h2><p className="mt-3 leading-7 text-kamen-tekst">R1 je na gradskoj 419/1, N1 na državnoj 276/1, a B2 na državnoj 252/2 prema dostupnoj GIS evidenciji. Sjeverno su evidentirane i druge javne čestice, ali dio zauzimaju rotor i planirano zelenilo. Za peron, ugibalište i pristup treba provjeriti cijeli zahvat.</p><p className="mt-3 leading-7 text-kamen-tekst">Zračne udaljenosti služe usporedbi lokacija. Stvarni put djece treba prohodati: nogostupi, prijelazi, rasvjeta, ograde i nagib mogu promijeniti izbor. Sadašnji ukrcaj na parkiralištu seli se tek kada zamjena bude spremna.</p></div>
    </section>

    <details className="border-t border-kamen-rub pt-5"><summary className="fokus cursor-pointer py-2 font-semibold">Ranije razmotrene lokacije</summary><div className="mt-4 divide-y divide-kamen-rub">{report.alternatives.map((stop) => <div key={stop.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_2fr] sm:gap-6"><h3 className="font-semibold">{stop.id} · {stop.label.replace(/^Ranije · /, "")}</h3><p className="leading-7 text-kamen-tekst">{stop.reason}</p></div>)}</div></details>

    <details className="border-t border-kamen-rub pt-5"><summary className="fokus cursor-pointer py-2 font-semibold">Izvori i način usporedbe</summary><div className="mt-4 space-y-4 text-sm leading-7 text-kamen-tekst"><p>Revidirano 22. rujna 2026. prema prijedlogu stanovnika: R1 s dolaskom iz radne zone, usporedna mogućnost sjeverno od rotora i Bilice uz ulaz iz DPU-a. Izvorna prometna grafika razlikuje se od novih prijedloga stajališta.</p><p>{report.ownershipEvidence} Zračne udaljenosti računaju se u HTRS96/TM: za Bilice iz adresa ulica Bilice I i II, a za Dračevac iz adresa ulice Dračevac. Adresna točka nije dokaz kućanstva, učenika ili sigurnog pješačkog pristupa.</p><div className="flex flex-wrap gap-x-6 gap-y-1"><a className={linkStyle} href={plan}>DPU · prometna mreža</a><a className={linkStyle} href={provisions}>DPU · odredbe</a><a className={linkStyle} href="https://os-vparac-solin.skole.hr/za-roditelje/">Škola · upisno područje</a><a className={linkStyle} href="/geo/analiza/javne-cestice.geojson">Javne čestice · GIS</a><a className={linkStyle} href="/geo/grad/adrese.geojson">Adresne točke · GIS</a><a className={linkStyle} href="/geo/prijedlozi/skolski-autobus.json" download>Preuzmi prostorni probir</a></div></div></details>

    <section className="flex flex-wrap items-center justify-between gap-5 border-t border-kamen-rub pt-7"><div><h2 className="text-xl font-bold">Povezani prijedlozi</h2><div className="mt-2 flex flex-wrap gap-x-6"><Link className={linkStyle} href="/prijedlozi/uredenje-rekreativne-zone-dracevac">Rekreativna zona</Link><Link className={linkStyle} href="/prijedlozi/uredenje-nogostupa">Nogostupi</Link></div></div><Link href="/prijavi" className="fokus inline-flex min-h-12 items-center rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna">Dodaj prijedlog za stajalište</Link></section>
  </div>;
}
