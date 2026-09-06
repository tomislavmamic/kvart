"use client";

import Link from "next/link";
import { useState } from "react";

import { WhatsAppButton } from "@/components/whatsapp-button";
import { ponudiPomoc } from "@/lib/actions/public";
import { ZAHTJEV_URL } from "@/lib/sim/prijedlozi-postaja";
import { WHATSAPP_URL } from "@/lib/site-navigation";
import { NAJDULJE, NAZIV_FAZE, provjeriPonudu, VRSTE_POMOCI } from "@/lib/ukljuci-se";
import type { VrstaPomoci } from "@/lib/ukljuci-se";

/**
 * Obrazac „Mogu pomoći”: tri kućice, jedna postaja, jedan kontakt.
 *
 * Nije prijava i nije uplata — to piše iznad gumba, jer prijave i donacije
 * nisu otvorene. Bilježi se namjera, da tko vodi projekt zna kome se javiti
 * kad se otvore. Pisan je za mobitel u ruci kao i dojava: velike kućice,
 * bez klizanja unutar polja, sve što nije obvezno tako i piše.
 *
 * Popis postaja stiže od stranice, ne uvozi se ovdje: obrazac ne treba
 * koordinate ni opise, samo ime i fazu za padajući izbor.
 */

/** Ono što padajući izbor treba znati o postaji; ostalo ostaje na stranici. */
export type PostajaZaIzbor = {
  readonly id: string;
  readonly naziv: string;
  readonly mjesto: string;
  readonly faza: "A" | "B" | "C";
  /** Traži dvorište ili balkon stanovnika (a ne dozvolu ustanove). */
  readonly stanovnik: boolean;
};

/** Velika kućica-izbor; prst, ne miš. Ista kao na dojavi. */
const IZBOR =
  "fokus-unutar flex min-h-12 cursor-pointer items-start gap-3 "
  + "rounded-xl border border-kamen-rub bg-white px-4 py-3 text-left "
  + "text-kamen-tinta hover:bg-kamen-plitko "
  + "has-checked:border-maslina has-checked:bg-maslina-vez "
  + "has-checked:text-maslina-noc";

const NATPIS = "block text-base font-bold text-kamen-tinta";

const POLJE =
  "fokus mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-kamen-rub "
  + "bg-white px-4 text-base text-kamen-tinta placeholder:text-kamen-drugi";

