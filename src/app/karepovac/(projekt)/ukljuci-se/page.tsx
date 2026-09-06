import Link from "next/link";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { createPageMetadata } from "@/lib/metadata";
import {
  cijenaFaze,
  opisPodrucja,
  PRIJEDLOZI_POSTAJA,
  ZAHTJEV_URL,
} from "@/lib/sim/prijedlozi-postaja";
import { WHATSAPP_URL } from "@/lib/site-navigation";
import { eur, FAZE, NAZIV_FAZE, trebaStanovnika } from "@/lib/ukljuci-se";

import { ObrazacPomoci, type PostajaZaIzbor } from "./obrazac";

export const metadata = createPageMetadata({
  title: "Uključi se",
  description:
    "Javite da možete ustupiti mjesto za mjernu postaju, pomoći znanjem ili novcem kad se donacije otvore. Bez uplate i bez obveze; prijave još nisu otvorene.",
});

/**
 * Stranica na kojoj susjed može nešto pritisnuti.
 *
 * Prijave i donacije nisu otvorene i to piše u prvom retku. Ali trinaest
 * predloženih postaja već postoji (`PRIJEDLOZI_POSTAJA`), devet ih traži
 * nečije dvorište ili balkon, i taj netko danas može reći „mogu” — bez
 * uplate, bez obveze, bez primatelja. Obrazac to bilježi; ova stranica ga
 * okružuje onim što tko nudi mora znati: za koju postaju, gdje, pošto i što
 * slijedi.
 *
 * `?postaja=<id>` stiže s kartice postaje u simulatoru: tada se iznad
 * obrasca pokaže ta postaja, a u obrascu je unaprijed odabrana.
 */
