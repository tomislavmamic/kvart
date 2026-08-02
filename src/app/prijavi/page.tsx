import type { Metadata } from "next";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Prijavi problem" };

/**
 * Lokacija dolazi s karte, kao upit.
 *
 * `/karta` je najveća površina stranice i jedino mjesto gdje netko već gleda
 * određenu točku i ima razlog. Dosad se odande nije moglo prijaviti ništa —
 * trebalo je otvoriti izbornik i lokaciju prepisati po sjećanju. Obrazac se
 * ne mijenja; samo prima tri parametra ako ih ima.
 *
 * Vrijednosti se provjeravaju ovdje: koordinata izvan kvarta ili besmislen
 * broj čestice ne ulaze u obrazac, pa se poveznicom ne može podmetnuti tekst
 * u prijavu koju moderator čita.
 */
function lokacijaIzUpita(q: Record<string, string | string[] | undefined>) {
  const jedan = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const lat = Number(jedan(q.lat));
  const lng = Number(jedan(q.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Grubi okvir kvarta uz rezervu — vidi KVART_BBOX u map-views.
  if (lat < 43.5 || lat > 43.55 || lng < 16.45 || lng > 16.54) return null;
  const kcSirovi = jedan(q.kc) ?? "";
  const kc = /^[0-9]{1,6}(\/[0-9]{1,4})?$/.test(kcSirovi) ? kcSirovi : null;
  return { lat, lng, kc };
}

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lokacija = lokacijaIzUpita(await searchParams);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Prijavi problem ili prijedlog</h1>
      <p className="mt-2 text-zinc-600">
        Bez registracije, traje minutu. Što konkretniji opis i fotografija —
        veća šansa da se stvar pomakne.
      </p>
      <div className="mt-8">
        <SubmitForm lokacija={lokacija} />
      </div>
    </div>
  );
}
