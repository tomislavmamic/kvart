import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton, WHATSAPP_URL } from "@/components/whatsapp-button";
import { STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "O inicijativi" };

/**
 * Bez zamjenske vrijednosti, i to namjerno.
 *
 * Prije je stajalo `?? "DracevacBilice"`, a ta zajednica ne postoji —
 * poveznica je vodila na Redditovu stranicu „We couldn't find that
 * community”, uz koju Reddit sam predlaže nasumične zajednice, među njima i
 * one označene NSFW. Za susjedsku inicijativu to je gore nego da poveznice
 * nema. Dok se subreddit ne otvori i ne postavi NEXT_PUBLIC_SUBREDDIT, o
 * Redditu se ne piše ništa.
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
        <ul className="mt-3 space-y-3 text-sm text-zinc-700">
          {WHATSAPP_URL && (
            <li>
              <strong>WhatsApp grupa</strong> — svakodnevni razgovor i brze
              obavijesti. <span className="block sm:inline" />
              <span className="mt-2 inline-block">
                <WhatsAppButton />
              </span>
            </li>
          )}
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