export default async function UkljuciSePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = (await searchParams) ?? {};
  const trazeno = Array.isArray(p.postaja) ? p.postaja[0] : p.postaja;
  const odabrana = PRIJEDLOZI_POSTAJA.find((s) => s.id === trazeno) ?? null;

  const zaIzbor: PostajaZaIzbor[] = PRIJEDLOZI_POSTAJA.map((s) => ({
    id: s.id,
    naziv: s.naziv,
    mjesto: s.mjesto,
    faza: s.faza,
    stanovnik: trebaStanovnika(s),
  }));
  const zaStanovnike = PRIJEDLOZI_POSTAJA.filter(trebaStanovnika);
  const zaUstanove = PRIJEDLOZI_POSTAJA.filter((s) => !trebaStanovnika(s));

  return (
    <div className="space-y-14">
      <PageIntro title="Pomozite nam postaviti prve mjerne postaje">
        <p>
          Prijave i uplate nisu otvorene; namjeru možete javiti već sada. Tražimo
          stanovnike koji mogu ustupiti mjesto za postaju, ljude koji se
          razumiju u opremu i one koji bi pomogli novcem kad se donacije otvore.
        </p>
      </PageIntro>

      <PreparationNotice />

      {odabrana && (
        <section
          aria-labelledby="za-postaju"
          className="rounded-xl border border-maslina-rub bg-white p-5 sm:p-6"
        >
          <p className="text-base font-semibold text-maslina-tamna">Za postaju</p>
          <h2 id="za-postaju" className="mt-1 text-2xl font-bold text-kamen-tinta">
            {odabrana.naziv}
          </h2>
          <p className="mt-1 text-base leading-7 text-kamen-tekst">{odabrana.mjesto}</p>
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-base leading-7 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-kamen-tinta">Mjerila bi</dt>
              <dd className="text-kamen-tekst">{odabrana.mjeri}</dd>
            </div>
            <div>
              <dt className="font-semibold text-kamen-tinta">Okvirna cijena opreme</dt>
              <dd className="text-kamen-tekst">
                {eur(odabrana.cijena[0], odabrana.cijena[1])} · {NAZIV_FAZE[odabrana.faza]}, cijela{" "}
                {eur(...cijenaFaze(odabrana.faza))}; bez montaže, okvirno, iz popisa
                predloženih postaja
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-kamen-tinta">Zašto ovdje</dt>
              <dd className="text-kamen-tekst">{odabrana.zasto}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-kamen-tinta">Treba dogovoriti</dt>
              <dd className="text-kamen-tekst">
                {odabrana.uvjeti} Postaja smije stajati {opisPodrucja(odabrana)}.
              </dd>
            </div>
          </dl>
          {!trebaStanovnika(odabrana) && (
            <p className="mt-4 text-base leading-7 text-kamen-tekst">
              Ovu postaju ne može ustupiti stanovnik: treba dogovor s ustanovom.
              Znanje, ruke ili novac za nju svejedno pomažu — obrazac ispod vrijedi
              i za to.
            </p>
          )}
          <p className="mt-4">
            <Link
              href="/karepovac/sim?pri=1"
              className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
            >
              Vidi predložena mjesta na karti →
            </Link>
          </p>
        </section>
      )}

      <section aria-labelledby="mogu-pomoci" className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:gap-12">
        <div className="rounded-xl border border-kamen-tlo bg-white p-5 sm:p-8">
          <h2 id="mogu-pomoci" className="text-2xl font-bold tracking-[-0.02em] text-kamen-tinta">
            Mogu pomoći
          </h2>
          <p className="mt-2 text-base leading-7 text-kamen-tekst">
            Ni uplata ni obveza — zapis da netko ima mjesto, znanje ili volju,
            da znamo kome se javiti.
          </p>
          <div className="mt-6">
            <ObrazacPomoci postaje={zaIzbor} pocetnaPostaja={odabrana?.id ?? null} />
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold text-kamen-tinta">Što slijedi</h3>
            <ol className="mt-3 space-y-3 text-base leading-7 text-kamen-tekst">
              <Korak broj={1}>
                Ponuda ostaje zapisana. Vidi je samo tko vodi projekt; ne
                objavljujemo ni ime, ni adresu, ni kontakt.
              </Korak>
              <Korak broj={2}>
                Prvo objavljujemo tko vodi projekt i tko smije primati donacije.
                Na tom smo koraku sada, i datuma za njega nemamo.
              </Korak>
              <Korak broj={3}>
                Kad prijave budu otvorene, javljamo se prvo onima koji su se
                ovdje javili — i ovdje pišemo da su otvorene.
              </Korak>
            </ol>
          </div>

          {/* Popisi obećanja ostaju od riječi do riječi; njihovi su omotači
              (uvodni odlomci, ikone, sivi gumbi) otišli, jer je sve što su
              govorili sad u obavijesti, obrascu i koracima iznad. */}
          <div>
            <h3 className="text-xl font-bold text-kamen-tinta">Prije otvaranja objavit ćemo</h3>
            <p className="mt-3 font-bold text-kamen-tinta">Prije otvaranja prijava objavit ćemo</p>
            <ul className="mt-2 space-y-2 text-base leading-7 text-kamen-tekst">
              <Check>obavijest o tome koje podatke prikupljamo i zašto;</Check>
              <Check>
                dogovor o pristupu postaji, vlasništvu opreme i uklanjanju postaje;
              </Check>
              <Check>
                pravila prema kojima ćemo birati mjesta i prikazivati približne
                lokacije.
              </Check>
            </ul>
            <p className="mt-4 font-bold text-kamen-tinta">Prije otvaranja donacija objavit ćemo</p>
            <ul className="mt-2 space-y-2 text-base leading-7 text-kamen-tekst">
              <Check>koliko želimo prikupiti i što ćemo tim novcem platiti;</Check>
              <Check>što je naručeno, što je plaćeno i koliko je novca ostalo;</Check>
              <Check>račune i potvrde koje smijemo javno objaviti.</Check>
            </ul>
            <p className="mt-3 text-base leading-7 text-kamen-tekst">
              Okvirna cijena opreme već stoji na stranici{" "}
              <Link
                href="/karepovac/financije"
                className="fokus rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
              >
                Novac i troškovi
              </Link>
              .
            </p>
          </div>

          {WHATSAPP_URL && (
            <div>
              <h3 className="text-xl font-bold text-kamen-tinta">Radije porukom?</h3>
              <p className="mt-2 text-base leading-7 text-kamen-tekst">
                Razgovor kvarta živi u WhatsApp grupi; ondje se može javiti i
                bez obrasca.
              </p>
              <div className="mt-3">
                <WhatsAppButton large />
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-bold text-kamen-tinta">Za one sa znanjem</h3>
            <p className="mt-2 text-base leading-7 text-kamen-tekst">
              Popis opreme i rasprava o planu stoje na GitHubu; tko se razumije u
              senzore, elektroniku, LoRa ili Wi-Fi vezu, kućišta, vremenske
              podatke ili obradu mjerenja, ondje može i prigovoriti.
            </p>
            <ul className="mt-3 space-y-2 text-base leading-7">
              <li>
                <VanjskaPoveznica href={ZAHTJEV_URL}>Prvi plan postaja i opreme (#28)</VanjskaPoveznica>
              </li>
              <li>
                <VanjskaPoveznica href="https://github.com/tomislavmamic/kvart/issues/12">
                  Plan mjerenja i rasprava (#12)
                </VanjskaPoveznica>
              </li>
              <li>
                <Link
                  href="/karepovac/metodologija"
                  className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
                >
                  Kako mjerimo →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="gdje-trazimo">
        <SectionHeading title="Gdje tražimo mjesto">
          <p>
            {zaStanovnike.length} od {PRIJEDLOZI_POSTAJA.length} predloženih postaja
            traži dvorište, balkon ili krov stanovnika i struju iz kuće. Točno
            mjesto nije zadano: postaja mjeri isto bilo gdje u osjenčanom
            isječku na karti, pa i dvorište sto metara dalje jednako služi.
          </p>
        </SectionHeading>
        <div className="mt-7 space-y-8">
          {FAZE.map((faza) => {
            const uFazi = zaStanovnike.filter((s) => s.faza === faza);
            if (uFazi.length === 0) return null;
            return (
              <div key={faza}>
                <h3 className="text-base font-bold text-kamen-tinta">
                  {NAZIV_FAZE[faza]}
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {uFazi.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col rounded-xl border border-kamen-tlo bg-white p-5"
                    >
                      <p className="text-lg font-bold text-kamen-tinta">{s.naziv}</p>
                      <p className="mt-1 text-base leading-6 text-kamen-tekst">{s.mjesto}</p>
                      <p className="mt-2 text-base leading-6 text-kamen-tekst">
                        Mjerila bi {s.mjeri}. Treba: {s.uvjeti}
                      </p>
                      <p className="mt-2 text-base text-kamen-drugi">
                        Oprema okvirno {eur(s.cijena[0], s.cijena[1])}, bez montaže
                      </p>
                      <p className="mt-auto pt-4">
                        <Link
                          href={`/karepovac/ukljuci-se?postaja=${s.id}#mogu-pomoci`}
                          className="fokus inline-flex min-h-11 w-full items-center justify-center rounded-full border border-maslina bg-white px-5 font-semibold text-maslina-tamna hover:bg-maslina-vez"
                        >
                          Ponudi mjesto za ovu postaju
                        </Link>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div>
            <h3 className="text-base font-bold text-kamen-tinta">
              Traže dogovor s ustanovom, ne stanovnika
            </h3>
            <ul className="mt-3 space-y-2 text-base leading-7 text-kamen-tekst">
              {zaUstanove.map((s) => (
                <li key={s.id}>
                  <span className="font-semibold text-kamen-tinta">{s.naziv}</span> —{" "}
                  {s.uvjeti}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-base leading-7 text-kamen-tekst">
            <Link
              href="/karepovac/sim?pri=1"
              className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
            >
              Sva predložena mjesta na karti →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function Korak({ broj, children }: { broj: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kamen-tinta text-sm font-bold text-white"
      >
        {broj}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 leading-6">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-maslina" />
      <span>{children}</span>
    </li>
  );
}

function VanjskaPoveznica({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
    >
      {children} ↗
    </a>
  );
}