export function ObrazacPomoci({
  postaje,
  pocetnaPostaja = null,
}: {
  postaje: readonly PostajaZaIzbor[];
  pocetnaPostaja?: string | null;
}) {
  const [vrste, setVrste] = useState<ReadonlySet<VrstaPomoci>>(() => {
    // Tko je došao s kartice postaje koja traži dvorište, najvjerojatnije
    // nudi baš to; sve ostalo ostaje prazno da se ne podmetne odgovor.
    const p = postaje.find((s) => s.id === pocetnaPostaja);
    return new Set(p?.stanovnik ? ["mjesto" as const] : []);
  });
  const [postaja, setPostaja] = useState(
    () => postaje.find((s) => s.id === pocetnaPostaja)?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [nijeZapisano, setNijeZapisano] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const poznate = new Set(postaje.map((s) => s.id));

  function prekidac(v: VrstaPomoci) {
    setVrste((stare) => {
      const nove = new Set(stare);
      if (nove.has(v)) nove.delete(v);
      else nove.add(v);
      return nove;
    });
  }

  async function posalji(formData: FormData) {
    setPending(true);
    setError(null);
    setNijeZapisano(false);
    formData.delete("vrsta");
    for (const v of vrste) formData.append("vrsta", v);
    formData.set("postaja", postaja);
    // Ista provjera kao na poslužitelju, samo bez puta do njega: greška u
    // označavanju vidi se odmah, a ne nakon čekanja.
    const provjera = provjeriPonudu(
      {
        vrste: [...vrste],
        postaja,
        podrucje: String(formData.get("podrucje") ?? ""),
        kontakt: String(formData.get("kontakt") ?? ""),
        poruka: String(formData.get("poruka") ?? ""),
      },
      poznate,
    );
    if (!provjera.ok) {
      setPending(false);
      setError(provjera.error);
      return;
    }
    const rezultat = await ponudiPomoc(formData);
    setPending(false);
    if (rezultat.ok) {
      setDone(true);
      return;
    }
    setError(rezultat.error);
    setNijeZapisano(rezultat.nijeZapisano === true);
  }

  const odabrana = postaje.find((s) => s.id === postaja) ?? null;

  return (
    // Područje koje se mijenja bez navigacije: čitač zaslona čuje „Zabilježeno”
    // i grešku bez traženja po stranici.
    <div aria-live="polite">
      {done ? (
        <div className="rounded-xl border border-maslina-rub bg-maslina-vez p-5 text-maslina-noc">
          <h3 className="text-xl font-bold">Zabilježeno. Hvala.</h3>
          <p className="mt-2 text-base leading-7">
            Ponuda je zapisana i vidi je samo tko vodi projekt. Ništa ne
            objavljujemo. Kad prijave i donacije budu otvorene, javljamo se
            prvo onima koji su ostavili kontakt; tko ga nije ostavio, saznat
            će ovdje i u grupi.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/karepovac/sim?pri=1"
              className="fokus inline-flex min-h-12 items-center justify-center rounded-xl border border-maslina bg-white px-5 font-semibold text-maslina-tamna hover:bg-kamen-plitko"
            >
              {/* Simulator još ne zna otvoriti pojedinu postaju iz adrese, pa
                  poveznica ne obećava ime koje ne može ispuniti. */}
              Natrag na kartu s predloženim mjestima
            </Link>
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setError(null);
              }}
              className="fokus inline-flex min-h-12 items-center justify-center rounded-xl border border-maslina px-5 font-semibold text-maslina-tamna hover:bg-white"
            >
              Javi još nešto
            </button>
          </div>
        </div>
      ) : (
        <form action={posalji} className="space-y-5">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <fieldset>
            <legend className={NATPIS}>Što mogu ponuditi?</legend>
            <p className="mt-1 text-base leading-6 text-kamen-drugi">
              Označite jedno ili više.
            </p>
            <div className="mt-2 grid gap-2">
              {VRSTE_POMOCI.map((v) => (
                <label key={v.id} className={IZBOR}>
                  <input
                    type="checkbox"
                    name="vrsta-izbor"
                    value={v.id}
                    checked={vrste.has(v.id)}
                    onChange={() => prekidac(v.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-maslina"
                  />
                  <span>
                    <span className="block text-base font-semibold">{v.natpis}</span>
                    <span className="block text-base leading-6 text-kamen-tekst">
                      {v.opis}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="ponuda-postaja" className={NATPIS}>
              Za koju postaju?{" "}
              <span className="font-normal text-kamen-drugi">(ako znate)</span>
            </label>
            <select
              id="ponuda-postaja"
              name="postaja-izbor"
              value={postaja}
              onChange={(e) => setPostaja(e.target.value)}
              className={POLJE}
            >
              <option value="">Nije važno / ne znam</option>
              {(["A", "B", "C"] as const).map((faza) => (
                <optgroup key={faza} label={NAZIV_FAZE[faza]}>
                  {postaje
                    .filter((s) => s.faza === faza)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.naziv}
                        {s.stanovnik ? "" : " (traži ustanovu)"}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {odabrana && !odabrana.stanovnik && vrste.has("mjesto") && (
              <p className="mt-2 text-base leading-6 text-kamen-drugi">
                Ovu postaju ne može ustupiti stanovnik — treba dogovor s
                ustanovom. Znanje, ruke ili novac za nju svejedno pomažu.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ponuda-podrucje" className={NATPIS}>
              Ulica ili dio naselja{" "}
              <span className="font-normal text-kamen-drugi">(nije obvezno)</span>
            </label>
            <input
              id="ponuda-podrucje"
              type="text"
              name="podrucje"
              maxLength={NAJDULJE.podrucje}
              autoComplete="street-address"
              placeholder="npr. Dračevac, sjeverni dio"
              className={POLJE}
            />
            <p className="mt-2 text-base leading-6 text-kamen-drugi">
              Bez kućnog broja ako ne želite. Dovoljno je da znamo je li mjesto
              u isječku koji postaja treba.
            </p>
          </div>

          <div>
            <label htmlFor="ponuda-kontakt" className={NATPIS}>
              E-pošta ili telefon{" "}
              <span className="font-normal text-kamen-drugi">(nije obvezno)</span>
            </label>
            <input
              id="ponuda-kontakt"
              type="text"
              name="kontakt"
              maxLength={NAJDULJE.kontakt}
              autoComplete="email"
              inputMode="email"
              placeholder="ime@primjer.hr ili 09x …"
              className={POLJE}
            />
            <p className="mt-2 text-base leading-6 text-kamen-drugi">
              Kontakt nikad ne objavljujemo; vidi ga samo tko vodi projekt.
              Tražimo ga zato da vam se možemo javiti kad prijave budu otvorene
              — bez njega ponuda ostaje zapisana, ali vas nemamo kako naći.
            </p>
          </div>

          <div>
            <label htmlFor="ponuda-poruka" className={NATPIS}>
              Poruka{" "}
              <span className="font-normal text-kamen-drugi">(nije obvezno)</span>
            </label>
            <textarea
              id="ponuda-poruka"
              name="poruka"
              rows={3}
              maxLength={NAJDULJE.poruka}
              placeholder="npr. balkon prema sjeveru, ima struje; mogu i montirati"
              className={`${POLJE} py-3`}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-odbijeno bg-rose-50 px-4 py-3 text-base leading-7 text-odbijeno-tamna"
            >
              <p>{error}</p>
              {nijeZapisano && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {WHATSAPP_URL && <WhatsAppButton large />}
                  <a
                    href={ZAHTJEV_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fokus inline-flex min-h-12 items-center justify-center rounded-xl border border-kamen-rub bg-white px-5 font-semibold text-kamen-tinta hover:bg-kamen-plitko"
                  >
                    Javite se na popisu #28 ↗
                  </a>
                </div>
              )}
            </div>
          )}

          <p className="text-base leading-7 text-kamen-tekst">
            Ovo nije uplata ni obveza. Kad prijave i donacije budu otvorene,
            javit ćemo se prvo onima koji su se ovdje javili.
          </p>

          <button
            type="submit"
            disabled={pending}
            className="fokus flex min-h-14 w-full items-center justify-center rounded-full bg-maslina text-lg font-semibold text-white transition-colors hover:bg-maslina-tamna disabled:opacity-60"
          >
            {pending ? "Šaljem…" : "Javi da mogu pomoći"}
          </button>
        </form>
      )}
    </div>
  );
}
