import Link from "next/link";
import { Suspense } from "react";
import { KAREPOVAC_PHASES, KAREPOVAC_PUBLIC_STATE } from "@/lib/karepovac";
import { pripremiZrak } from "@/lib/zrak";
import { KartaDima, PodlogaDefinicija, PoljeDimaVeliko } from "@/components/karepovac/karta-kartice";
import { Facts } from "./spatial-proposals";

const linkStyle = "fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina underline underline-offset-4 hover:text-maslina-tamna";

export function AirPlumeFallback() {
  return <div className="absolute inset-0 flex items-center bg-[#fcfbf9]">
    <PodlogaDefinicija />
    <div className="w-full"><KartaDima slika="/karepovac/kvart-prosjek.png" opis="Godišnji prosjek modeliranog raspršenja s Karepovca" /></div>
    <span role="status" className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-xs text-kamen-tekst">Godišnji prosjek · učitavam trenutačni model</span>
  </div>;
}

/** The same field and canvas as /karepovac/zrak, without controls inside a card link. */
export async function AirPlumePreview() {
  const { polje, zalet, opis } = await pripremiZrak();
  return <div data-component="AirPlumePreview" className="absolute inset-0 flex items-center bg-[#fcfbf9]">
    <PodlogaDefinicija />
    <div className="w-full"><KartaDima polje={polje} zalet={zalet} opis={`Model raspršenja s Karepovca: ${opis.recenica}`} /></div>
  </div>;
}

export function AirProposal() {
  return <div className="space-y-10 sm:space-y-14">
    <section className="overflow-hidden rounded-2xl border border-kamen-rub bg-white">
      <div className="flex flex-wrap items-center justify-between gap-5 bg-kamen-tinta p-5 text-white sm:p-7">
        <div><h2 className="text-2xl font-bold tracking-tight">Kamo zrak s Karepovca putuje?</h2><p className="mt-2 max-w-xl leading-7 text-zinc-200">Model raspršenja, vjetar i službeni podaci na jednom mjestu.</p></div>
        <Link href="/karepovac/zrak" className="fokus inline-flex min-h-12 items-center rounded-full bg-white px-6 py-3 font-semibold text-kamen-tinta hover:bg-kamen-plitko">Pogledaj zrak s Karepovca <span className="ml-2" aria-hidden>→</span></Link>
      </div>
      <Suspense fallback={<div className="relative aspect-[2/1]"><AirPlumeFallback /></div>}><PoljeDimaVeliko /></Suspense>
    </section>
    <Facts items={[["3+", "Uređaja za prvi pokusni rad"], ["30 dana", "Planirano trajanje pokusa"], ["0", "Postavljenih postaja naše mreže"]]} />
    <section className="grid gap-6 sm:grid-cols-[1fr_1.25fr]">
      <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">Kad osjetimo miris,<br />želimo znati više.</h2>
      <div className="space-y-4 text-lg leading-8 text-kamen-tekst"><p>Predlažemo mjerne postaje u naseljima uz Karepovac. Njihova očitanja povezivali bismo s vjetrom i dojavama susjeda kako bismo bolje razumjeli kada i gdje se javlja neugodan miris.</p><p>Provjerena mjerenja bila bi javno dostupna. Projekt je {KAREPOVAC_PUBLIC_STATE.status.toLocaleLowerCase("hr-HR")}; naše postaje još nisu postavljene.</p><Link href="/karepovac/sim?pri=1" className={linkStyle}>Pogledaj predložena mjesta za postaje →</Link></div>
    </section>
    <section className="grid gap-8 sm:grid-cols-2">
      <div><h2 className="text-xl font-bold">Mjerenje bliže našim domovima</h2><p className="mt-3 leading-7 text-kamen-tekst">Dvije službene postaje jugoistočno od odlagališta objavljuju satne podatke. Nalaze se na suprotnoj strani od Dračevca i Bilica, pa želimo dopuniti sliku mjerenjima u našem kvartu.</p></div>
      <div><h2 className="text-xl font-bold">Dojave susjeda dio su slike</h2><p className="mt-3 leading-7 text-kamen-tekst">Vrijeme i mjesto pojave mirisa pomažu usporediti opažanja s vjetrom. Korisno je zabilježiti i da mirisa nije bilo.</p></div>
    </section>
    <section id="ukljuci-se" className="border-y border-kamen-rub py-8"><h2 className="text-2xl font-bold tracking-tight">Možete pomoći već danas</h2><p className="mt-3 max-w-2xl leading-7 text-kamen-tekst">Zabilježite opažanje mirisa. Ako imate mjesto za postaju ili možete pomoći s opremom i održavanjem, pogledajte kako se uključiti.</p><div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3"><Link href="/karepovac/dojava" className="fokus inline-flex min-h-12 items-center rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna">Zabilježi opažanje mirisa</Link><Link href="/karepovac/ukljuci-se" className={linkStyle}>Ponudi mjesto ili pomoć →</Link></div></section>
    <details id="provedba" className="border-b border-kamen-rub pb-6"><summary className="fokus cursor-pointer py-3 text-lg font-bold">Detalji provedbe i izvori</summary><div className="mt-5 space-y-7 text-kamen-tekst">
      <section><h3 className="font-bold text-kamen-tinta">Što bismo mjerili</h3><p className="mt-2 leading-7">U prvom pokusnom radu pratili bismo sumporovodik (H₂S), uz zasebne podatke o vjetru i dojave o mirisu. Uređaje najprije treba međusobno usporediti i provjeriti prema pouzdanom mjerenju. Javno bismo prikazivali provjerena očitanja, pouzdanost i prekide rada svake postaje, odvojeno od procjena modela.</p></section>
      <section><h3 className="font-bold text-kamen-tinta">Od pripreme do javnih mjerenja</h3><ol className="mt-3 divide-y divide-kamen-rub">{KAREPOVAC_PHASES.map((phase) => <li key={phase.title} className="py-4"><p className="text-sm text-kamen-tekst">{phase.status}</p><h4 className="mt-1 font-bold text-kamen-tinta">{phase.title}</h4><p className="mt-2 leading-7">{phase.description}</p></li>)}</ol></section>
      <div className="flex flex-wrap gap-x-6 gap-y-2"><Link href="/karepovac" className={linkStyle}>Projekt Karepovac</Link><Link href="/karepovac/postaje" className={linkStyle}>Službene i predložene postaje</Link><Link href="/karepovac/metodologija" className={linkStyle}>Postupak provjere senzora</Link><Link href="/karepovac/financije" className={linkStyle}>Oprema i troškovi</Link></div>
    </div></details>
  </div>;
}
