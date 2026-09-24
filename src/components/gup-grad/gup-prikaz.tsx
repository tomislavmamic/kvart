"use client";

/**
 * /gup: prekidač između grafikona (infografika.tsx) i karte provjere
 * (gup-karta.tsx). Oba prikaza dijele godinu plana i način brojanja, pa
 * prelazak s jednog na drugi pokazuje isti izračun.
 *
 * Prikaz je u adresi (`?prikaz=karta`, uz `c` i `z` karte), da se karta
 * može poslati poveznicom. Karta se učitava tek kad se otvori — Leaflet i
 * pločice čestica ne trebaju onome tko gleda grafikon.
 */
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import { GupInfografika, Prekidac, type PodaciInfografike } from "@/components/gup-grad/infografika";
import { POCETNE_GUP_POSTAVKE, type GupPostavke } from "@/components/gup-grad/gup-provjera";

const GupKarta = dynamic(() => import("@/components/gup-grad/gup-karta").then((m) => m.GupKarta), {
  ssr: false,
  loading: () => <div className="h-[70vh] min-h-[26rem] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100" />,
});

type Prikaz = "grafikon" | "karta";
const PRIKAZI: { id: Prikaz; naziv: string }[] = [
  { id: "grafikon", naziv: "Grafikon" },
  { id: "karta", naziv: "Karta čestica" },
];

/**
 * Prikaz živi u adresi. Stranica je statična, pa ga poslužitelj ne zna i
 * crta grafikon; preglednik ga pročita iz adrese pri hidraciji.
 */
const PROMJENA = "gup-prikaz";
function pretplati(javi: () => void) {
  window.addEventListener(PROMJENA, javi);
  window.addEventListener("popstate", javi);
  return () => {
    window.removeEventListener(PROMJENA, javi);
    window.removeEventListener("popstate", javi);
  };
}
const izAdrese = (): Prikaz => (new URLSearchParams(window.location.search).get("prikaz") === "karta" ? "karta" : "grafikon");

export function GupPrikaz({ podaci }: { podaci: PodaciInfografike }) {
  const prikaz = useSyncExternalStore(pretplati, izAdrese, () => "grafikon" as Prikaz);
  const [postavke, setPostavke] = useState<GupPostavke>({ ...POCETNE_GUP_POSTAVKE, inacica: podaci.inacice[0].id });

  const promijeni = (p: Prikaz) => {
    const u = new URL(window.location.href);
    if (p === "karta") u.searchParams.set("prikaz", "karta");
    else for (const k of ["prikaz", "c", "z"]) u.searchParams.delete(k);
    window.history.replaceState(window.history.state, "", u);
    window.dispatchEvent(new Event(PROMJENA));
  };

  return (
    <div>
      <div className="flex">
        <Prekidac oznaka="Prikaz" opcije={PRIKAZI} vrijednost={prikaz} promijeni={promijeni} />
      </div>
      <div className="mt-4">
        {/* Grafikon ostaje u stablu i dok se gleda karta, da ne izgubi svoje izbore. */}
        <div hidden={prikaz !== "grafikon"}>
          <GupInfografika
            podaci={podaci}
            godina={postavke.godina}
            onGodina={(godina) => setPostavke((p) => ({ ...p, godina }))}
            inacica={postavke.inacica}
            onInacica={(inacica) => setPostavke((p) => ({ ...p, inacica }))}
          />
        </div>
        {prikaz === "karta" && <GupKarta postavke={postavke} onPostavke={setPostavke} />}
      </div>
    </div>
  );
}
