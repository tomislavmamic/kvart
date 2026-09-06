import Link from "next/link";
import { WhatsAppButton, WHATSAPP_URL } from "@/components/whatsapp-button";
import { STATUSES } from "@/lib/constants";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "O inicijativi",
  description:
    "Saznaj kako stanovnici Dračevca i Bilica javno prate probleme, odgovore Grada i načine uključivanja.",
});

/**
 * Reddit je odložen: razgovor kvarta vodi se u WhatsApp grupi.
 *
 * Zajednica r/DracevacBilice nikad nije otvorena — poveznica je vodila na
 * Redditovu stranicu „We couldn't find that community”, uz koju Reddit sam
 * predlaže nasumične zajednice, među njima i one označene NSFW.
 *
 * Ostaje uvjetovan prikaz umjesto brisanja: polje `redditUrl` po prijedlogu
 * i dalje postoji u bazi i administraciji, pa se otvaranjem subreddita i
 * postavljanjem NEXT_PUBLIC_SUBREDDIT sve vrati bez ikakve izmjene koda.
 * Dok varijable nema, o Redditu se ne piše ništa.
 */
const SUBREDDIT = process.env.NEXT_PUBLIC_SUBREDDIT?.trim() || null;

const STATUS_EXPLANATIONS: Record<keyof typeof STATUSES, string> = {
  objavljeno: "prijedlog je pregledan i javno objavljen na stranici",
  poslano_gradu:
    "prijedlog je službeno upućen Gradu Splitu ili nadležnoj službi (bilježimo datum i klasu dopisa)",
  u_tijeku: "nadležni su potvrdili da rade na rješenju",
  rijeseno: "problem je riješen — hvala svima koji su gurali",
  odbijeno: "nadležni su odbili prijedlog; obrazloženje objavljujemo uz prijedlog",
  na_cekanju: "prijedlog trenutno miruje (npr. čeka proračun ili dokumentaciju)",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">O inicijativi</h1>
        <p className="mt-3 leading-relaxed text-zinc-700">
          Naš kvart je neformalna građanska inicijativa stanovnika splitskih
          kvartova Dračevac i Bilice. Cilj je jednostavan: na jednom mjestu
          skupiti probleme i prijedloge iz kvarta, javno pratiti što je
          poslano Gradu Splitu i što je od toga riješeno, te okupiti susjede
          koji žele pomoći.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-bold">Gdje se odvija razgovor?</h2>

        {/* WhatsApp je jedini živi kanal kvarta, pa ne stoji kao natuknica
            među ostalima nego ima svoj okvir i dugme. */}
        {WHATSAPP_URL && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">
              WhatsApp grupa kvarta
            </p>
            <p className="mt-1 text-sm text-emerald-900/80">
              Svakodnevni razgovor, brze obavijesti i dogovori. Ondje se
              najbrže vidi koga još muči isto.
            </p>
            <span className="mt-3 inline-block">
              <WhatsAppButton large />
            </span>
          </div>
        )}

        <ul className="mt-3 space-y-3 text-sm text-zinc-700">
          {SUBREDDIT && (
            <li>
              <strong>Reddit</strong> — dublja rasprava o pojedinim
              prijedlozima:{" "}
              <a
                href={`https://www.reddit.com/r/${SUBREDDIT}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 underline"
              >
                r/{SUBREDDIT}
              </a>
            </li>
          )}
          <li>
            <strong>Ova stranica</strong> — trajna evidencija: prijedlozi,
            statusi, dokumenti.{" "}
            <Link href="/prijavi" className="text-emerald-700 underline">
              Prijavite problem ovdje.
            </Link>
          </li>
          <li>
            <strong>Zrak oko Karepovca</strong> — simulator mirisa po satima,
            dojave susjeda i plan mjernih postaja.{" "}
            <Link href="/karepovac/dojava" className="text-emerald-700 underline">
              Javite kada je smrdjelo
            </Link>{" "}
            ili{" "}
            <Link href="/karepovac/ukljuci-se" className="text-emerald-700 underline">
              pomozite da postaje nastanu.
            </Link>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-bold">Što znače statusi?</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {Object.entries(STATUS_EXPLANATIONS).map(([key, explanation]) => (
            <div key={key} className="flex gap-2">
              <dt className="shrink-0 font-semibold">
                {STATUSES[key as keyof typeof STATUSES]}:
              </dt>
              <dd className="text-zinc-600">{explanation}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-bold">Nadležne institucije</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-700">
          <li>
            <strong>Grad Split — servis za građane:</strong>{" "}
            <a
              href="https://split.hr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline"
            >
              split.hr
            </a>
          </li>
          <li>
            <strong>Gradski kotar / mjesni odbor:</strong> kontakt podatke
            objavit ćemo ovdje čim ih potvrdimo.
          </li>
        </ul>
      </div>
    </div>
  );
}
